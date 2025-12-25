# CI/CD クイックスタートガイド

このドキュメントでは、CI/CDセットアップの全体の流れを説明します。

## 概要

以下の順序で設定を進めます：

```
1. GitHub Secrets 設定（5分）
   ↓
2. ブランチ作成と保護ルール（10分）
   ↓
3. CODEOWNERS 更新（5分）
   ↓
4. テストPR作成（5分）
   ↓
5. Amplify セットアップ（30分）
   ↓
6. 動作確認（10分）
```

**所要時間**: 約1時間

---

## ステップ1: GitHub Secrets 設定（5分）

### 必要なもの
- GitHubリポジトリへのアクセス権

### 手順

1. GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** をクリック
3. 以下の2つを追加：

```
Name: TEST_JWT_SECRET
Value: test-jwt-secret-min-32-characters-long-for-testing
```

```
Name: TEST_DATABASE_URL
Value: postgres://test:test@localhost:5432/test_db
```

**詳細**: `docs/github-secrets-checklist.md`

---

## ステップ2: ブランチ作成と保護ルール（10分）

### 2.1 ブランチ作成

```bash
# 現在の変更をコミット
git add .
git commit -m "chore: CI/CDセットアップ"

# developブランチ作成
git checkout -b develop
git push origin develop

# stagingブランチ作成
git checkout -b staging
git push origin staging

# mainに戻る
git checkout prod
git push origin prod
```

### 2.2 ブランチ保護ルール設定

GitHub → **Settings** → **Branches** → **Add branch protection rule**

#### `prod` ブランチ
```
Branch name pattern: prod

☑ Require a pull request before merging
  ☑ Require approvals: 2
☑ Require status checks to pass before merging
☑ Require conversation resolution before merging
☑ Require linear history
```

#### `staging` ブランチ
```
Branch name pattern: staging

☑ Require a pull request before merging
  ☑ Require approvals: 1
☑ Require status checks to pass before merging
☑ Require conversation resolution before merging
```

#### `develop` ブランチ
```
Branch name pattern: develop

☑ Require a pull request before merging
  ☑ Require approvals: 1
☑ Require status checks to pass before merging
```

**詳細**: `docs/branch-setup-guide.md`

---

## ステップ3: CODEOWNERS 更新（5分）

`.github/CODEOWNERS` を編集：

```bash
# 変更前
* @your-org/core-team

# 変更後（あなたのGitHubユーザー名に変更）
* @your-github-username
```

コミット：

```bash
git add .github/CODEOWNERS
git commit -m "chore: CODEOWNERSを更新"
git push origin prod
```

---

## ステップ4: テストPR作成（5分）

### 4.1 テスト用ブランチ作成

```bash
git checkout develop
git checkout -b feature/test-ci-setup

# 簡単な変更
echo "" >> README.md
echo "## CI/CD Setup Complete" >> README.md

git add README.md
git commit -m "test: CI/CDセットアップの動作確認"
git push origin feature/test-ci-setup
```

### 4.2 PRを作成

1. GitHub → **Pull requests** → **New pull request**
2. base: `develop` ← compare: `feature/test-ci-setup`
3. **Create pull request**

### 4.3 GitHub Actions の確認

**Actions** タブで以下が実行されることを確認：

- ✅ Lint and Format Check
- ✅ Unit Tests
- ✅ Integration Tests
- ✅ Build Check

### 4.4 Status checks を保護ルールに追加

1. PRページで実行されたチェック項目を確認
2. GitHub → **Settings** → **Branches** → `develop` の保護ルール編集
3. "Status checks that are required" に以下を追加：
   - `lint`
   - `unit-test`
   - `integration-test`
   - `build`

4. 同様に `staging` と `prod` にも追加（`e2e-test` も含める）

### 4.5 PRをマージ

全てのチェックが通ったら **Merge pull request**

---

## ステップ5: Amplify セットアップ（30分）

### 5.1 Amplify アプリ作成

