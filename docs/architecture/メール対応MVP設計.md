# 個人向けメール対応システム MVP 設計（Gmail 先行）

## 目的

- Gmail / Outlook を取り込み、要対応メールだけをタスク化して Web で一元管理する。
- PWA Push で「要対応」が発生したことを即時通知する。
- 自動返信は行わない。

## MVP 仕様（確定）

- Gmail OAuth 接続（Outlook は設計のみ先行）
- 新着メール検知: Gmail watch + Pub/Sub → history 差分
- メール分類/要約/次アクション抽出: **AI（LLM）** を優先（未設定時はルールベースにフォールバック）
- 要対応のみ、AIの要約と次アクションを付けてタスク化
- Web でタスク一覧・詳細・ステータス更新
- PWA Push: 要対応タスク作成時に通知
- 保存範囲: snippet + ヘッダ + 要約（本文全文は保存しない）

## ユーザーオンボーディング（SaaS想定）

- 前提: **ユーザーが入力したメールアドレスを、アプリが勝手に監視することはできない**
  - Gmail/Outlook は本人（または管理者）の認可が必要
  - 本設計（MVP）は「メールアドレス登録」= **そのアドレスで OAuth 接続して EmailAccount を作る**ことを指す
  - 例外（将来）: Google Workspace の **ドメイン全体の委任（DWD）** 等を使えば、管理者承認で一括監視が可能（MVP対象外）

### ユーザー操作（画面/操作イメージ）

1. アプリにユーザー登録/ログイン
2. 「監視したいメールアドレス」を入力（任意: login_hint 用）
3. 「Gmail を接続」ボタン → Google OAuth（そのメールアドレスでログイン/同意）
4. 接続完了後に EmailAccount が作成され、アプリが `users/me/watch` を設定（監視開始）
5. ユーザーは「この受信箱を監視する（monitoringEnabled）」を ON/OFF
6. 任意: 「通知する（pushEnabled）」を ON/OFF（要対応タスク発生時に Push）

### API 期待動作（要点）

- `POST /api/email-accounts/gmail/connect`（例）
  - OAuth 開始（state署名、任意で login_hint を受ける）
- `GET /api/auth/google`（既存）
  - code 交換 → token 保存 → `EmailAccount` upsert → `users/me/watch` 実行 → `UserEmailAccountSubscription` を作成（監視ON/通知ONを初期値にする等）
- `PATCH /api/user-email-subs/<accountId>`（例）
  - monitoringEnabled/pushEnabled/role を更新

## 運営者（SaaS提供側）が必要なセットアップ（MVP）

### 1. 環境変数の設定

- OAuth/同期/Push で必須:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`（例: `https://<host>/api/auth/google`）
  - `GMAIL_PUBSUB_TOPIC`（例: `projects/<project>/topics/<topic>`）
  - `GMAIL_WEBHOOK_TOKEN`（Pub/Sub push 受信の検証用）
  - `OAUTH_TOKEN_ENC_KEY`（トークン暗号化用）
  - `OAUTH_STATE_SECRET`（OAuth state 署名用）
  - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- 既存の必須環境変数（JWT/DynamoDB など）も設定済みであること。

- AI（LLM）で分類/要約/タスク化する場合:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`（例: `gpt-5.2-nano`）

### Web Push（PWA通知）の設定手順（Amplify想定）

#### VAPID_SUBJECT とは？

- **VAPID_SUBJECT** は Web Push の「送信者（連絡先）」を表す文字列（Pushサービス向けの連絡先）です。
- 形式は一般的に以下のどちらか:
  - `mailto:support@your-domain.com`
  - `https://your-domain.com`
- 推奨: **運営者が監視しているサポート用メールアドレス**（例: `mailto:support@...`）
  - ユーザーの個人メールを入れる必要はありません（運営側の連絡先でOK）

#### 1) VAPIDキーの生成（開発者）

- `apps/web` 配下で生成:
  - `pnpm dlx web-push generate-vapid-keys`
- 出力される `Public Key` / `Private Key` を控える

#### 2) Amplify（環境変数）の設定（開発者）

