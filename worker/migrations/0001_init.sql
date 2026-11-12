-- TELKAL 初期スキーマ
-- すべての業務データは organization_id を持ち、API は認証済みユーザーの
-- organization_id だけを条件にして読み書きする（企業間のデータ分離）。
-- D1 では外部キー制約は既定で有効。


CREATE TABLE organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  email            TEXT NOT NULL CHECK (email = lower(email)),
  password_hash    TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX users_email_uq ON users(email);
CREATE INDEX users_org_idx ON users(organization_id);

-- セッション。トークン本体は保存せず SHA-256 ハッシュのみ保存する。
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,           -- sha256(token) の16進
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

-- ログイン試行のレート制限（固定ウィンドウ）
CREATE TABLE login_attempts (
  key           TEXT PRIMARY KEY,         -- 'ip:<ip>' / 'email:<sha256>'
  window_start  INTEGER NOT NULL,         -- epoch 秒
  count         INTEGER NOT NULL
);

CREATE TABLE customers (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  phone             TEXT NOT NULL,        -- 表示用（例: 090-1234-5678）
  phone_normalized  TEXT NOT NULL CHECK (phone_normalized GLOB '0[0-9]*' AND length(phone_normalized) BETWEEN 10 AND 11),
  address           TEXT CHECK (address IS NULL OR length(address) <= 300),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  -- 工事履歴から (id, organization_id) の組で参照するための一意制約
  UNIQUE (id, organization_id)
);
-- 電話番号検索（企業ID + 正規化番号の完全一致）
CREATE INDEX customers_org_phone_idx ON customers(organization_id, phone_normalized);

CREATE TABLE construction_records (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id        TEXT NOT NULL,
  title              TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  construction_date  TEXT CHECK (construction_date IS NULL OR construction_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  description        TEXT CHECK (description IS NULL OR length(description) <= 5000),
  address            TEXT CHECK (address IS NULL OR length(address) <= 300),
  status             TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  notes              TEXT CHECK (notes IS NULL OR length(notes) <= 5000),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  -- 顧客と工事の企業IDが必ず一致するよう複合外部キーで縛る
  FOREIGN KEY (customer_id, organization_id)
    REFERENCES customers(id, organization_id) ON DELETE CASCADE
);
-- 顧客別の工事履歴（新しい順）
CREATE INDEX records_org_customer_date_idx
  ON construction_records(organization_id, customer_id, construction_date DESC, created_at DESC);
