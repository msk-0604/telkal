import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, isValidNormalizedPhone, normalizePhone } from "../src/phone";

describe("normalizePhone", () => {
  it.each([
    ["09012345678", "09012345678"],
    ["090-1234-5678", "09012345678"],
    ["０９０－１２３４－５６７８", "09012345678"],
    ["090 1234 5678", "09012345678"],
    ["(03)1234-5678", "0312345678"],
    ["+81 90-1234-5678", "09012345678"],
    ["090ー1234ー5678", "09012345678"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe("isValidNormalizedPhone", () => {
  it("10〜11桁の0始まりを許可", () => {
    expect(isValidNormalizedPhone("0312345678")).toBe(true);
    expect(isValidNormalizedPhone("09012345678")).toBe(true);
  });
  it("不正な番号を拒否", () => {
    expect(isValidNormalizedPhone("9012345678")).toBe(false);
    expect(isValidNormalizedPhone("090123")).toBe(false);
    expect(isValidNormalizedPhone("090123456789")).toBe(false);
  });
});

describe("formatPhoneForDisplay", () => {
  it("入力の区切り位置を尊重する", () => {
    expect(formatPhoneForDisplay("0465-12-3456", "0465123456")).toBe("0465-12-3456");
  });
  it("区切りがなければ代表的な形式に整形する", () => {
    expect(formatPhoneForDisplay("09012345678", "09012345678")).toBe("090-1234-5678");
    expect(formatPhoneForDisplay("0312345678", "0312345678")).toBe("03-1234-5678");
    expect(formatPhoneForDisplay("0120123456", "0120123456")).toBe("0120-123-456");
  });
});
