# Amplify セットアップガイド

このドキュメントでは、AWS Amplify を使った自動デプロイの設定手順を説明します。

## 前提条件

- AWS アカウントが作成済み
- GitHub リポジトリが作成済み
- `prod`, `staging`, `develop` ブランチが作成済み

---

## ステップ1: Amplify アプリの作成

### 1.1 AWS Console にアクセス

1. [AWS Console](https://console.aws.amazon.com/) にログイン
2. リージョンを選択（例：東京 `ap-northeast-1`）
3. サービス検索で **Amplify** を検索してクリック

### 1.2 新しいアプリを作成

1. **Create new app** をクリック
2. **Host web app** を選択
3. **GitHub** を選択
4. **Continue** をクリック

### 1.3 GitHub 連携

1. **Authorize AWS Amplify** をクリック（初回のみ）
2. リポジトリを選択
3. **Next** をクリック

### 1.4 ブランチ設定（develop）

まず開発環境用に `develop` ブランチを設定します。

```
Repository: your-repo-name
Branch: develop
App name: ai-agent-dev（または任意の名前）
```

**Next** をクリック

---

## ステップ2: ビルド設定

### 2.1 ビルド設定の確認

Amplify が自動的に `amplify.yml` を検出します。

表示された設定を確認：

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm install -g pnpm@8
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm --filter @ai-agent/web build
  artifacts:
    baseDirectory: apps/web/.next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### 2.2 ビルド設定の編集（必要な場合）

もし自動検出されない場合は、**Edit** をクリックして上記の内容を貼り付けます。

**Next** をクリック

---

## ステップ3: 環境変数の設定

### 3.1 環境変数を追加

**Advanced settings** を展開して、以下の環境変数を追加：

#### 必須の環境変数

```bash
# 公開可能な変数
NEXT_PUBLIC_API_BASE_URL=https://api-dev.example.com

# サーバーサイド変数（開発環境用のダミー値）
API_BASE_URL=https://internal-api-dev.example.com
DATABASE_URL=postgres://user:pass@localhost:5432/dev_db
QUEUE_URL=amqp://user:pass@localhost:5672/vhost
AGENTCORE_API_URL=https://agent-core-dev.example.com
AGENTCORE_QUEUE_NAME=agent-core-jobs-dev
AMPLIFY_REGION=ap-northeast-1
AMPLIFY_BRANCH=develop

# 認証関連（開発環境用）
JWT_SECRET=dev-jwt-secret-min-32-characters-long-change-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SESSION_COOKIE_NAME=session
SESSION_COOKIE_SECURE=false
PASSWORD_RESET_EXPIRES_IN=1h
PASSWORD_RESET_SECRET=dev-password-reset-secret-min-32-characters-long
```

**注意**: 
- 開発環境なので `SESSION_COOKIE_SECURE=false` でOK
- 本番環境では必ず強力なランダム文字列を使用

### 3.2 保存して次へ

**Save and deploy** をクリック

---

## ステップ4: デプロイの確認

### 4.1 デプロイ状況を確認

1. デプロイが自動的に開始されます
2. 以下のフェーズが順次実行されます：
   - Provision（環境準備）
   - Build（ビルド）
   - Deploy（デプロイ）
   - Verify（検証）

### 4.2 デプロイ完了

デプロイが完了すると、URLが表示されます：

```
https://develop.xxxxx.amplifyapp.com
```

このURLをコピーして、GitHub Secrets の `DEV_URL` に設定します。

---

## ステップ5: staging と prod ブランチの追加

### 5.1 staging ブランチを追加

1. Amplify Console → アプリを選択
2. **Connect branch** をクリック
3. `staging` ブランチを選択
4. 環境変数を設定（develop と同じ手順）
   - `AMPLIFY_BRANCH=staging`
   - `SESSION_COOKIE_SECURE=true`（ステージングは本番に近い設定）
   - その他の値も staging 用に調整
5. **Save and deploy** をクリック

### 5.2 prod ブランチを追加

1. **Connect branch** をクリック
2. `prod` ブランチを選択
3. 環境変数を設定（本番環境用）
   - `AMPLIFY_BRANCH=prod`
   - `SESSION_COOKIE_SECURE=true`
   - **重要**: `JWT_SECRET` と `PASSWORD_RESET_SECRET` は強力なランダム文字列を使用
4. **Save and deploy** をクリック

### 5.3 本番用のシークレット生成

```bash
# 強力なランダム文字列を生成（32文字以上）
openssl rand -base64 32

# または
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

生成された文字列を本番環境の `JWT_SECRET` と `PASSWORD_RESET_SECRET` に使用します。

---

## ステップ6: GitHub Secrets の更新

各環境のURLをGitHub Secretsに追加します。

### 6.1 URLを確認

Amplify Console で各ブランチのURLを確認：

- develop: `https://develop.xxxxx.amplifyapp.com`
- staging: `https://staging.xxxxx.amplifyapp.com`
- prod: `https://prod.xxxxx.amplifyapp.com`

### 6.2 GitHub Secrets に追加

1. GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. 以下を追加または更新：

```
DEV_URL=https://develop.xxxxx.amplifyapp.com
STAGING_URL=https://staging.xxxxx.amplifyapp.com
PROD_URL=https://prod.xxxxx.amplifyapp.com
```

---

## ステップ7: 自動デプロイの確認

### 7.1 テストコミット

```bash
# developブランチで変更
git checkout develop
echo "# Test Deploy" >> README.md
git add README.md
git commit -m "test: Amplify自動デプロイのテスト"
git push origin develop
```

### 7.2 Amplify Console で確認

1. Amplify Console → アプリを選択
2. `develop` ブランチのビルドが自動的に開始されることを確認
3. ビルド完了後、URLにアクセスして動作確認

---

## ステップ8: カスタムドメインの設定（オプション）

### 8.1 ドメインを追加

1. Amplify Console → **Domain management**
2. **Add domain** をクリック
3. ドメイン名を入力（例：`example.com`）
4. サブドメインを設定：
   - `develop` → `dev.example.com`
   - `staging` → `staging.example.com`
   - `prod` → `example.com` または `www.example.com`

### 8.2 DNS設定

Amplify が提供するCNAMEレコードをDNSプロバイダーに追加します。

---

## トラブルシューティング

### ビルドが失敗する

#### エラー: `pnpm: command not found`

**原因**: pnpm がインストールされていない

**解決策**: `amplify.yml` の `preBuild` に以下を追加：
```yaml
- npm install -g pnpm@8
```

#### エラー: 環境変数が見つからない

**原因**: 環境変数が設定されていない

**解決策**:
1. Amplify Console → アプリ → ブランチ選択
2. **Environment variables** で必要な変数を追加

#### エラー: ビルドタイムアウト

**原因**: ビルドに時間がかかりすぎている

**解決策**:
1. キャッシュを有効化（`amplify.yml` の `cache` セクション）
2. 不要な依存関係を削除

### デプロイ後にアプリが動かない

#### 白い画面が表示される

**原因**: ビルド成果物のパスが間違っている

**解決策**: `amplify.yml` の `baseDirectory` を確認：
```yaml
baseDirectory: apps/web/.next
```

#### API呼び出しが失敗する

**原因**: 環境変数が正しく設定されていない

**解決策**:
1. ブラウザの開発者ツールでエラーを確認
2. Amplify Console で環境変数を確認
3. 必要に応じて再デプロイ

---

## チェックリスト

### Amplify アプリ作成
- [ ] AWS Console にログイン
- [ ] Amplify アプリ作成
- [ ] GitHub 連携

### ブランチ設定
- [ ] `develop` ブランチ接続
- [ ] `staging` ブランチ接続
- [ ] `prod` ブランチ接続

### 環境変数設定
- [ ] `develop` の環境変数設定
- [ ] `staging` の環境変数設定
- [ ] `prod` の環境変数設定（本番用シークレット生成）

### GitHub Secrets 更新
- [ ] `DEV_URL` 追加
- [ ] `STAGING_URL` 追加
- [ ] `PROD_URL` 追加

### 動作確認
- [ ] 自動デプロイの確認
- [ ] 各環境のURLにアクセス
- [ ] アプリが正常に動作することを確認

---

## 次のステップ

Amplify セットアップ完了後：
1. E2Eテストの設定
2. 監視・アラートの設定
3. カスタムドメインの設定（オプション）
