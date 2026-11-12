"use client";

import { Building2, LogOut, Timer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onApiTiming } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/types";

export function UserMenu({ me }: { me: CurrentUser }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-48 items-center gap-1.5 truncate text-sm text-slate-600 md:inline-flex" title={`${me.organization.name} / ${me.user.name}`}>
        <Building2 className="size-4 shrink-0 text-slate-400" aria-hidden />
        <span className="truncate">{me.organization.name}</span>
      </span>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="inline-flex h-10 items-center gap-1 rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        aria-label="ログアウト"
        title="ログアウト"
      >
        <LogOut className="size-4" aria-hidden />
        <span className="hidden lg:inline">ログアウト</span>
      </button>
    </div>
  );
}

export function HomeLink() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600" aria-label="TELKAL ホーム">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.png"
        alt=""
        width={32}
        height={32}
        className="size-8"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      <span className="text-xl font-extrabold tracking-wider text-blue-700">TELKAL</span>
    </Link>
  );
}

/** 直近の API 応答時間（性能目標 500ms の確認用） */
export function ApiTimingIndicator() {
  const [last, setLast] = useState<{ label: string; ms: number } | null>(null);
  useEffect(() => onApiTiming(setLast) as () => void, []);
  if (!last) return null;
  const slow = last.ms > 500;
  return (
    <p className="flex items-center justify-center gap-1 text-xs text-slate-400" aria-live="off">
      <Timer className="size-3.5" aria-hidden />
      {last.label}：
      <span className={slow ? "font-semibold text-amber-600" : ""}>{last.ms}ms</span>
    </p>
  );
}
