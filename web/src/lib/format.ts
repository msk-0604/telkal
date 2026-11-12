const dateTimeFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ISO 日時 → 2026/11/01 10:30 */
export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

/** ISO 日時 → 2026/11/01 */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** YYYY-MM-DD → 2026/11/01（未設定は「未定」） */
export function formatYmd(ymd: string | null): string {
  return ymd ? ymd.replaceAll("-", "/") : "未定";
}

export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
