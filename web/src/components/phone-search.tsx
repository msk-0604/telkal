"use client";

import { ChevronRight, Phone, Search, UserPlus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { isValidNormalizedPhone, normalizePhone } from "@/lib/phone";
import type { Customer } from "@/lib/types";
import { useCreateCustomer } from "./create-customer";
import { CustomerView } from "./customer-view";
import { Alert, Button, Card, Spinner } from "./ui";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; query: string; customers: Customer[]; ms: number };

export function PhoneSearch() {
  const { openCreate } = useCreateCustomer();
  const initialPhone = useSearchParams().get("phone") ?? "";
  const [input, setInput] = useState(initialPhone);
  const initialValid = isValidNormalizedPhone(normalizePhone(initialPhone));
  const [inputError, setInputError] = useState<string | null>(null);
  const [state, setState] = useState<State>(() => (initialPhone && initialValid ? { kind: "loading" } : { kind: "idle" }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** API 検索（状態の更新は応答後のみ） */
  const fetchCustomers = useCallback((raw: string, normalized: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    api<{ customers: Customer[] }>(`/customers?phone=${encodeURIComponent(normalized)}`, {
      signal: ac.signal,
      label: "電話番号検索",
    }).then(
      ({ data, ms }) => {
        setState({ kind: "done", query: raw.trim(), customers: data.customers, ms });
        setSelectedId(data.customers.length === 1 ? data.customers[0]!.id : null);
        const url = new URL(window.location.href);
        url.searchParams.set("phone", normalized);
        window.history.replaceState(null, "", url);
      },
      (e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ kind: "error", message: e instanceof ApiError ? e.message : "検索に失敗しました" });
      },
    );
  }, []);

  function search(raw: string) {
    const normalized = normalizePhone(raw);
    if (!isValidNormalizedPhone(normalized)) {
      setInputError("電話番号の形式が正しくありません（0から始まる10〜11桁）");
      inputRef.current?.focus();
      return; // 不正な入力では API を呼ばない
    }
    setInputError(null);
    setState({ kind: "loading" });
    setSelectedId(null);
    fetchCustomers(raw, normalized);
  }

  // URL の ?phone= から検索を復元（戻る・再読み込み時）
  useEffect(() => {
    if (initialPhone && initialValid) fetchCustomers(initialPhone, normalizePhone(initialPhone));
    else inputRef.current?.focus();
    return () => abortRef.current?.abort();
    // 初回表示時のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCustomer = (c: Customer) =>
    setState((s) => (s.kind === "done" ? { ...s, customers: s.customers.map((x) => (x.id === c.id ? c : x)) } : s));

  const selected = state.kind === "done" ? state.customers.find((c) => c.id === selectedId) : undefined;

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-7">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            search(input);
          }}
          noValidate
        >
          <label htmlFor="phone-search" className="flex items-center gap-2 text-base font-semibold text-slate-800 sm:text-lg">
            <Phone className="size-5 text-blue-600" aria-hidden />
            電話番号で顧客を検索
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-3">
            <input
              ref={inputRef}
              id="phone-search"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (inputError) setInputError(null);
              }}
              placeholder="090-1234-5678"
              maxLength={30}
              aria-invalid={inputError ? true : undefined}
              aria-describedby={inputError ? "phone-search-error" : "phone-search-hint"}
              className={`h-14 w-full flex-1 rounded-lg border bg-white px-4 text-xl tracking-wide text-slate-800 placeholder:text-slate-300 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:h-16 sm:text-2xl ${inputError ? "border-red-400" : "border-slate-300"}`}
            />
            <Button type="submit" size="lg" className="h-14 sm:h-16 sm:w-36" loading={state.kind === "loading"}>
              {state.kind !== "loading" && <Search className="size-5" aria-hidden />}
              検索
            </Button>
          </div>
          {inputError ? (
            <p id="phone-search-error" className="mt-2 text-sm text-red-600">
              {inputError}
            </p>
          ) : (
            <p id="phone-search-hint" className="mt-2 text-xs text-slate-500">
              ハイフンはあってもなくても検索できます
            </p>
          )}
        </form>
      </Card>

      <div aria-live="polite">
        {state.kind === "loading" && <Spinner label="検索中" />}
        {state.kind === "error" && <Alert>{state.message}</Alert>}
        {state.kind === "done" && state.customers.length === 0 && (
          <Card className="px-5 py-8 text-center">
            <p className="text-lg font-semibold text-slate-800">該当する顧客が見つかりません</p>
            <p className="mt-1 text-sm text-slate-500">{state.query} は登録されていません</p>
            <Button className="mt-5" onClick={() => openCreate(state.query)}>
              <UserPlus className="size-4" aria-hidden />
              この電話番号で新規顧客を登録
            </Button>
          </Card>
        )}
        {state.kind === "done" && state.customers.length > 1 && (
          <Card className="mb-5">
            <p className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-600">
              {state.customers.length}件の顧客が見つかりました。対象の顧客を選択してください。
            </p>
            <ul className="divide-y divide-slate-100">
              {state.customers.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-pressed={c.id === selectedId}
                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-blue-50/50 ${c.id === selectedId ? "bg-blue-50" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{c.name}</p>
                      <p className="truncate text-sm text-slate-500">
                        {c.phone}
                        {c.address ? `　${c.address}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {selected && <CustomerView key={selected.id} customer={selected} onUpdated={updateCustomer} />}
      </div>
    </div>
  );
}
