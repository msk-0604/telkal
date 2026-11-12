import { z } from "zod";
import { isValidNormalizedPhone, normalizePhone } from "./phone";

/** 前後の空白を除き、空文字は null にする任意テキスト */
const optionalText = (max: number, label: string) =>
  z
    .string({ error: `${label}は文字列で入力してください` })
    .trim()
    .max(max, { error: `${label}は${max}文字以内で入力してください` })
    .nullish()
    .transform((v) => (v ? v : null));

const phoneInput = z
  .string({ error: "電話番号を入力してください" })
  .trim()
  .min(1, { error: "電話番号を入力してください" })
  .max(30, { error: "電話番号が長すぎます" })
  .refine((v) => isValidNormalizedPhone(normalizePhone(v)), {
    error: "電話番号の形式が正しくありません（0から始まる10〜11桁）",
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ error: "メールアドレスの形式が正しくありません" }).max(254),
  password: z.string().min(1, { error: "パスワードを入力してください" }).max(200),
});

export const phoneSearchSchema = z.object({ phone: phoneInput });

export const customerCreateSchema = z.object({
  name: z
    .string({ error: "顧客名を入力してください" })
    .trim()
    .min(1, { error: "顧客名を入力してください" })
    .max(100, { error: "顧客名は100文字以内で入力してください" }),
  phone: phoneInput,
  address: optionalText(300, "住所"),
  /** 同じ電話番号の顧客がいても登録する（ユーザーが警告を確認した場合のみ true） */
  allowDuplicate: z.boolean().optional().default(false),
});

export const customerUpdateSchema = customerCreateSchema;

export const RECORD_STATUSES = ["planned", "in_progress", "completed"] as const;

const dateString = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)), {
    error: "工事日の形式が正しくありません",
  });

export const recordCreateSchema = z.object({
  title: z
    .string({ error: "工事名を入力してください" })
    .trim()
    .min(1, { error: "工事名を入力してください" })
    .max(200, { error: "工事名は200文字以内で入力してください" }),
  constructionDate: dateString,
  description: optionalText(5000, "工事内容"),
  address: optionalText(300, "工事住所"),
  status: z.enum(RECORD_STATUSES, { error: "工事状態を選択してください" }).default("planned"),
  notes: optionalText(5000, "備考"),
});

export const recordUpdateSchema = recordCreateSchema;

export const idSchema = z.string().uuid();
