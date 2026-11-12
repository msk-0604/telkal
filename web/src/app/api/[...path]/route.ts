/**
 * BFF: ブラウザ → Next.js サーバー → Cloudflare Workers API
 * セッションは httpOnly Cookie から取り出し、内部用の秘密値を付けて Workers に転送する。
 */
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, callWorker, isSameOrigin, logApi } from "@/lib/server/worker";

const UUID = "[0-9a-fA-F-]{36}";
const ALLOWED: Array<{ methods: string[]; pattern: RegExp }> = [
  { methods: ["GET"], pattern: /^auth\/me$/ },
  { methods: ["GET", "POST"], pattern: /^customers$/ },
  { methods: ["GET", "PATCH"], pattern: new RegExp(`^customers/${UUID}$`) },
  { methods: ["GET", "POST"], pattern: new RegExp(`^customers/${UUID}/records$`) },
  { methods: ["GET", "PATCH"], pattern: new RegExp(`^records/${UUID}$`) },
];

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

async function forward(request: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const started = performance.now();
  const { path } = await ctx.params;
  const joined = path.join("/");
  const rule = ALLOWED.find((r) => r.pattern.test(joined));
  if (!rule) return error(404, "not_found", "見つかりません");
  if (!rule.methods.includes(request.method)) return error(405, "method_not_allowed", "許可されていない操作です");
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return error(403, "forbidden_origin", "不正なリクエストです");
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return error(401, "unauthenticated", "ログインしてください");

  let upstream: Response;
  try {
    upstream = await callWorker(`/v1/${joined}`, {
      method: request.method,
      session,
      search: request.nextUrl.search,
      body: request.method === "GET" ? null : await request.text(),
    });
  } catch {
    logApi(request.method, `/v1/${joined}`, 502, Math.round(performance.now() - started));
    return error(502, "upstream_unavailable", "サーバーに接続できませんでした。時間をおいて再度お試しください");
  }

  const ms = Math.round(performance.now() - started);
  logApi(request.method, `/v1/${joined}`, upstream.status, ms);
  if (upstream.status === 401) cookieStore.delete(SESSION_COOKIE);

  const timing = [upstream.headers.get("server-timing"), `bff;dur=${ms}`].filter(Boolean).join(", ");
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
      "server-timing": timing,
    },
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
