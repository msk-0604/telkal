// ローカル D1 にテスト用データを投入する（本番には使わないこと）
//   npm run db:seed:local
// 2社（企業間のデータ分離の確認用）、各社1ユーザー、顧客と工事履歴を作成します。
// 既存のローカルデータはすべて置き換えます。
import { executeSql, hashPassword, q, randomUUID } from "./lib.mjs";

const now = new Date().toISOString();
const orgs = [
  { id: randomUUID(), name: "山田工務店（テスト）", user: { name: "山田 太郎", email: "demo@example.com", password: "telkal-demo-2026" } },
  { id: randomUUID(), name: "別会社建設（テスト）", user: { name: "佐藤 次郎", email: "other@example.com", password: "telkal-other-2026" } },
];

const customers = [
  {
    name: "田中 一郎",
    phone: "090-1234-5678",
    address: "東京都世田谷区桜新町1-2-3",
    records: [
      { title: "給水管交換工事", date: "2026-11-01", status: "completed", description: "台所下の給水管の老朽化に伴う交換" },
      { title: "トイレ改修工事", date: "2026-09-15", status: "completed", description: "便器交換・床材張り替え" },
      { title: "排水管修繕工事", date: "2026-07-20", status: "completed", description: "浴室排水管の詰まり解消と一部交換" },
    ],
  },
  {
    name: "鈴木 花子",
    phone: "03-1234-5678",
    address: "東京都品川区大井4-5-6",
    records: [{ title: "外壁塗装工事", date: "2026-12-05", status: "planned", description: "外壁全面の塗り替え" }],
  },
  { name: "高橋 建設事務所", phone: "045-123-4567", address: "神奈川県横浜市中区本町7-8", records: [] },
];

const sql = [
  "DELETE FROM construction_records;",
  "DELETE FROM customers;",
  "DELETE FROM sessions;",
  "DELETE FROM login_attempts;",
  "DELETE FROM users;",
  "DELETE FROM organizations;",
];
for (const org of orgs) {
  sql.push(
    `INSERT INTO organizations (id, name, created_at, updated_at) VALUES (${q(org.id)}, ${q(org.name)}, ${q(now)}, ${q(now)});`,
    `INSERT INTO users (id, organization_id, name, email, password_hash, created_at, updated_at) VALUES (${q(randomUUID())}, ${q(org.id)}, ${q(org.user.name)}, ${q(org.user.email)}, ${q(hashPassword(org.user.password))}, ${q(now)}, ${q(now)});`,
  );
}
for (const c of customers) {
  const id = randomUUID();
  sql.push(
    `INSERT INTO customers (id, organization_id, name, phone, phone_normalized, address, created_at, updated_at) VALUES (${q(id)}, ${q(orgs[0].id)}, ${q(c.name)}, ${q(c.phone)}, ${q(c.phone.replace(/\D/g, ""))}, ${q(c.address)}, ${q(now)}, ${q(now)});`,
  );
  for (const r of c.records) {
    sql.push(
      `INSERT INTO construction_records (id, organization_id, customer_id, title, construction_date, description, address, status, notes, created_at, updated_at) VALUES (${q(randomUUID())}, ${q(orgs[0].id)}, ${q(id)}, ${q(r.title)}, ${q(r.date)}, ${q(r.description)}, ${q(c.address)}, ${q(r.status)}, NULL, ${q(now)}, ${q(now)});`,
    );
  }
}
// 2社目には 1社目と同じ電話番号の別顧客を入れる（企業間で混ざらないことの確認用）
sql.push(
  `INSERT INTO customers (id, organization_id, name, phone, phone_normalized, address, created_at, updated_at) VALUES (${q(randomUUID())}, ${q(orgs[1].id)}, ${q("別会社の顧客")}, ${q("090-1234-5678")}, ${q("09012345678")}, ${q("大阪府大阪市北区梅田1-1")}, ${q(now)}, ${q(now)});`,
);

executeSql(sql);
console.log("\nテスト用ログイン:");
for (const o of orgs) console.log(`  ${o.name}: ${o.user.email} / ${o.user.password}`);
