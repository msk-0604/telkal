import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, callWorker, isSameOrigin } from "@/lib/server/worker";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: { code: "forbidden_origin", message: "不正なリクエストです" } }, { status: 403 });
  }
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (session) {
    try {
      await callWorker("/v1/auth/logout", { method: "POST", session });
    } catch {
      // サーバー側の削除に失敗しても Cookie は削除する
    }
  }
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
