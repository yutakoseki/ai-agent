# CI/CD セットアップガイド

このドキュメントでは、GitHub Actions と Amplify を使った CI/CD パイプラインのセットアップ手順を説明します。

## 前提条件

- GitHub リポジトリが作成済み
- AWS アカウントが作成済み
- Amplify アプリが作成済み

---

## 1. GitHub リポジトリの設定

### 1.1 ブランチ保護ルールの設定

1. GitHub リポジトリ → **Settings** → **Branches**
2. **Add branch protection rule** をクリック

#### `prod` ブランチの設定

```
Branch name pattern: prod

☑ Require a pull request before merging
  ☑ Require approvals: 2
  ☑ Dismiss stale pull request approvals when new commits are pushed
  ☑ Require review from Code Owners

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  Status checks:
    - lint
    - unit-test
    - integration-test
    - build
    - e2e-test

☑ Require conversation resolution before merging
☑ Require signed commits
☑ Require linear history
☑ Do not allow bypassing the above settings
```

#### `staging` ブランチの設定

```
Branch name pattern: staging

☑ Require a pull request before merging
  ☑ Require approvals: 1
  ☑ Dismiss stale pull request approvals when new commits are pushed

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  Status checks:
    - lint
    - unit-test
    - integration-test
    - build
    - e2e-test

☑ Require conversation resolution before merging
```

#### `develop` ブランチの設定

```
Branch name pattern: develop

☑ Require a pull request before merging
  ☑ Require approvals: 1

☑ Require status checks to pass before merging
  Status checks:
    - lint
    - unit-test
    - integration-test
    - build
```

### 1.2 Secrets の設定

1. GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** をクリック

#### 必要な Secrets

```bash
# テスト用
TEST_JWT_SECRET=test-jwt-secret-min-32-characters-long-for-testing
TEST_DATABASE_URL=postgres://test:test@localhost:5432/test_db

# 環境別URL
DEV_URL=https://dev.example.com
STAGING_URL=https://staging.example.com
PROD_URL=https://example.com

# Slack通知（オプション）
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Codecov（オプション）
CODECOV_TOKEN=your-codecov-token
```

### 1.3 CODEOWNERS の設定

`.github/CODEOWNERS` ファイルを編集して、チームメンバーを設定：

```
# デフォルト
* @your-org/core-team

# セキュリティ関連
/apps/web/lib/auth/ @your-org/security-team
/apps/web/lib/middleware/ @your-org/security-team

# インフラ関連
/infra/ @your-org/devops-team
/.github/workflows/ @your-org/devops-team
```

---

## 2. AWS Amplify の設定

### 2.1 Amplify アプリの作成

1. AWS Console → **Amplify** → **New app** → **Host web app**
2. GitHub リポジトリを選択
3. ブランチを選択（`develop`, `staging`, `prod`）

### 2.2 ビルド設定

`amplify.yml` を確認・編集：

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

### 2.3 環境変数の設定

各環境（develop, staging, prod）で以下を設定：

1. Amplify Console → アプリ選択 → **Environment variables**
2. 環境変数を追加：

```bash
# 公開可能な変数
NEXT_PUBLIC_API_BASE_URL=https://api.example.com

# サーバーサイド変数
API_BASE_URL=https://internal-api.example.com
DATABASE_URL=postgres://user:pass@host:5432/dbname
QUEUE_URL=amqp://user:pass@host:5672/vhost
AGENTCORE_API_URL=https://agent-core.example.com
AGENTCORE_QUEUE_NAME=agent-core-jobs
AMPLIFY_REGION=ap-northeast-1
AMPLIFY_BRANCH=prod

# 認証関連（本番環境では強力なランダム文字列を使用）
JWT_SECRET=your-production-jwt-secret-min-32-characters-long
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SESSION_COOKIE_NAME=session
SESSION_COOKIE_SECURE=true
PASSWORD_RESET_EXPIRES_IN=1h
PASSWORD_RESET_SECRET=your-production-password-reset-secret-min-32-characters-long
```

### 2.4 ブランチ別の自動デプロイ設定

1. Amplify Console → **App settings** → **Branch settings**
2. 各ブランチで自動デプロイを有効化：

| ブランチ | 自動デプロイ | 環境 |
|---------|------------|------|
| develop | ✅ | 開発 |
| staging | ✅ | ステージング |
| prod | ✅ | 本番 |

---

## 3. GitHub Actions の動作確認

### 3.1 PR作成時のテスト

