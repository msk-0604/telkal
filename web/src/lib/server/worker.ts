import "server-only";

/**
 * Cloudflare Workers API の呼び出し（サーバー専用）。
 * 内部用の秘密値はここでのみ付与し、ブラウザには一切渡さない。
 */

export const SESSION_COOKIE = "telkal_session";

function config() {
  const url = process.env.WORKER_API_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!url || !secret) {
    throw new Error("WORKER_API_URL / INTERNAL_API_SECRET が設定されていません");
  }
  return { url: url.replace(/\/$/, ""), secret };
}

export async function callWorker(
  path: string,
  init: { method?: string; body?: string | null; session?: string; clientIp?: string; search?: string } = {},
): Promise<Response> {
  const { url, secret } = config();
  const headers: Record<string, string> = { "x-telkal-internal-secret": secret };
  if (init.body) headers["content-type"] = "application/json";
  if (init.session) headers["x-telkal-session"] = init.session;
  if (init.clientIp) headers["x-telkal-client-ip"] = init.clientIp;
  return fetch(`${url}${path}${init.search ?? ""}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body ?? undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

/** リクエスト元のクライアント IP（Vercel / 一般的なプロキシのヘッダー） */
export function clientIpFrom(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/** 状態を変更するリクエストが同一オリジンから来たか（CSRF 対策） */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function sessionCookieOptions(expiresAt?: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
  };
}

/** 個人情報を含めないよう ID・クエリを除いたパスでログを出す */
export function logApi(method: string, path: string, status: number, ms: number) {
  const safePath = path.replace(/[0-9a-f-]{36}/gi, ":id");
  console.info(JSON.stringify({ type: "api", method, path: safePath, status, ms }));
}