1. [AWS Console](https://console.aws.amazon.com/) → **Amplify**
2. **Create new app** → **Host web app**
3. **GitHub** を選択 → リポジトリ選択
4. ブランチ: `develop` を選択

### 5.2 ビルド設定確認

`amplify.yml` が自動検出されることを確認

### 5.3 環境変数設定

**Advanced settings** で以下を追加：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api-dev.example.com
API_BASE_URL=https://internal-api-dev.example.com
DATABASE_URL=postgres://user:pass@localhost:5432/dev_db
QUEUE_URL=amqp://user:pass@localhost:5672/vhost
AGENTCORE_API_URL=https://agent-core-dev.example.com
AGENTCORE_QUEUE_NAME=agent-core-jobs-dev
AMPLIFY_REGION=ap-northeast-1
AMPLIFY_BRANCH=develop
JWT_SECRET=dev-jwt-secret-min-32-characters-long-change-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SESSION_COOKIE_NAME=session
SESSION_COOKIE_SECURE=false
PASSWORD_RESET_EXPIRES_IN=1h
PASSWORD_RESET_SECRET=dev-password-reset-secret-min-32-characters-long
```

### 5.4 デプロイ開始

**Save and deploy** → デプロイ完了を待つ（5-10分）

### 5.5 staging と prod ブランチを追加

同様の手順で `staging` と `prod` ブランチも接続

**重要**: 本番環境（prod）では強力なシークレットを使用：

```bash
# シークレット生成
openssl rand -base64 32
```

### 5.6 URLをコピー

各環境のURLをコピー：
- develop: `https://develop.xxxxx.amplifyapp.com`
- staging: `https://staging.xxxxx.amplifyapp.com`
- prod: `https://prod.xxxxx.amplifyapp.com`

### 5.7 GitHub Secrets に追加

GitHub → **Settings** → **Secrets and variables** → **Actions**

```
DEV_URL=https://develop.xxxxx.amplifyapp.com
STAGING_URL=https://staging.xxxxx.amplifyapp.com
PROD_URL=https://prod.xxxxx.amplifyapp.com
```

**詳細**: `docs/amplify-setup-guide.md`

---

## ステップ6: 動作確認（10分）

### 6.1 自動デプロイの確認

```bash
# developブランチで変更
git checkout develop
echo "# Deploy Test" >> README.md
git add README.md
git commit -m "test: 自動デプロイのテスト"
git push origin develop
```

Amplify Console でビルドが自動開始されることを確認

### 6.2 アプリの動作確認

各環境のURLにアクセス：
- https://develop.xxxxx.amplifyapp.com
- https://staging.xxxxx.amplifyapp.com
- https://prod.xxxxx.amplifyapp.com

### 6.3 E2Eテストの確認（staging/prod のみ）

```bash
# stagingへのPRを作成
git checkout staging
git merge develop
git push origin staging

# GitHub Actions で e2e-test が実行されることを確認
```

---

## 完了チェックリスト

### GitHub 設定
- [ ] GitHub Secrets 設定完了
- [ ] ブランチ作成完了（prod, staging, develop）
- [ ] ブランチ保護ルール設定完了
- [ ] CODEOWNERS 更新完了
- [ ] テストPR作成・マージ完了
- [ ] Status checks 追加完了

### Amplify 設定
- [ ] Amplify アプリ作成完了
- [ ] develop ブランチ接続完了
- [ ] staging ブランチ接続完了
- [ ] prod ブランチ接続完了
- [ ] 環境変数設定完了（全ブランチ）
- [ ] GitHub Secrets に URL 追加完了

### 動作確認
- [ ] 自動デプロイ動作確認
- [ ] 各環境のアプリ動作確認
- [ ] GitHub Actions 実行確認
- [ ] E2Eテスト実行確認（staging/prod）

---

## トラブルシューティング

### GitHub Actions が失敗する

1. **Actions** タブでエラーログを確認
2. Secrets が正しく設定されているか確認
3. `docs/testing-guide.md` のトラブルシューティングを参照

### Amplify ビルドが失敗する

1. Amplify Console でビルドログを確認
2. 環境変数が正しく設定されているか確認
3. `docs/amplify-setup-guide.md` のトラブルシューティングを参照

### Status checks が表示されない

1. 先にPRを作成してGitHub Actionsを実行
2. その後、ブランチ保護ルールで選択可能になる

---

## 次のステップ

CI/CDセットアップ完了後：

1. **フェーズ2: DB設計と実装** に進む
2. オプション設定：
   - Slack通知の設定
   - Codecovの設定
   - カスタムドメインの設定

---

## 参考ドキュメント

- `docs/github-secrets-checklist.md` - GitHub Secrets 詳細
- `docs/branch-setup-guide.md` - ブランチ設定詳細
- `docs/amplify-setup-guide.md` - Amplify 設定詳細
- `docs/setup-ci-cd.md` - CI/CD 全体ガイド
- `docs/branching-strategy.md` - ブランチ戦略
- `docs/testing-guide.md` - テストガイド