1. `feature/test-ci` ブランチを作成
2. 適当な変更をコミット
3. `develop` へのPRを作成
4. GitHub Actions が自動実行されることを確認：
   - ✅ lint
   - ✅ unit-test
   - ✅ integration-test
   - ✅ build

### 3.2 E2Eテストの確認

1. `develop` から `staging` へのPRを作成
2. GitHub Actions で E2E テストが実行されることを確認：
   - ✅ lint
   - ✅ unit-test
   - ✅ integration-test
   - ✅ build
   - ✅ e2e-test

### 3.3 デプロイ通知の確認

1. `develop` ブランチにマージ
2. Slack に通知が届くことを確認（Slack Webhook設定済みの場合）

---

## 4. Slack 通知の設定（オプション）

### 4.1 Incoming Webhook の作成

1. Slack ワークスペース → **Apps** → **Incoming Webhooks**
2. **Add to Slack** をクリック
3. 通知先チャンネルを選択
4. Webhook URL をコピー

### 4.2 GitHub Secrets に追加

```bash
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 4.3 通知内容のカスタマイズ

`.github/workflows/deploy-notification.yml` を編集して、通知内容を調整できます。

---

## 5. Codecov の設定（オプション）

### 5.1 Codecov アカウント作成

1. [Codecov](https://codecov.io/) にアクセス
2. GitHub アカウントでサインイン
3. リポジトリを追加

### 5.2 トークンの取得

1. Codecov → リポジトリ選択 → **Settings** → **General**
2. **Repository Upload Token** をコピー

### 5.3 GitHub Secrets に追加

```bash
CODECOV_TOKEN=your-codecov-token
```

### 5.4 カバレッジバッジの追加

`README.md` に追加：

```markdown
[![codecov](https://codecov.io/gh/your-org/your-repo/branch/prod/graph/badge.svg)](https://codecov.io/gh/your-org/your-repo)
```

---

## 6. トラブルシューティング

### GitHub Actions が失敗する

#### Lint エラー

```bash
# ローカルで確認
pnpm lint

# 自動修正
pnpm lint --fix
```

#### テスト失敗

```bash
# ローカルでテスト実行
pnpm test

# 特定のテストのみ
pnpm test password
```

#### ビルド失敗

```bash
# ローカルでビルド
pnpm --filter @ai-agent/web build

# 環境変数を確認
cat .env.local
```

### Amplify デプロイが失敗する

1. Amplify Console → ビルドログを確認
2. 環境変数が正しく設定されているか確認
3. `amplify.yml` の設定を確認

### E2E テストが失敗する

1. デプロイが完了しているか確認（60秒待機している）
2. テスト対象のURLが正しいか確認
3. Playwright のスクリーンショットを確認

---

## 7. 定期メンテナンス

### 依存関係の更新

```bash
# 依存関係の確認
pnpm outdated

# 更新
pnpm update

# セキュリティ脆弱性のチェック
pnpm audit
```

### GitHub Actions の更新

定期的に `.github/workflows/*.yml` のアクションバージョンを更新：

```yaml
# 古い
- uses: actions/checkout@v3

# 新しい
- uses: actions/checkout@v4
```

### Amplify の設定確認

- ビルド時間の最適化
- キャッシュの有効活用
- 環境変数の見直し

---

## 8. チェックリスト

### 初期セットアップ

- [ ] GitHub リポジトリ作成
- [ ] ブランチ保護ルール設定（prod, staging, develop）
- [ ] GitHub Secrets 設定
- [ ] CODEOWNERS 設定
- [ ] Amplify アプリ作成
- [ ] Amplify 環境変数設定
- [ ] Amplify 自動デプロイ設定
- [ ] Slack Webhook 設定（オプション）
- [ ] Codecov 設定（オプション）

### 動作確認

- [ ] feature → develop のPRでテスト実行
- [ ] develop → staging のPRでE2Eテスト実行
- [ ] staging → prod のPRでE2Eテスト実行
- [ ] develop へのマージでデプロイ通知
- [ ] staging へのマージでデプロイ通知
- [ ] prod へのマージでデプロイ通知

### 定期メンテナンス

- [ ] 月次：依存関係の更新
- [ ] 月次：セキュリティ脆弱性のチェック
- [ ] 四半期：GitHub Actions のバージョン更新
- [ ] 四半期：Amplify 設定の見直し

---

## 参考リンク

- [GitHub Actions ドキュメント](https://docs.github.com/en/actions)
- [AWS Amplify ドキュメント](https://docs.aws.amazon.com/amplify/)
- [Codecov ドキュメント](https://docs.codecov.com/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
