"use client";

import { ChevronRight, ClipboardList, ExternalLink, MapPin, Pencil, Plus, RotateCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { formatDateTime, formatYmd, googleMapsUrl } from "@/lib/format";
import { STATUS_LABELS, type ConstructionRecord, type Customer, type RecordStatus } from "@/lib/types";
import { RecordForm } from "./record-form";
import { Alert, Button, Card, Modal, Spinner } from "./ui";

/** サーバーと同じ並び順（日付未定 → 新しい日付 → 新しい登録） */
function sortRecords(list: ConstructionRecord[]): ConstructionRecord[] {
  return [...list].sort((a, b) => {
    if (a.constructionDate === null && b.constructionDate !== null) return -1;
    if (a.constructionDate !== null && b.constructionDate === null) return 1;
    if (a.constructionDate !== b.constructionDate) return (b.constructionDate ?? "").localeCompare(a.constructionDate ?? "");
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  const style = {
    planned: "bg-amber-50 text-amber-700 ring-amber-200",
    in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  }[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}>{STATUS_LABELS[status]}</span>;
}

export function RecordsSection({ customer }: { customer: Customer }) {
  const [records, setRecords] = useState<ConstructionRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      api<{ records: ConstructionRecord[] }>(`/customers/${customer.id}/records`, { signal, label: "工事履歴" }).then(
        ({ data }) => setRecords(data.records),
        (e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError(e instanceof ApiError ? e.message : "工事履歴の取得に失敗しました");
        },
      );
    },
    [customer.id],
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const selected = records?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <ClipboardList className="size-5 text-blue-600" aria-hidden />
            工事履歴
            {records && <span className="text-base font-normal text-slate-500">（{records.length}件）</span>}
          </h2>
        </div>

        {notice && (
          <div className="px-5 pt-4">
            <Alert tone="success">{notice}</Alert>
          </div>
        )}

        {error ? (
          <div className="space-y-3 p-5">
            <Alert>{error}</Alert>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                setRecords(null);
                load();
              }}
            >
              <RotateCw className="size-4" aria-hidden />
              再読み込み
            </Button>
          </div>
        ) : records === null ? (
          <Spinner label="工事履歴を読み込み中" />
        ) : records.length === 0 ? (
          <p className="px-5 py-10 text-center text-slate-500">工事履歴はまだありません</p>
        ) : (
          <>
            {/* PC・タブレット：表 */}
            <table className="hidden w-full text-left sm:table">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="px-5 py-2.5 font-medium">工事名</th>
                  <th className="w-36 px-3 py-2.5 font-medium">工事日</th>
                  <th className="w-28 px-3 py-2.5 font-medium">状態</th>
                  <th className="w-10" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-blue-50/50"
                  >
                    <td className="px-5 py-3.5">
                      <button type="button" className="text-left font-medium text-slate-800 hover:text-blue-700" onClick={() => setSelectedId(r.id)}>
                        {r.title}
                      </button>
                    </td>
                    <td className="px-3 py-3.5 text-sm tabular-nums text-slate-700">{formatYmd(r.constructionDate)}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="pr-4 text-slate-400">
                      <ChevronRight className="size-4" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* スマートフォン：リスト */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {records.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelectedId(r.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{r.title}</p>
                      <p className="mt-1 flex items-center gap-2 text-sm tabular-nums text-slate-500">
                        {formatYmd(r.constructionDate)}
                        <StatusBadge status={r.status} />
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {adding ? (
        <Card className="p-5 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">新しい工事を追加</h3>
          <RecordForm
            mode="create"
            customerId={customer.id}
            defaultAddress={customer.address}
            onCancel={() => setAdding(false)}
            onSaved={(r) => {
              setRecords((list) => sortRecords([r, ...(list ?? [])]));
              setAdding(false);
              setNotice(`「${r.title}」を登録しました`);
            }}
          />
        </Card>
      ) : (
        <Button
          variant="secondary"
          size="lg"
          className="w-full border-dashed border-blue-300 text-blue-700 hover:bg-blue-50"
          onClick={() => {
            setNotice(null);
            setAdding(true);
          }}
        >
          <Plus className="size-5" aria-hidden />
          新しい工事を追加
        </Button>
      )}

      {selected && (
        <RecordDialog
          key={selected.id}
          record={selected}
          customerId={customer.id}
          onClose={() => setSelectedId(null)}
          onUpdated={(r) => {
            setRecords((list) => sortRecords((list ?? []).map((x) => (x.id === r.id ? r : x))));
          }}
        />
      )}
    </div>
  );
}

function RecordDialog({
  record: initial,
  customerId,
  onClose,
  onUpdated,
}: {
  record: ConstructionRecord;
  customerId: string;
  onClose: () => void;
  onUpdated: (r: ConstructionRecord) => void;
}) {
  const [record, setRecord] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 一覧の内容をすぐ表示しつつ、最新の詳細を取得する
  useEffect(() => {
    const ac = new AbortController();
    api<{ record: ConstructionRecord }>(`/records/${initial.id}`, { signal: ac.signal, label: "工事詳細" })
      .then(({ data }) => {
        setRecord(data.record);
        onUpdated(data.record);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "工事情報の取得に失敗しました");
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "工事情報を編集" : "工事の詳細"}
      footer={
        editing ? undefined : (
          <>
            <Button variant="secondary" onClick={onClose}>
              閉じる
            </Button>
            <Button
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              <Pencil className="size-4" aria-hidden />
              編集
            </Button>
          </>
        )
      }
    >
      {editing ? (
        <RecordForm
          mode="edit"
          customerId={customerId}
          record={record}
          onCancel={() => setEditing(false)}
          onSaved={(r) => {
            setRecord(r);
            onUpdated(r);
            setEditing(false);
            setSaved(true);
          }}
        />
      ) : (
        <div className="space-y-5">
          {error && <Alert>{error}</Alert>}
          {saved && <Alert tone="success">工事情報を更新しました</Alert>}
          <div>
            <p className="text-xs font-medium text-slate-500">工事名</p>
            <p className="mt-0.5 break-words text-xl font-bold text-slate-800">{record.title}</p>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-slate-500">工事日</dt>
              <dd className="mt-1 tabular-nums text-slate-800">{formatYmd(record.constructionDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">工事状態</dt>
              <dd className="mt-1">
                <StatusBadge status={record.status} />
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-slate-500">工事住所</dt>
              <dd className="mt-1 text-slate-800">
                {record.address ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="break-words">{record.address}</span>
                    <a
                      href={googleMapsUrl(record.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                    >
                      <MapPin className="size-4" aria-hidden />
                      Googleマップ
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </div>
                ) : (
                  <span className="text-slate-400">未登録</span>
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-slate-500">工事内容</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-slate-800">{record.description || <span className="text-slate-400">未入力</span>}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-slate-500">備考</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-slate-800">{record.notes || <span className="text-slate-400">未入力</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">登録日</dt>
              <dd className="mt-1 text-sm text-slate-600">{formatDateTime(record.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">最終更新日</dt>
              <dd className="mt-1 text-sm text-slate-600">{formatDateTime(record.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  );
}
