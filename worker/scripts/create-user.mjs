// 企業とユーザーを作成する
//   TELKAL_PASSWORD='...' npm run user:create -- --org "株式会社〇〇" --name "山田 太郎" --email you@example.com
//   既存の企業に追加: --org-id <企業ID>
//   本番 D1 に書き込む: --remote（実行前に必ず確認してください）
// パスワードはシェル履歴に残りにくいよう、引数ではなく環境変数 TELKAL_PASSWORD で渡します。
import { parseArgs } from "node:util";
import { executeSql, hashPassword, q, randomUUID } from "./lib.mjs";

const { values } = parseArgs({
  options: {
    org: { type: "string" },
    "org-id": { type: "string" },
    name: { type: "string" },
    email: { type: "string" },
    remote: { type: "boolean", default: false },
  },
});
const password = process.env.TELKAL_PASSWORD;
if (!values.name || !values.email || (!values.org && !values["org-id"]) || !password) {
  console.error('使い方: TELKAL_PASSWORD=... npm run user:create -- --org "会社名" --name "氏名" --email メール [--remote]');
  process.exit(1);
}
if (password.length < 10) {
  console.error("パスワードは10文字以上にしてください");
  process.exit(1);
}
const now = new Date().toISOString();
const orgId = values["org-id"] ?? randomUUID();
const sql = [];
if (!values["org-id"]) {
  sql.push(`INSERT INTO organizations (id, name, created_at, updated_at) VALUES (${q(orgId)}, ${q(values.org)}, ${q(now)}, ${q(now)});`);
}
sql.push(
  `INSERT INTO users (id, organization_id, name, email, password_hash, created_at, updated_at) VALUES (${q(randomUUID())}, ${q(orgId)}, ${q(values.name)}, ${q(values.email.trim().toLowerCase())}, ${q(hashPassword(password))}, ${q(now)}, ${q(now)});`,
);
executeSql(sql, { remote: values.remote });
console.log(`作成しました（企業ID: ${orgId}）`);
