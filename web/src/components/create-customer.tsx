"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { Customer } from "@/lib/types";
import { CustomerFields, DuplicateWarning, useCustomerForm } from "./customer-form";
import { Button, Modal } from "./ui";

type Ctx = { openCreate: (phone?: string) => void };
const CreateCustomerContext = createContext<Ctx | null>(null);

export function useCreateCustomer(): Ctx {
  const ctx = use(CreateCustomerContext);
  if (!ctx) throw new Error("CreateCustomerProvider が必要です");
  return ctx;
}

export function CreateCustomerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; phone: string; key: number }>({ open: false, phone: "", key: 0 });
  const openCreate = useCallback((phone = "") => setState((s) => ({ open: true, phone, key: s.key + 1 })), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  return (
    <CreateCustomerContext value={{ openCreate }}>
      {children}
      {state.open && <CreateCustomerModal key={state.key} initialPhone={state.phone} onClose={close} />}
    </CreateCustomerContext>
  );
}

function CreateCustomerModal({ initialPhone, onClose }: { initialPhone: string; onClose: () => void }) {
  const router = useRouter();
  const form = useCustomerForm({ name: "", phone: initialPhone, address: "" });
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
      const { data } = await api<{ customer: Customer }>("/customers", {
        method: "POST",
        body: { ...body, allowDuplicate },
        label: "顧客登録",
      });
      onClose();
      router.push(`/customers/${data.customer.id}?created=1`);
    } catch (e) {
      form.handleError(e);
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const dupes = form.duplicates;
  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={submitting}
      title="新しい顧客を作成"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          {dupes && dupes.length > 0 ? (
            <Button onClick={() => submit(true)} loading={submitting}>
              重複を承知で登録する
            </Button>
          ) : (
            <Button type="submit" form="create-customer-form" loading={submitting}>
              登録する
            </Button>
          )}
        </>
      }
    >
      <form
        id="create-customer-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
        className="space-y-4"
      >
        <CustomerFields form={form} idPrefix="create" />
        {dupes && dupes.length > 0 && (
          <DuplicateWarning
            customers={dupes}
            message="この電話番号の顧客はすでに登録されています。既存の顧客に工事を追加する場合は、顧客を開いてください。"
            onOpen={(c) => {
              onClose();
              router.push(`/customers/${c.id}`);
            }}
          />
        )}
      </form>
    </Modal>
  );
}

export function CreateCustomerButton() {
  const { openCreate } = useCreateCustomer();
  return (
    <Button onClick={() => openCreate()} size="md" className="px-3 sm:px-4">
      <Plus className="size-4" aria-hidden />
      <span className="sm:hidden">新規顧客</span>
      <span className="hidden sm:inline">新しい顧客を作成</span>
    </Button>
  );
}
