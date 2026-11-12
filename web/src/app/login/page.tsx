import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" width={64} height={64} className="size-16 rounded-2xl" />
          <h1 className="text-2xl font-extrabold tracking-wider text-blue-700">TELKAL</h1>
          <p className="text-sm text-slate-500">顧客情報・工事履歴管理</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
