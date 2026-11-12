/**
 * 画面側の入力チェック（送信前に即時表示するため）。
 * 最終的な検証は Workers API 側（worker/src/schemas.ts）で必ず行う。
 */
import { z } from "zod";
import { isValidNormalizedPhone, normalizePhone } from "./phone";

export const phoneField = z
  .string()
  .trim()
  .min(1, { error: "電話番号を入力してください" })
  .max(30, { error: "電話番号が長すぎます" })
  .refine((v) => isValidNormalizedPhone(normalizePhone(v)), {
    error: "電話番号の形式が正しくありません（0から始まる10〜11桁）",
  });

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, { error: "顧客名を入力してください" }).max(100, { error: "顧客名は100文字以内で入力してください" }),
  phone: phoneField,
  address: z.string().trim().max(300, { error: "住所は300文字以内で入力してください" }),
});

export const recordFormSchema = z.object({
  title: z.string().trim().min(1, { error: "工事名を入力してください" }).max(200, { error: "工事名は200文字以内で入力してください" }),
  constructionDate: z.string().trim(),
  description: z.string().trim().max(5000, { error: "工事内容は5000文字以内で入力してください" }),
  address: z.string().trim().max(300, { error: "工事住所は300文字以内で入力してください" }),
  status: z.enum(["planned", "in_progress", "completed"], { error: "工事状態を選択してください" }),
  notes: z.string().trim().max(5000, { error: "備考は5000文字以内で入力してください" }),
});

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
