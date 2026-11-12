import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CurrentUser } from "@/lib/types";
import { SESSION_COOKIE, callWorker } from "./worker";

/** ログイン中のユーザーと所属企業を取得。未ログイン・期限切れならログイン画面へ。 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) redirect("/login");
  const res = await callWorker("/v1/auth/me", { session });
  if (res.status === 401) redirect("/login?expired=1");
  if (!res.ok) throw new Error(`ユーザー情報の取得に失敗しました (${res.status})`);
  return (await res.json()) as CurrentUser;
}
