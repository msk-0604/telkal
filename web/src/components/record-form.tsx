"use client";

import { useRef, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { recordFormSchema, zodFieldErrors } from "@/lib/schemas";
import type { ConstructionRecord, RecordStatus } from "@/lib/types";
import { Alert, Button, Field, TextArea, TextInput } from "./ui";

type Values = {
  title: string;
  constructionDate: string;
  description: string;
  address: string;
  /** 画面には表示しないが、既存の値を保ったまま送る */
  status: RecordStatus;
  notes: string;
};

export function RecordForm({
  mode,
  customerId,
  record,
  defaultAddress,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  customerId: string;
  record?: ConstructionRecord;
  defaultAddress?: string | null;
  onSaved: (r: ConstructionRecord) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => ({
    title: record?.title ?? "",
    constructionDate: record?.constructionDate ?? "",
    description: record?.description ?? "",
    address: record ? (record.address ?? "") : (defaultAddress ?? ""),
    status: record?.status ?? "planned",
    notes: record?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 同じタイミングの連続クリックでも二重送信しないよう、描画を待たずに判定する
  const submitLock = useRef(false);
  const idp = record ? `rec-${record.id}` : "rec-new";

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function submit() {
    if (submitLock.current) return; // 二重送信防止
    const parsed = recordFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    submitLock.current = true;
    setSubmitting(true);
    const d = parsed.data;
    const body = {
      title: d.title,
      constructionDate: d.constructionDate || null,
      description: d.description || null,
      address: d.address || null,
      status: d.status,
      notes: d.notes || null,
    };
    try {
      const { data } =
        mode === "create"
          ? await api<{ record: ConstructionRecord }>(`/customers/${customerId}/records`, {
              method: "POST",
              body,
              label: "工事登録",
            })
          : await api<{ record: ConstructionRecord }>(`/records/${record!.id}`, {
              method: "PATCH",
              body,
              label: "工事更新",
            });
      onSaved(data.record);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        setFormError(e.message);
      } else {
        setFormError("エラーが発生しました。時間をおいて再度お試しください");
      }
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
    >
      {formError && <Alert>{formError}</Alert>}
      <Field label="工事名" required htmlFor={`${idp}-title`} error={errors.title}>
        <TextInput
          id={`${idp}-title`}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          error={errors.title}
          placeholder="例：給水管交換工事"
          maxLength={200}
          autoComplete="off"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="工事日" htmlFor={`${idp}-date`} error={errors.constructionDate} hint="未定の場合は空欄">
          <TextInput
            id={`${idp}-date`}
            type="date"
            value={values.constructionDate}
            onChange={(e) => set("constructionDate", e.target.value)}
            error={errors.constructionDate}
          />
        </Field>
      </div>
      <Field label="工事住所" htmlFor={`${idp}-address`} error={errors.address} hint={mode === "create" ? "顧客の住所を初期値にしています" : undefined}>
        <TextInput
          id={`${idp}-address`}
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          error={errors.address}
          maxLength={300}
          autoComplete="off"
        />
      </Field>
      <Field label="工事内容" htmlFor={`${idp}-description`} error={errors.description}>
        <TextArea
          id={`${idp}-description`}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          error={errors.description}
          rows={4}
          maxLength={5000}
        />
      </Field>
      <Field label="備考" htmlFor={`${idp}-notes`} error={errors.notes}>
        <TextArea
          id={`${idp}-notes`}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          error={errors.notes}
          rows={3}
          maxLength={5000}
        />
      </Field>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          キャンセル
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === "create" ? "登録する" : "保存する"}
        </Button>
      </div>
    </form>
  );
}
