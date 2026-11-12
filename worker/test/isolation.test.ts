/**
 * 認証と企業間データ分離の結合テスト
 *
 * 事前準備（別ターミナル）:
 *   npm run db:migrate:local && npm run db:seed:local && npm run dev
 * 実行:
 *   npm run test:api
 *
 * TELKAL_API_TEST_URL（既定: http://localhost:8787）の Worker に対して実行します。
 * ローカルのテスト用データを書き換えるため、本番 URL には絶対に向けないでください。
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.TELKAL_API_TEST_URL ?? "http://localhost:8787";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  throw new Error("結合テストはローカルの Worker に対してのみ実行できます");
}
const SECRET = /INTERNAL_API_SECRET=(.+)/.exec(readFileSync(new URL("../.dev.vars", import.meta.url), "utf8"))?.[1]?.trim() ?? "";

async function call(path: string, init: { method?: string; token?: string; body?: unknown; secret?: string | null } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = init.secret === undefined ? SECRET : init.secret;
  if (secret) headers["x-telkal-internal-secret"] = secret;
  if (init.token) headers["x-telkal-session"] = init.token;
  const res = await fetch(BASE + path, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function login(email: string, password: string): Promise<string> {
  const r = await call("/v1/auth/login", { method: "POST", body: { email, password } });
  expect(r.status).toBe(200);
  return r.body.token;
}

let tokenA = "";
let tokenB = "";
let customerA = "";
let recordA = "";

beforeAll(async () => {
  tokenA = await login("demo@example.com", "telkal-demo-2026");
  tokenB = await login("other@example.com", "telkal-other-2026");
  const created = await call("/v1/customers", {
    method: "POST",
    token: tokenA,
    body: { name: "分離テスト顧客", phone: `080${String(Date.now()).slice(-8)}`, address: "テスト住所" },
  });
  expect(created.status).toBe(201);
  customerA = created.body.customer.id;
  const rec = await call(`/v1/customers/${customerA}/records`, {
    method: "POST",
    token: tokenA,
    body: { title: "分離テスト工事", status: "planned" },
  });
  expect(rec.status).toBe(201);
  recordA = rec.body.record.id;
});

describe("認証", () => {
  it("内部用の秘密値がないと拒否", async () => {
    expect((await call("/v1/auth/me", { token: tokenA, secret: null })).status).toBe(401);
  });
  it("秘密値が誤っていると拒否", async () => {
    expect((await call("/v1/auth/me", { token: tokenA, secret: "x".repeat(43) })).status).toBe(401);
  });
  it("セッションがないと拒否", async () => {
    expect((await call("/v1/customers?phone=09012345678")).status).toBe(401);
  });
  it("不正なセッションは拒否", async () => {
    expect((await call("/v1/customers?phone=09012345678", { token: "invalid" })).status).toBe(401);
  });
  it("誤ったパスワードは 401", async () => {
    const r = await call("/v1/auth/login", { method: "POST", body: { email: "demo@example.com", password: "wrong" } });
    expect(r.status).toBe(401);
  });
  it("ログアウトしたセッションは使えない", async () => {
    const t = await login("demo@example.com", "telkal-demo-2026");
    expect((await call("/v1/auth/logout", { method: "POST", token: t })).status).toBe(200);
    expect((await call("/v1/auth/me", { token: t })).status).toBe(401);
  });
});

describe("企業間のデータ分離", () => {
  it("同じ電話番号でも自社の顧客だけが検索される", async () => {
    const a = await call("/v1/customers?phone=090-1234-5678", { token: tokenA });
    const b = await call("/v1/customers?phone=09012345678", { token: tokenB });
    expect(a.body.customers.map((c: any) => c.name)).toEqual(["田中 一郎"]);
    expect(b.body.customers.map((c: any) => c.name)).toEqual(["別会社の顧客"]);
  });
  it("他社の顧客は取得・更新できない", async () => {
    expect((await call(`/v1/customers/${customerA}`, { token: tokenB })).status).toBe(404);
    const upd = await call(`/v1/customers/${customerA}`, {
      method: "PATCH",
      token: tokenB,
      body: { name: "乗っ取り", phone: "09000000000", address: null },
    });
    expect(upd.status).toBe(404);
    expect((await call(`/v1/customers/${customerA}`, { token: tokenA })).body.customer.name).toBe("分離テスト顧客");
  });
  it("他社の工事履歴は一覧・取得・追加・更新できない", async () => {
    expect((await call(`/v1/customers/${customerA}/records`, { token: tokenB })).status).toBe(404);
    expect((await call(`/v1/records/${recordA}`, { token: tokenB })).status).toBe(404);
    expect(
      (await call(`/v1/customers/${customerA}/records`, { method: "POST", token: tokenB, body: { title: "x" } })).status,
    ).toBe(404);
    expect(
      (await call(`/v1/records/${recordA}`, { method: "PATCH", token: tokenB, body: { title: "x", status: "completed" } }))
        .status,
    ).toBe(404);
    expect((await call(`/v1/records/${recordA}`, { token: tokenA })).body.record.title).toBe("分離テスト工事");
  });
  it("本文で企業IDを指定しても無視される", async () => {
    const r = await call("/v1/customers", {
      method: "POST",
      token: tokenB,
      body: { name: "企業ID指定", phone: "07011112222", organizationId: "other", organization_id: "other", allowDuplicate: true },
    });
    expect(r.status).toBe(201);
    expect((await call(`/v1/customers/${r.body.customer.id}`, { token: tokenA })).status).toBe(404);
    expect((await call(`/v1/customers/${r.body.customer.id}`, { token: tokenB })).status).toBe(200);
  });
});

describe("入力値検証と重複", () => {
  it("不正な電話番号は 400", async () => {
    expect((await call("/v1/customers?phone=123", { token: tokenA })).status).toBe(400);
  });
  it("顧客名なしは 400", async () => {
    const r = await call("/v1/customers", { method: "POST", token: tokenA, body: { name: "", phone: "09099998888" } });
    expect(r.status).toBe(400);
    expect(r.body.error.details.name).toBeTruthy();
  });
  it("同じ電話番号は 409 で既存顧客を返し、確認後は登録できる", async () => {
    const r = await call("/v1/customers", { method: "POST", token: tokenA, body: { name: "重複", phone: "09012345678" } });
    expect(r.status).toBe(409);
    expect(r.body.error.details.customers[0].name).toBe("田中 一郎");
  });
  it("不正な工事状態・日付は 400", async () => {
    const bad = await call(`/v1/customers/${customerA}/records`, {
      method: "POST",
      token: tokenA,
      body: { title: "x", status: "unknown", constructionDate: "2026-02-30" },
    });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.details).sort()).toEqual(["constructionDate", "status"]);
  });
  it("SQL として解釈されそうな文字列もそのまま保存される", async () => {
    const title = "'; DROP TABLE customers; --";
    const r = await call(`/v1/records/${recordA}`, { method: "PATCH", token: tokenA, body: { title, status: "in_progress" } });
    expect(r.status).toBe(200);
    expect(r.body.record.title).toBe(title);
  });
});
