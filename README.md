# TELKAL（テルカル）

建設業向けの顧客情報・工事履歴管理 Web システム。電話番号から顧客を探し、工事履歴をすぐに確認・追加できます。

## 構成

```
telkal/
├── web/      Next.js（App Router）… 画面と BFF（Vercel にデプロイ）
└── worker/   Cloudflare Workers + D1 … データベースアクセス用 API
```

```
ブラウザ ──(httpOnly Cookie)──▶ Next.js サーバー（/api/*）──(内部用秘密値 + セッション)──▶ Workers API ──▶ D1
```

- ブラウザが通信するのは Next.js だけです。Workers の URL と内部用の秘密値はブラウザに渡しません。
- Workers は `x-telkal-internal-secret`（Next.js サーバーとだけ共有）がないリクエストをすべて拒否します。

### 認証と企業間のデータ分離

- メールアドレス＋パスワード（PBKDF2-SHA256、10万回）で認証します。セッションは D1 で管理し、トークンは SHA-256 ハッシュだけを保存します。
- セッショントークンは `telkal_session` Cookie に入れます（httpOnly / SameSite=Lax / 本番は Secure）。
- **企業ID は Workers 側でセッションから確定します。** リクエスト本文やクエリの企業ID は一切使いません。
- すべての SQL は `organization_id = <セッションの企業>` を条件にしています。他社の ID を指定した場合は 404 を返します（存在も明かしません）。
- `construction_records` は `(customer_id, organization_id)` の複合外部キーで顧客を参照するため、DB レベルでも顧客と工事の企業が必ず一致します。
- ログインのレート制限：メールアドレスごとに15分で10回、IP ごとに15分で50回まで。
- 状態を変える API（POST / PATCH）は、Origin ヘッダーが同一オリジンでなければ拒否します（CSRF 対策）。

### 電話番号

- 保存時に「表示用（`phone`）」と「検索用（`phone_normalized`、数字のみ）」を分けて保存します。
- 全角数字、ハイフン、空白、`+81` を正規化します。`09012345678` と `090-1234-5678` は同じ顧客として検索されます。
- 検索は `(organization_id, phone_normalized)` のインデックスを使った完全一致です。
- 同じ企業内で電話番号が重複する場合は 409 を返して既存の顧客を案内し、ユーザーが確認した場合だけ登録できます（家族で固定電話を共有している場合などのため）。

### 応答時間の計測

- Workers・BFF の応答に `Server-Timing` ヘッダーを付けています（ブラウザの開発者ツール → Network → Timing で確認できます）。
- 画面下部に、直近の API の応答時間を表示します（500ms を超えると色が変わります）。
- サーバーログには、メソッド・パス（ID は伏せ字）・ステータス・処理時間だけを出力します。個人情報は出力しません。

ローカル環境での実測値：電話番号検索・顧客取得・工事履歴取得はいずれも、Workers 内の処理が数 ms、ブラウザから見た応答が 40〜70ms 程度です。

## 必要な環境変数

| 場所 | 変数 | 内容 |
|---|---|---|
| `web/.env.local`（Vercel の環境変数） | `WORKER_API_URL` | Workers API の URL（ローカルは `http://localhost:8787`） |
| | `INTERNAL_API_SECRET` | Workers と共有する秘密値（32バイト以上のランダム文字列） |
| `worker/.dev.vars`（本番は `wrangler secret`） | `INTERNAL_API_SECRET` | 上と同じ値 |
| `worker/wrangler.jsonc` の `vars` | `SESSION_TTL_DAYS` | セッションの有効日数（既定 30） |
| | `ALLOWED_ORIGINS` | 通常は空のままにします（ブラウザから Workers を直接呼ばないため） |

秘密値は次のコマンドで作れます。

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## ローカルで起動する

Node.js 22 以上が必要です。

```bash
cd worker && npm install && cp .dev.vars.example .dev.vars
```

`worker/.dev.vars` の `INTERNAL_API_SECRET` を上のコマンドで作った値に変えてから、次を実行します。

```bash
npm run db:migrate:local && npm run db:seed:local
```

```bash
npm run dev
```

別のターミナルで画面側を起動します。

```bash
cd web && npm install && cp .env.example .env.local
```

`web/.env.local` の `INTERNAL_API_SECRET` を `worker/.dev.vars` と同じ値にしてから、次を実行します。

```bash
npm run dev
```

http://localhost:3000 を開き、テスト用アカウントでログインします。

