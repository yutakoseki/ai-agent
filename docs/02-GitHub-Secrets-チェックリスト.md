# GitHub Secrets 設定チェックリスト

このドキュメントでは、GitHub Actions で使用する Secrets の設定手順を説明します。

## 設定手順

1. GitHub リポジトリにアクセス
2. **Settings** → **Secrets and variables** → **Actions** をクリック
3. **New repository secret** をクリック
4. 以下の Secrets を1つずつ追加

---

## 必須 Secrets

### テスト用

#### `TEST_JWT_SECRET`

```
値: test-jwt-secret-min-32-characters-long-for-testing
説明: テスト環境用のJWT署名キー（32文字以上）
```

#### `TEST_DATABASE_URL`

```
値: postgres://test:test@localhost:5432/test_db
説明: テスト用データベース接続URL（現時点ではダミーでOK）
```

---

### Terraform / Infra（IaC 自動反映）

#### `AWS_ACCESS_KEY_ID`

```
値: <IAMユーザーのアクセスキー>
説明: GitHub Actions が Terraform を実行するための AWS 認証情報
```

#### `AWS_SECRET_ACCESS_KEY`

```
値: <IAMユーザーのシークレットキー>
説明: GitHub Actions が Terraform を実行するための AWS 認証情報
```

#### `AWS_REGION`

```
値: ap-northeast-1
説明: Terraform 実行対象のリージョン
```

#### `TF_STATE_BUCKET`

```
値: aiagent-terraform-state
説明: Terraform state を保存する S3 バケット名（グローバル一意）
```

#### `TF_STATE_LOCK_TABLE`

```
値: aiagent-terraform-lock
説明: state ロック用 DynamoDB テーブル名
```

#### `TF_PROJECT`

```
値: aiagent
説明: リソース名のプレフィックス（未設定なら aiagent）
```

---

### 環境別URL

#### `AMPLIFY_APP_ID`

```
値: d3twt10pcsc29v（例）
説明: PR時のE2Eで、AmplifyのブランチURL（https://<branch>.<appId>.amplifyapp.com）を組み立てるために使用
現時点: E2EをPRゲートにするなら設定必須
```

#### `DEV_URL`

```
値: https://develop.xxxxx.amplifyapp.com
説明: 開発環境のURL（Amplify作成後に設定）
現時点: 空欄でOK（後で設定）
```

#### `STAGING_URL`

```
値: https://staging.xxxxx.amplifyapp.com
説明: ステージング環境のURL（Amplify作成後に設定）
現時点: 空欄でOK（後で設定）
```

#### `PROD_URL`

```
値: https://prod.xxxxx.amplifyapp.com
説明: 本番環境のURL（Amplify作成後に設定）
現時点: 空欄でOK（後で設定）
```

---

## オプション Secrets（後で設定可能）

### Slack通知用

#### `SLACK_WEBHOOK`

```
値: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
説明: デプロイ通知用のSlack Webhook URL
設定方法: docs/05-CI-CD-リファレンス.md の「4. Slack 通知の設定」を参照
```

### コードカバレッジ用

#### `CODECOV_TOKEN`

```
値: your-codecov-token
説明: Codecov アップロード用トークン
設定方法: docs/05-CI-CD-リファレンス.md の「5. Codecov の設定」を参照
```

---

## 現時点で設定すべきもの

今すぐ設定が必要なのは以下です：

- [x] `TEST_JWT_SECRET`
- [x] `TEST_DATABASE_URL`
- [ ] `AMPLIFY_APP_ID`（PR時のE2Eを有効にする場合）
- [ ] `AWS_ACCESS_KEY_ID`（IaC 自動反映を使う場合）
- [ ] `AWS_SECRET_ACCESS_KEY`（IaC 自動反映を使う場合）
- [ ] `AWS_REGION`（IaC 自動反映を使う場合）
- [ ] `TF_STATE_BUCKET`（IaC 自動反映を使う場合）
- [ ] `TF_STATE_LOCK_TABLE`（IaC 自動反映を使う場合）
- [ ] `TF_PROJECT`（任意）

その他は後で設定できます。

---

## 設定確認

Secrets が正しく設定されているか確認：

1. GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. 以下が表示されていればOK：
   - `TEST_JWT_SECRET`
   - `TEST_DATABASE_URL`
   - `AWS_ACCESS_KEY_ID`（IaC 自動反映を使う場合）
   - `AWS_SECRET_ACCESS_KEY`（IaC 自動反映を使う場合）
   - `AWS_REGION`（IaC 自動反映を使う場合）
   - `TF_STATE_BUCKET`（IaC 自動反映を使う場合）
   - `TF_STATE_LOCK_TABLE`（IaC 自動反映を使う場合）

---

## 次のステップ

Secrets 設定後：

1. ブランチ保護ルールの設定
2. Amplify アプリの作成
3. テストPRで動作確認