- サーバ側（Route Handler / Push送信で使用）
  - `VAPID_PUBLIC_KEY` = Public Key
  - `VAPID_PRIVATE_KEY` = Private Key
  - `VAPID_SUBJECT` = `mailto:support@...` など
- クライアント側（購読時に使用・ビルド時に埋め込まれる）
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = Public Key

#### 3) ユーザーが端末ごとに購読する（ユーザー）

- `/mail-agent` の「Push 通知」から「通知を有効化」を押す
  - ブラウザの通知許可が必要（ユーザー操作）
  - 端末（ブラウザ）ごとに購読が必要（PC/スマホそれぞれで実施）
- 購読情報は `POST /api/push/subscribe` で保存され、以降その端末へ通知が届く

#### 4) HTTPSで配信（必須）

- Web Push は HTTPS 必須
- Amplify でホスティングする場合は通常満たされる

### 2. Google Cloud（Gmail API）設定

1. Google Cloud プロジェクトを作成
   - Console → プロジェクト選択 → 新しいプロジェクト
   - 作成後の Project ID を控える
2. Gmail API を有効化
   - Console → API とサービス → ライブラリ → Gmail API → 有効化
   - 併せて Pub/Sub API も有効化
3. OAuth 同意画面を設定
   - Console → Google Auth Platform → 「ブランディング」
   - アプリ名 / サポートメール / 連絡先メールを入力して保存
   - Console → Google Auth Platform → 「対象」
     - 種別は「外部」
     - 公開ステータスは「テスト中」のまま
     - テストユーザーに自分の Gmail を追加
   - Console → Google Auth Platform → 「データアクセス」
     - スコープに `https://www.googleapis.com/auth/gmail.modify` を追加して保存
4. OAuth クライアント（Web）を作成
   - Console → Google Auth Platform → 「クライアント」 → 「クライアントを作成」
   - アプリ種類: Web アプリ
   - 承認済みの JavaScript 生成元:
     - `https://<host>`
     - `http://localhost:3000`（ローカル開発用）
   - 承認済みのリダイレクト URI:
     - `https://<host>/api/auth/google`
     - `http://localhost:3000/api/auth/google`（ローカル開発用）
5. 作成した Client ID / Client Secret を環境変数へ反映
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`（例: `http://localhost:3000/api/auth/google`）
6. 補足
   - `gmail.modify` は機微なスコープなので、公開運用する場合は Google の審査が必要。
   - 個人利用のMVPは「テスト」状態＋テストユーザーで運用可能。

- 監視対象（取り込み対象）の Gmail アドレスは **OAuth 実行時のアカウント選択画面で選んだもの**
  - Console では設定しない
  - アプリ側で `/api/auth/google` を開いたときに選択する
- SaaS で「ユーザーごとに監視するメールアドレスを選択」したい場合は、
  - **EmailAccount（接続された受信箱）** と **UserEmailAccountSubscription（ユーザーの監視/通知設定）** を分離する
  - “監視する/しない”は **watchの有無ではなく、ユーザーへの表示・通知の有無**として扱う（watch自体はアカウント単位）

### 3. Pub/Sub（Gmail watch）設定

1. Pub/Sub Topic を作成
   - Console 左メニュー → 「すべてのプロダクトを表示」→ Pub/Sub
   - Pub/Sub → トピック → 作成
   - トピック ID は任意の英小文字/数字/ハイフン（例: `gmail-watch`）
   - 作成後のフルパスを `GMAIL_PUBSUB_TOPIC` に設定
     - 例: `projects/<project-id>/topics/gmail-watch`
2. Topic に Gmail の publish 権限を付与
   - トピック → 権限 → プリンシパルを追加
   - プリンシパル: `gmail-api-push@system.gserviceaccount.com`
   - ロール: `Pub/Sub Publisher`（`roles/pubsub.publisher`）
   - 自分の Gmail/オーナー権限ではない点に注意
3. Push subscription を作成
   - Pub/Sub → サブスクリプション → 作成（または自動作成された `gmail-watch-sub` を編集）
   - 配信タイプ: Push
   - エンドポイント: `https://<host>/api/webhook/gmail`
   - ローカル検証時は ngrok 等で HTTPS の公開 URL を用意する
