"use client";

/**
 * ブラウザから Next.js の API（BFF）を呼ぶためのクライアント。
 * Workers の URL や秘密値はブラウザに渡らない。
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }

  /** 項目ごとのエラーメッセージ（入力値検証エラー時） */
  get fieldErrors(): Record<string, string> {
    if (this.code === "validation_error" && this.details && typeof this.details === "object") {
      return this.details as Record<string, string>;
    }
    return {};
  }
}

export type Timed<T> = { data: T; ms: number };

/** 直近の API 応答時間（画面下部に表示する計測用） */
type Listener = (entry: { label: string; ms: number }) => void;
const listeners = new Set<Listener>();
export function onApiTiming(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function api<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown; signal?: AbortSignal; label?: string } = {},
): Promise<Timed<T>> {
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "通信に失敗しました。ネットワーク接続を確認してください");
  }
  const ms = Math.round(performance.now() - started);
  if (init.label) for (const l of listeners) l({ label: init.label, ms });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // 本文なし
  }
  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    if (res.status === 401 && err?.code === "unauthenticated") {
      // セッション切れ：画面状態を破棄してログイン画面へ（React の外から呼ばれるため完全遷移）
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login?expired=1";
    }
    throw new ApiError(
      res.status,
      err?.code ?? "http_error",
      err?.message ?? "エラーが発生しました。時間をおいて再度お試しください",
      err?.details,
    );
  }
  return { data: payload as T, ms };
}
