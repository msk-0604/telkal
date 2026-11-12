import { dummyPasswordWork, hashPassword, randomToken, sha256Hex, verifyPassword } from "./crypto";
import { HttpError, fieldErrors, json, nowIso, readJson } from "./http";
import { loginSchema, passwordChangeSchema } from "./schemas";

export type AuthContext = {
  sessionId: string;
  userId: string;
  userName: string;
  email: string;
  organizationId: string;
  organizationName: string;
};

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS_PER_EMAIL = 10;
const MAX_ATTEMPTS_PER_IP = 50;

/** 固定ウィンドウで試行回数を数え、現在の回数を返す（原子的な UPSERT） */
async function bumpAttempt(db: D1Database, key: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const expired = now - WINDOW_SECONDS;
  const row = await db
    .prepare(
      `INSERT INTO login_attempts (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN login_attempts.window_start <= ?3 THEN 1 ELSE login_attempts.count + 1 END,
         window_start = CASE WHEN login_attempts.window_start <= ?3 THEN ?2 ELSE login_attempts.window_start END
       RETURNING count`,
    )
    .bind(key, now, expired)
    .first<{ count: number }>();
  return row?.count ?? 1;
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, "validation_error", "入力内容を確認してください", fieldErrors(parsed.error));
  }
  const { email, password } = parsed.data;
  const ip = request.headers.get("x-telkal-client-ip") || "unknown";
  // パスワードのみのログインは、アカウント1つ分として回数を数える
  const emailKey = email ? `email:${await sha256Hex(email)}` : "account:single";

  const [ipCount, emailCount] = await Promise.all([
    bumpAttempt(env.DB, `ip:${ip}`),
    bumpAttempt(env.DB, emailKey),
  ]);
  if (ipCount > MAX_ATTEMPTS_PER_IP || emailCount > MAX_ATTEMPTS_PER_EMAIL) {
    throw new HttpError(429, "too_many_attempts", "ログイン試行回数が多すぎます。15分ほど待ってから再度お試しください");
  }

  type UserRow = {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    organization_id: string;
    organization_name: string;
  };
  const USER_SELECT = `SELECT u.id, u.name, u.email, u.password_hash, u.organization_id, o.name AS organization_name
       FROM users u JOIN organizations o ON o.id = u.organization_id`;

  let user: UserRow | null;
  if (email) {
    user = await env.DB.prepare(`${USER_SELECT} WHERE u.email = ?1`).bind(email).first<UserRow>();
  } else {
    // パスワードのみ：ユーザーが1人だけの運用でのみ許可する
    const { results } = await env.DB.prepare(`${USER_SELECT} ORDER BY u.created_at LIMIT 2`).all<UserRow>();
    if (results.length > 1) {
      throw new HttpError(400, "email_required", "メールアドレスを入力してください");
    }
    user = results[0] ?? null;
  }

  let ok = false;
  if (user) ok = await verifyPassword(password, user.password_hash);
  else await dummyPasswordWork(password);

  if (!user || !ok) {
    throw new HttpError(
      401,
      "invalid_credentials",
      email ? "メールアドレスまたはパスワードが正しくありません" : "パスワードが正しくありません",
    );
  }

  const token = randomToken();
  const sessionId = await sha256Hex(token);
  const ttlDays = Number(env.SESSION_TTL_DAYS) || 30;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 86400_000).toISOString();

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE expires_at <= ?1`).bind(now.toISOString()),
    env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)`).bind(
      sessionId,
      user.id,
      expiresAt,
      now.toISOString(),
    ),
    env.DB.prepare(`DELETE FROM login_attempts WHERE key = ?1`).bind(emailKey),
  ]);

  return json({
    token,
    expiresAt,
    user: { id: user.id, name: user.name, email: user.email },
    organization: { id: user.organization_id, name: user.organization_name },
  });
}

/** x-telkal-session ヘッダーのセッショントークンを検証し、所属企業をサーバー側で確定する */
export async function authenticate(request: Request, env: Env): Promise<AuthContext> {
  const header = request.headers.get("x-telkal-session") ?? "";
  if (!header || header.length > 200) {
    throw new HttpError(401, "unauthenticated", "ログインしてください");
  }
  const sessionId = await sha256Hex(header);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, u.id AS user_id, u.name AS user_name, u.email,
            o.id AS organization_id, o.name AS organization_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN organizations o ON o.id = u.organization_id
      WHERE s.id = ?1 AND s.expires_at > ?2`,
  )
    .bind(sessionId, nowIso())
    .first<{
      session_id: string;
      user_id: string;
      user_name: string;
      email: string;
      organization_id: string;
      organization_name: string;
    }>();
  if (!row) throw new HttpError(401, "unauthenticated", "ログインの有効期限が切れました。再度ログインしてください");
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    userName: row.user_name,
    email: row.email,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
  };
}

export async function handleLogout(auth: AuthContext, env: Env): Promise<Response> {
  await env.DB.prepare(`DELETE FROM sessions WHERE id = ?1`).bind(auth.sessionId).run();
  return json({ ok: true });
}

/** パスワード変更。現在のパスワードを確認し、ほかの端末のセッションはすべて無効にする */
export async function handleChangePassword(request: Request, env: Env, auth: AuthContext): Promise<Response> {
  const parsed = passwordChangeSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, "validation_error", "入力内容を確認してください", fieldErrors(parsed.error));
  }
  const key = `pwchange:${auth.userId}`;
  if ((await bumpAttempt(env.DB, key)) > MAX_ATTEMPTS_PER_EMAIL) {
    throw new HttpError(429, "too_many_attempts", "試行回数が多すぎます。15分ほど待ってから再度お試しください");
  }
  const row = await env.DB.prepare(`SELECT password_hash FROM users WHERE id = ?1`)
    .bind(auth.userId)
    .first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(parsed.data.currentPassword, row.password_hash))) {
    throw new HttpError(400, "validation_error", "現在のパスワードが正しくありません", {
      currentPassword: "現在のパスワードが正しくありません",
    });
  }
  const hash = await hashPassword(parsed.data.newPassword);
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE id = ?3`).bind(hash, nowIso(), auth.userId),
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1 AND id != ?2`).bind(auth.userId, auth.sessionId),
    env.DB.prepare(`DELETE FROM login_attempts WHERE key = ?1`).bind(key),
  ]);
  return json({ ok: true });
}

export function handleMe(auth: AuthContext): Response {
  return json({
    user: { id: auth.userId, name: auth.userName, email: auth.email },
    organization: { id: auth.organizationId, name: auth.organizationName },
  });
}
