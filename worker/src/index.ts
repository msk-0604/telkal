/**
 * TELKAL API（Cloudflare Workers + D1）
 *
 * 呼び出し元は Next.js サーバー（BFF）のみを想定する。
 *  - x-telkal-internal-secret: Next.js サーバーとだけ共有する秘密値（必須）
 *  - x-telkal-session:          ログイン時に発行したセッショントークン
 * 企業ID は常にセッションから確定し、リクエスト本文・クエリの値は使わない。
 */
import { authenticate, handleChangePassword, handleLogin, handleLogout, handleMe, type AuthContext } from "./auth";
import { timingSafeEqualString } from "./crypto";
import { createCustomer, getCustomer, searchCustomers, updateCustomer } from "./customers";
import { HttpError, errorResponse, json } from "./http";
import { createRecord, getRecord, listRecords, updateRecord } from "./records";
import { idSchema } from "./schemas";

type Handler = (ctx: { request: Request; url: URL; env: Env; auth: AuthContext; params: string[] }) => Promise<Response> | Response;

type Route = { method: string; pattern: RegExp; name: string; handler: Handler };

const UUID = "([0-9a-fA-F-]{36})";

const routes: Route[] = [
  { method: "GET", pattern: /^\/v1\/auth\/me$/, name: "me", handler: ({ auth }) => handleMe(auth) },
  { method: "POST", pattern: /^\/v1\/auth\/password$/, name: "password", handler: ({ request, env, auth }) => handleChangePassword(request, env, auth) },
  { method: "POST", pattern: /^\/v1\/auth\/logout$/, name: "logout", handler: ({ auth, env }) => handleLogout(auth, env) },
  { method: "GET", pattern: /^\/v1\/customers$/, name: "customers.search", handler: ({ url, env, auth }) => searchCustomers(url, env, auth) },
  { method: "POST", pattern: /^\/v1\/customers$/, name: "customers.create", handler: ({ request, env, auth }) => createCustomer(request, env, auth) },
  { method: "GET", pattern: new RegExp(`^/v1/customers/${UUID}$`), name: "customers.get", handler: ({ params, env, auth }) => getCustomer(params[0]!, env, auth) },
  { method: "PATCH", pattern: new RegExp(`^/v1/customers/${UUID}$`), name: "customers.update", handler: ({ params, request, env, auth }) => updateCustomer(params[0]!, request, env, auth) },
  { method: "GET", pattern: new RegExp(`^/v1/customers/${UUID}/records$`), name: "records.list", handler: ({ params, env, auth }) => listRecords(params[0]!, env, auth) },
  { method: "POST", pattern: new RegExp(`^/v1/customers/${UUID}/records$`), name: "records.create", handler: ({ params, request, env, auth }) => createRecord(params[0]!, request, env, auth) },
  { method: "GET", pattern: new RegExp(`^/v1/records/${UUID}$`), name: "records.get", handler: ({ params, env, auth }) => getRecord(params[0]!, env, auth) },
  { method: "PATCH", pattern: new RegExp(`^/v1/records/${UUID}$`), name: "records.update", handler: ({ params, request, env, auth }) => updateRecord(params[0]!, request, env, auth) },
];

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
    "access-control-allow-headers": "content-type, x-telkal-session, x-telkal-internal-secret",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function withHeaders(res: Response, headers: Record<string, string>): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  out.headers.set("x-content-type-options", "nosniff");
  return out;
}

async function route(request: Request, env: Env, url: URL): Promise<{ res: Response; name: string }> {
  // 内部用の秘密値を検証（Next.js サーバー以外からの呼び出しを拒否）
  const secret = env.INTERNAL_API_SECRET;
  const provided = request.headers.get("x-telkal-internal-secret") ?? "";
  if (!secret || secret.length < 16) {
    console.error("INTERNAL_API_SECRET is not configured");
    throw new HttpError(500, "server_misconfigured", "サーバーの設定に問題があります");
  }
  if (!timingSafeEqualString(provided, secret)) {
    throw new HttpError(401, "unauthorized_client", "認証されていないクライアントです");
  }

  if (request.method === "POST" && url.pathname === "/v1/auth/login") {
    return { res: await handleLogin(request, env), name: "login" };
  }

  let pathMatched = false;
  for (const r of routes) {
    const m = r.pattern.exec(url.pathname);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== request.method) continue;
    const params = m.slice(1);
    for (const p of params) {
      if (!idSchema.safeParse(p).success) throw new HttpError(404, "not_found", "見つかりません");
    }
    const auth = await authenticate(request, env);
    return { res: await r.handler({ request, url, env, auth, params }), name: r.name };
  }
  if (pathMatched) throw new HttpError(405, "method_not_allowed", "許可されていない操作です");
  throw new HttpError(404, "not_found", "見つかりません");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const started = Date.now();
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/health") return withHeaders(json({ ok: true }), cors);

    let res: Response;
    let name = "unknown";
    try {
      ({ res, name } = await route(request, env, url));
    } catch (err) {
      if (err instanceof HttpError) {
        res = errorResponse(err);
      } else {
        // 個人情報を含めないよう、ルート名とエラー種別のみ記録する
        console.error(JSON.stringify({ level: "error", route: url.pathname.replace(/[0-9a-f-]{36}/gi, ":id"), method: request.method, error: err instanceof Error ? err.name + ": " + err.message.slice(0, 200) : "unknown" }));
        res = errorResponse(new HttpError(500, "internal_error", "サーバーでエラーが発生しました。時間をおいて再度お試しください"));
      }
    }
    const dur = Date.now() - started;
    return withHeaders(res, { ...cors, "server-timing": `worker;desc="${name}";dur=${dur}` });
  },
} satisfies ExportedHandler<Env>;
