"use client";

import { ArrowLeft, RotateCw } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import type { Customer } from "@/lib/types";
import { CustomerView } from "./customer-view";
import { Alert, Button, Spinner } from "./ui";

export function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [created] = useState(() => searchParams.get("created") === "1");

  const load = useCallback(
    (signal?: AbortSignal) => {
      api<{ customer: Customer }>(`/customers/${id}`, { signal, label: "顧客情報" }).then(
        ({ data }) => setCustomer(data.customer),
        (e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError({
            message: e instanceof ApiError ? e.message : "顧客情報の取得に失敗しました",
            notFound: e instanceof ApiError && e.status === 404,
          });
        },
      );
    },
    [id],
  );

  useEffect(() => {
    // 「登録しました」表示用のパラメータは URL から取り除く（再読み込みで再表示しない）
    const url = new URL(window.location.href);
    if (url.searchParams.has("created")) {
      url.searchParams.delete("created");
      window.history.replaceState(null, "", url);
    }
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        電話番号検索に戻る
      </Link>
      {created && <Alert tone="success">顧客を登録しました。続けて工事を追加できます。</Alert>}
      {error ? (
        <div className="space-y-3">
          <Alert>{error.message}</Alert>
          {!error.notFound && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                load();
              }}
            >
              <RotateCw className="size-4" aria-hidden />
              再読み込み
            </Button>
          )}
        </div>
      ) : customer ? (
        <CustomerView customer={customer} onUpdated={setCustomer} />
      ) : (
        <Spinner label="顧客情報を読み込み中" />
      )}
    </div>
  );
}