4. 補足
   - Pub/Sub API が未有効化の場合は先に有効化する
   - watch の呼び出しは OAuth 完了後にアプリから実行される（Topic が未作成だと失敗）
   - `gmail-watch-sub` が自動作成されている場合は編集して使ってOK
     - 必須: 配信タイプが push / エンドポイントが `/api/webhook/gmail`
     - ヘッダー欄が UI に出ない場合は gcloud で付与
       - `gcloud pubsub subscriptions update gmail-watch-sub --push-endpoint=https://<host>/api/webhook/gmail --push-headers=x-webhook-token=<GMAIL_WEBHOOK_TOKEN>`
     - ローカル検証のみなら `GMAIL_WEBHOOK_TOKEN` を未設定にしてヘッダー無しでも可（本番は必須）
   - `GMAIL_WEBHOOK_TOKEN` は自分で作る秘密文字列
     - 例: `openssl rand -hex 32`
     - 例: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
     - `.env.local` の `GMAIL_WEBHOOK_TOKEN` と push ヘッダーの値を一致させる
   - gcloud はローカルで使う場合はインストールが必要
     - Console の Cloud Shell ならインストール不要で実行できる

### 4. Gmail ラベル運用（SaaS 想定: アカウント別に保存）

1. 各ユーザーの Gmail でラベルを作成（または自動作成）
   - 手動作成: Gmail → 設定 → ラベル → 新しいラベルを作成
   - 本システムでは **日本語ラベル**を使う（英語ラベルは使用しない）
   - ラベル名（カテゴリ）:
     - `AI/要対応`
     - `AI/情報`
     - `AI/営業`
     - `AI/自動通知`
     - `AI/請求・支払い`
     - `AI/セキュリティ`
2. ラベルは **必要になったときにだけ自動作成（遅延作成）**する
   - 例: 「請求・支払い」のメールが1通も来ていないなら `AI/請求・支払い` は作られない
   - 初回OAuth時に全ラベルを作成しない（ラベル作成を最小化）
3. 同期時にカテゴリ判定されたら、該当カテゴリのラベルIDが無ければ `labels.list`/`labels.create` で作成して EmailAccount に保存
   - EmailAccount に `labelIds`（カテゴリ→ラベルID）をアカウント別に保存
4. ラベル付与は **アカウント別の保存値**を使う
   - ラベル作成/保存に失敗しても、分類とタスク化は継続（ラベル付与だけ best-effort で省略される）
5. 補足
   - `GMAIL_LABEL_IDS_JSON` / `GMAIL_WATCH_LABEL_IDS` は単一アカウント向けの互換用途
   - SaaS ではアカウント別設定（EmailAccount.labelIds）を正とする

### 5. Web Push（PWA 通知）

1. VAPID キーを生成
   - 例: `npx web-push generate-vapid-keys`
2. 生成したキーを環境変数に設定
3. ブラウザで通知許可を許可（ユーザー操作）
4. HTTPS 必須（ローカルは `localhost` 例外）

## コンポーネント（文章図）

- Web/PWA (Next.js): UI, Service Worker, Push 購読
- API (Next.js Route Handlers): OAuth, Webhook, Sync, Task CRUD, Push
- DynamoDB: EmailAccount/UserEmailAccountSubscription/EmailMessage/Task/PushSubscription
- Gmail API: OAuth / watch / history / message / modify
- Pub/Sub: Gmail watch 通知配送

## データフロー

### Gmail

1. OAuth: `/api/auth/google` → code 交換 → token 保存 → `users/me/watch`
2. Pub/Sub → `/api/webhook/gmail` 受信
3. `/api/sync/gmail` で history 差分取得
4. Message 取得 → 分類 → EmailMessage 保存
5. 要対応のみ Task 作成 → 購読ユーザーへ Push 送信 → Gmail ラベル付与

### Outlook（設計のみ）

1. OAuth / Graph change notifications (Webhook)
2. delta query で差分取得
3. Message 取得 → 分類 → Task 作成 → Push

