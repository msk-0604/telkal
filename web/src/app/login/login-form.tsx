"use client";

import { LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Alert, Button, Card, Field, TextInput } from "@/components/ui";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 同じタイミングの連続クリックでも二重送信しないよう、描画を待たずに判定する
  const submitLock = useRef(false);
  const router = useRouter();
  const info = useSearchParams().get("expired") ? "ログインの有効期限が切れました。再度ログインしてください。" : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current) return; // 二重送信防止
    if (!email.trim() || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "ログインに失敗しました");
    } catch {
      setError("通信に失敗しました。ネットワーク接続を確認してください");
    }
    submitLock.current = false;
    setSubmitting(false);
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} noValidate className="space-y-4">
        {info && !error && <Alert tone="info">{info}</Alert>}
        {error && <Alert>{error}</Alert>}
        <Field label="メールアドレス" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            autoFocus
          />
        </Field>
        <Field label="パスワード" htmlFor="password">
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={200}
          />
        </Field>
        <Button type="submit" className="w-full" loading={submitting}>
          {!submitting && <LogIn className="size-4" aria-hidden />}
          ログイン
        </Button>
      </form>
    </Card>
  );
}
