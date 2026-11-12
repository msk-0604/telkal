import type { Metadata } from "next";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "パスワード変更" };

export default function PasswordPage() {
  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-xl font-bold text-slate-800">パスワード変更</h1>
      <PasswordForm />
    </div>
  );
}