## DB スキーマ（単一テーブル）

### EmailAccount

- PK: `TENANT#<tenantId>`
- SK: `EMAIL_ACCOUNT#<accountId>`
- GSI1PK: `EMAIL#<email>`（Webhook 逆引き）
- GSI1SK: `PROVIDER#gmail#TENANT#...`
- 主要属性: provider, email, tokens(暗号化), historyId, watchExpiration, status(enabled/disabled)
- 補足: EmailAccount は「接続されたメール受信箱（mailbox）」であり、閲覧/監視するユーザーは別エンティティで表現する

### UserEmailAccountSubscription（ユーザーごとの監視/通知設定）

- PK: `TENANT#<tenantId>`
- SK: `USER_EMAIL_SUB#USER#<userId>#ACCOUNT#<accountId>`
- GSI2PK: `USER#<userId>#EMAIL_SUB`
- GSI2SK: `TENANT#<tenantId>#ACCOUNT#<accountId>`
- 主要属性:
  - `accountId`, `userId`
  - `monitoringEnabled`（一覧/タスク可視化の対象にするか）
  - `pushEnabled`（要対応発生時に Push するか）
  - `role`（owner/admin/member/readonly など。共有受信箱の権限モデル用）
  - `createdAt`, `updatedAt`

### EmailMessage

- PK: `TENANT#<tenantId>`
- SK: `EMAIL_MESSAGE#<provider>#<messageId>`
- 主要属性: subject, from, snippet, receivedAt, category, needsAction, taskId, accountId

### Task

- PK: `TENANT#<tenantId>`
- SK: `TASK#<taskId>`
- GSI1PK: `TENANT#<tenantId>#TASK#STATUS#<status>`
- GSI1SK: `<updatedAt>#<taskId>`
- GSI2PK: `USER#<userId>#TASK`（担当者/自分のタスク用）
- GSI3PK: `TENANT#<tenantId>#ACCOUNT#<accountId>#TASK#STATUS#<status>`（受信箱別の一覧用）
- GSI3SK: `<updatedAt>#<taskId>`
- 主要属性: title, summary, nextAction, dueAt, status, sourceMessageId, accountId, assigneeUserId(optional)

### PushSubscription

- PK: `TENANT#<tenantId>`
- SK: `PUSH_SUB#<hash>`
- GSI2PK: `USER#<userId>#PUSH`
- 主要属性: endpoint, keys, expirationTime

## Connector 層と Service 層の責務分離

- Connector: Gmail/Graph API の HTTP 呼び出し、トークン更新
- Service: 取り込み、分類、タスク化、ラベル付与、通知

## 冪等性 / 取りこぼし対策

- EmailMessage は `attribute_not_exists` で重複登録を抑止
- Task は `msg-<provider>-<messageId>` を使い重複生成を防止
- Gmail historyId を EmailAccount に保存して差分取得
- Webhook 再送時も EmailMessage が既存ならスキップ

## SaaS（マルチユーザー）拡張時の設計ポイント

- **監視対象メールアドレスの選択**:
  - EmailAccount（接続）と UserEmailAccountSubscription（ユーザーの監視選択）を分離
  - ユーザーは購読を ON/OFF でき、ON の EmailAccount だけを UI/通知対象にする
- **共有受信箱（例: support@）**:
  - 1つの EmailAccount を複数ユーザーが購読（role付き）できるようにする
  - 誰が OAuth 接続したか（=token保有者）と、誰が閲覧/対応するか（=購読者）を分離
- **通知先の決定**:
  - Task 作成時に `accountId` から購読者（monitoringEnabled/pushEnabled）を引いて Push
  - 追加で `assigneeUserId` がある場合は assignee を優先、または併用（運用ルール次第）

## セキュリティ / 運用

- OAuth Token は AES-GCM で暗号化して保存
- Webhook には検証トークンを付与（`GMAIL_WEBHOOK_TOKEN`）
- ログに本文・トークンは出さない
- rate limit/ backoff を考慮し sync の batch サイズを制限
- 失敗時は再実行できるように sync を冪等化
