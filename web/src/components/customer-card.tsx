"use client";

import { ExternalLink, MapPin, Pencil, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { formatDateTime, googleMapsUrl } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { CustomerFields, DuplicateWarning, useCustomerForm } from "./customer-form";
import { Alert, Button, Card } from "./ui";

export function CustomerCard({ customer, onUpdated }: { customer: Customer; onUpdated: (c: Customer) => void }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  if (editing) {
    return (
      <CustomerEditCard
        customer={customer}
        onCancel={() => setEditing(false)}
        onSaved={(c) => {
          onUpdated(c);
          setEditing(false);
          setSaved(true);
        }}
      />
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">顧客名</p>
          <h2 className="mt-0.5 break-words text-2xl font-bold text-slate-800">{customer.name}</h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setSaved(false);
            setEditing(true);
          }}
        >
          <Pencil className="size-4" aria-hidden />
          編集
        </Button>
      </div>

      {saved && (
        <div className="mt-4">
          <Alert tone="success">顧客情報を更新しました</Alert>
        </div>
      )}

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-xs font-medium text-slate-500">電話番号</dt>
          <dd>
            <a href={`tel:${customer.phoneNormalized}`} className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-wide text-slate-800 hover:text-blue-700">
              <Phone className="size-4 text-blue-600" aria-hidden />
              {customer.phone}
            </a>
          </dd>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <dt className="text-xs font-medium text-slate-500">住所</dt>
          <dd className="text-slate-800">
            {customer.address ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="break-words">{customer.address}</span>
                <a
                  href={googleMapsUrl(customer.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                >
                  <MapPin className="size-4" aria-hidden />
                  Googleマップで開く
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
            ) : (
              <span className="text-slate-400">未登録</span>
            )}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs font-medium text-slate-500">登録日</dt>
          <dd className="text-sm text-slate-700">{formatDateTime(customer.createdAt)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs font-medium text-slate-500">最終更新日</dt>
          <dd className="text-sm text-slate-700">{formatDateTime(customer.updatedAt)}</dd>
        </div>
      </dl>
    </Card>
  );
}

function CustomerEditCard({
  customer,
  onCancel,
  onSaved,
}: {
  customer: Customer;
  onCancel: () => void;
  onSaved: (c: Customer) => void;
}) {
  const router = useRouter();
  const form = useCustomerForm({ name: customer.name, phone: customer.phone, address: customer.address ?? "" });
  const [submitting, setSubmitting] = useState(false);
  // 同じタイミングの連続クリックでも二重送信しないよう、描画を待たずに判定する
  const submitLock = useRef(false);

  async function submit(allowDuplicate: boolean) {
    if (submitLock.current) return; // 二重送信防止
    const body = form.validate();
    if (!body) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const { data } = await api<{ customer: Customer }>(`/customers/${customer.id}`, {
        method: "PATCH",
        body: { ...body, allowDuplicate },
        label: "顧客更新",
      });
      onSaved(data.customer);
    } catch (e) {
      form.handleError(e);
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const dupes = form.duplicates;
  return (
    <Card className="p-5 sm:p-6">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
        className="space-y-4"
      >
        <h2 className="text-lg font-semibold text-slate-800">顧客情報を編集</h2>
        <CustomerFields form={form} idPrefix={`edit-${customer.id}`} />
        {dupes && dupes.length > 0 && (
          <DuplicateWarning
            customers={dupes}
            message="この電話番号は別の顧客で登録されています。"
            onOpen={(c) => router.push(`/customers/${c.id}`)}
          />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            キャンセル
          </Button>
          {dupes && dupes.length > 0 ? (
            <Button type="button" onClick={() => submit(true)} loading={submitting}>
              重複を承知で保存する
            </Button>
          ) : (
            <Button type="submit" loading={submitting}>
              保存する
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
