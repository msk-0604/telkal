"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Alert, Button, Card, Field, TextInput } from "@/components/ui";
import { ApiError, api } from "@/lib/api-client";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current) return; // 二重送信防止
    const errs: Record<string, string> = {};
    if (!current) errs.currentPassword = "現在のパスワードを入力してください";
    if (next.length < 8) errs.newPassword = "新しいパスワードは8文字以上にしてください";
    if (next !== confirm) errs.confirm = "確認用のパスワードが一致しません";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;

    submitLock.current = true;
    setSubmitting(true);
    try {
      await api("/auth/password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
        label: "パスワード変更",
      });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        setFormError("エラーが発生しました。時間をおいて再度お試しください");
      }
    }
    submitLock.current = false;
    setSubmitting(false);
  }

  return (
    <>
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        電話番号検索に戻る
      </Link>
      <Card className="p-5 sm:p-6">
        <form onSubmit={submit} noValidate className="space-y-4">
          {done && <Alert tone="success">パスワードを変更しました。ほかの端末ではログインし直しが必要です。</Alert>}
          {formError && <Alert>{formError}</Alert>}
          <Field label="現在のパスワード" htmlFor="current-password" error={errors.currentPassword}>
            <TextInput
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              error={errors.currentPassword}
              maxLength={200}
            />
          </Field>
          <Field label="新しいパスワード" htmlFor="new-password" error={errors.newPassword} hint="8文字以上。ほかのサービスと同じパスワードは避けてください">
            <TextInput
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              error={errors.newPassword}
              maxLength={200}
            />
          </Field>
          <Field label="新しいパスワード（確認）" htmlFor="confirm-password" error={errors.confirm}>
            <TextInput
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
              maxLength={200}
            />
          </Field>
          <Button type="submit" className="w-full" loading={submitting}>
            変更する
          </Button>
        </form>
      </Card>
    </>
  );
}
