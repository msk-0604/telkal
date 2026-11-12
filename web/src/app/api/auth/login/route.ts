import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, callWorker, clientIpFrom, isSameOrigin, logApi, sessionCookieOptions } from "@/lib/server/worker";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: { code: "forbidden_origin", message: "不正なリクエストです" } }, { status: 403 });
  }
  const started = performance.now();
  let res: Response;
  try {
    res = await callWorker("/v1/auth/login", {
      method: "POST",
      body: await request.text(),
      clientIp: clientIpFrom(request.headers),
    });
  } catch {
    return NextResponse.json(
      { error: { code: "upstream_unavailable", message: "サーバーに接続できませんでした。時間をおいて再度お試しください" } },
      { status: 502 },
    );
  }
  logApi("POST", "/v1/auth/login", res.status, Math.round(performance.now() - started));
  const payload = await res.json();
  if (!res.ok) return NextResponse.json(payload, { status: res.status });

  const { token, expiresAt, user, organization } = payload as {
    token: string;
    expiresAt: string;
    user: unknown;
    organization: unknown;
  };
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  // トークンはブラウザの JavaScript に渡さない
  return NextResponse.json({ user, organization }, { headers: { "cache-control": "no-store" } });
}