ログイン画面はパスワードのみです。登録ユーザーが1人だけのときは、パスワードだけでそのユーザーとしてログインします。
ユーザーが2人以上いる場合、API はメールアドレスを必須にします（ローカルのテスト用データは2社分あるため、画面からはログインできません。結合テストは API を直接使います）。

| 企業 | メールアドレス | パスワード |
|---|---|---|
| 山田工務店（テスト） | demo@example.com | telkal-demo-2026 |
| 別会社建設（テスト） | other@example.com | telkal-other-2026 |

2社とも `090-1234-5678` の顧客を持っていますが、それぞれ自社の顧客しか表示されません。

## テスト

```bash
cd worker && npm test
```

電話番号の正規化の単体テストです。

```bash
cd worker && npm run test:api
```

認証・企業間のデータ分離・入力値検証の結合テストです。ローカルの Worker（`npm run dev`）とテスト用データが必要です。ローカル以外の URL に対しては実行できないようにしています。

画面側のチェック：

```bash
cd web && npm run lint && npx tsc --noEmit && npm run build
```

## アイコン（favicon・アプリアイコン）

元画像を `web/assets/icon-source.png` に置いて、次を実行します。

```bash
cd web && node scripts/make-icons.mjs
```

元画像のデザインは変えず、角丸の半径を自動で測って四隅だけを透明にします。次のファイルを生成します。

- `src/app/favicon.ico`
- `src/app/icon.png`（ヘッダーとログイン画面のロゴにも使用）
- `src/app/apple-icon.png`
- `public/icon-192.png`
- `public/icon-512.png`

## デプロイ手順（管理画面で行う方法）

コマンド操作なしで、Cloudflare と Vercel の管理画面から GitHub リポジトリを連携して公開します。
本番ブランチは `claude/adoring-darwin-gmn7ir` です。

### 1. Cloudflare D1（データベース）

1. Cloudflare ダッシュボード → Storage & databases → D1 SQL database → Create Database
2. 名前は `telkal` にします。Location は Asia-Pacific を選びます。
3. 表示された Database ID を `worker/wrangler.jsonc` の `database_id` に設定します（設定済み）。

### 2. Cloudflare Workers（API）

1. Workers & Pages → Create → Import a repository → GitHub の `msk-0604/telkal` を選びます。
2. 次のように設定します。
   - Project name：`telkal`（`worker/wrangler.jsonc` の name と同じにする）
   - Root directory：`worker`
   - Deploy command：`npm run deploy`（マイグレーションを適用してから Worker を公開）
   - Production branch：`claude/adoring-darwin-gmn7ir`
3. デプロイ後、Worker の Settings → Variables and Secrets に、Secret として `INTERNAL_API_SECRET` を追加します（32文字以上のランダムな英数字）。
4. Worker の URL（`https://telkal.<サブドメイン>.workers.dev`）を控えておきます。

### 3. Vercel（画面）

1. Add New → Project で `msk-0604/telkal` をインポートし、Root Directory を `web` にします。
2. Settings → Environment Variables に、次の2つを Production で追加します。
   - `WORKER_API_URL`：手順2の Worker の URL
   - `INTERNAL_API_SECRET`：手順2と同じ値
3. 環境変数を追加したら、Deployments から再デプロイ（Redeploy）します。

サーバー処理は `web/vercel.json` で東京リージョン（hnd1）に固定しています。

### 4. 最初のユーザー

パスワードのハッシュを含む SQL を作り、D1 のコンソール（Console タブ）で実行します。

コマンドで作る場合は、次を実行します（`worker` ディレクトリで、Cloudflare にログイン済みであること）。

```bash
TELKAL_PASSWORD='10文字以上のパスワード' npm run user:create -- --org "株式会社〇〇" --name "山田 太郎" --email you@example.com --remote
```

## API 一覧（Workers）

すべての API で `x-telkal-internal-secret` が必要です。ログイン以外は `x-telkal-session` も必要です。

| メソッド | パス | 内容 |
|---|---|---|
| POST | `/v1/auth/login` | ログイン（レート制限あり） |
| POST | `/v1/auth/logout` | ログアウト |
| GET | `/v1/auth/me` | ログイン中のユーザーと企業 |
| GET | `/v1/customers?phone=` | 電話番号で検索（完全一致） |
| POST | `/v1/customers` | 顧客の登録（重複時は 409） |
| GET / PATCH | `/v1/customers/:id` | 顧客の取得・更新 |
| GET / POST | `/v1/customers/:id/records` | 工事履歴の一覧・追加 |
| GET / PATCH | `/v1/records/:id` | 工事履歴の取得・更新 |

ブラウザからは、Next.js の `/api/...`（例：`/api/customers?phone=`）経由で呼び出します。
