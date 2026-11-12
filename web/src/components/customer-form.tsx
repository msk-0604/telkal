"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { customerFormSchema, zodFieldErrors } from "@/lib/schemas";
import type { Customer } from "@/lib/types";
import { Alert, Field, TextInput } from "./ui";

export type CustomerFormValues = { name: string; phone: string; address: string };

export function useCustomerForm(initial: CustomerFormValues) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Customer[] | null>(null);

  function set<K extends keyof CustomerFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
    if (key === "phone") setDuplicates(null);
  }

  /** 送信前の検証。問題がなければ API に送る値を返す */
  function validate() {
    const parsed = customerFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return null;
    }
    setErrors({});
    setFormError(null);
    return { name: parsed.data.name, phone: parsed.data.phone, address: parsed.data.address || null };
  }

  /** API エラーを画面表示に反映 */
  function handleError(e: unknown) {
    if (e instanceof ApiError) {
      if (e.code === "duplicate_phone") {
        const list = (e.details as { customers?: Customer[] } | undefined)?.customers ?? [];
        setDuplicates(list);
        return;
      }
      setErrors(e.fieldErrors);
      setFormError(e.message);
    } else {
      setFormError("エラーが発生しました。時間をおいて再度お試しください");
    }
  }

  return { values, set, errors, formError, setFormError, duplicates, setDuplicates, validate, handleError };
}

export function CustomerFields({
  form,
  idPrefix,
}: {
  form: ReturnType<typeof useCustomerForm>;
  idPrefix: string;
}) {
  const { values, set, errors, formError } = form;
  return (
    <div className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <Field label="顧客名" required htmlFor={`${idPrefix}-name`} error={errors.name}>
        <TextInput
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
          autoComplete="off"
          placeholder="例：田中 一郎"
          maxLength={100}
        />
      </Field>
      <Field label="電話番号" required htmlFor={`${idPrefix}-phone`} error={errors.phone} hint="ハイフンはあってもなくても構いません">
        <TextInput
          id={`${idPrefix}-phone`}
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          error={errors.phone}
          inputMode="tel"
          type="tel"
          autoComplete="off"
          placeholder="例：090-1234-5678"
          maxLength={30}
        />
      </Field>
      <Field label="住所" htmlFor={`${idPrefix}-address`} error={errors.address}>
        <TextInput
          id={`${idPrefix}-address`}
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          error={errors.address}
          autoComplete="off"
          placeholder="例：東京都世田谷区桜新町1-2-3"
          maxLength={300}
        />
      </Field>
    </div>
  );
}

/** 電話番号の重複警告 */
export function DuplicateWarning({
  customers,
  onOpen,
  message,
}: {
  customers: Customer[];
  onOpen: (c: Customer) => void;
  message: string;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-800">{message}</p>
      <ul className="space-y-2">
        {customers.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{c.name}</p>
              <p className="truncate text-sm text-slate-500">
                {c.phone}
                {c.address ? `　${c.address}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpen(c)}
              className="shrink-0 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              この顧客を開く
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
