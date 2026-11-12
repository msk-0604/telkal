import type { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function errorResponse(err: HttpError): Response {
  return json(
    { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
    err.status,
  );
}

/** Zod のエラーを { フィールド名: メッセージ } に変換 */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function readJson(request: Request): Promise<unknown> {
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > 64 * 1024) throw new HttpError(413, "payload_too_large", "送信データが大きすぎます");
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "リクエストの形式が正しくありません");
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
