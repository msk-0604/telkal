"use client";

import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
  ghost: "text-slate-600 hover:bg-slate-100 active:bg-slate-200",
};
const buttonSizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-14 px-6 text-base" };

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: keyof typeof buttonSizes; loading?: boolean }) {
  return (
    <button
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const controlBase =
  "w-full rounded-lg border bg-white px-3 text-[16px] text-slate-800 placeholder:text-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50";

function controlBorder(error?: string) {
  return error ? "border-red-400" : "border-slate-300";
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">必須</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ error, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      className={`${controlBase} ${controlBorder(error)} h-11 ${className}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function TextArea({ error, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <textarea
      className={`${controlBase} ${controlBorder(error)} min-h-24 py-2.5 leading-relaxed ${className}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function Select({ error, className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select className={`${controlBase} ${controlBorder(error)} h-11 ${className}`} aria-invalid={error ? true : undefined} {...props}>
      {children}
    </select>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${styles}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Spinner({ label = "読み込み中" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500" role="status">
      <Loader2 className="size-5 animate-spin text-blue-600" aria-hidden />
      {label}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</section>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeDisabled,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  closeDisabled?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("input, textarea, select, button[data-autofocus]");
    (first ?? panelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => !closeDisabled && onClose()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:max-w-lg sm:rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="-mr-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="閉じる"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
