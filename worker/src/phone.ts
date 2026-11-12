/**
 * 電話番号の正規化と表示用整形。
 * web/src/lib/phone.ts と同じロジックを保つこと。
 */

/** 全角数字・全角記号を半角にし、数字以外を除去。+81 は先頭 0 に置き換える。 */
export function normalizePhone(input: string): string {
  const half = input
    .normalize("NFKC")
    .replace(/[‐-―−ーｰ]/g, "-")
    .trim();
  let digits = half.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+81")) digits = "0" + digits.slice(3);
  return digits.replace(/\D/g, "");
}

/** 日本の電話番号として妥当か（0 始まり 10〜11 桁） */
export function isValidNormalizedPhone(digits: string): boolean {
  return /^0\d{9,10}$/.test(digits);
}

/**
 * 表示用の電話番号を作る。
 * 入力にハイフン等の区切りがあれば、その区切り位置を尊重する（市外局番の区切りは地域で異なるため）。
 * 区切りがなければ代表的な形式で整形する。
 */
export function formatPhoneForDisplay(input: string, normalized: string): string {
  const half = input.normalize("NFKC").replace(/[‐-―−ーｰ]/g, "-").trim();
  if (!half.startsWith("+")) {
    const groups = half.split(/[\s\-()（）]+/).filter(Boolean);
    if (groups.length >= 2 && groups.every((g) => /^\d+$/.test(g)) && groups.join("") === normalized) {
      return groups.join("-");
    }
  }
  const d = normalized;
  if (d.length === 11 && /^(0[5789]0)/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10 && /^(0120|0800)/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10 && /^0570/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
  if (d.length === 10 && /^0[36]/.test(d)) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}
