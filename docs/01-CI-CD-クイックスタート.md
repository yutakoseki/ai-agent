# CI/CD クイックスタートガイド（一人開発版）

このドキュメントでは、一人開発向けのCI/CDセットアップの全体の流れを説明します。

## 概要

以下の順序で設定を進めます：

```
1. GitHub Secrets 設定（5分）
   ↓
2. ブランチ作成（5分）
   ↓
3. テストPR作成とGitHub Actions実行（5分）
   ↓
4. ブランチ保護ルール設定（10分）
   ↓
5. CODEOWNERS 更新（5分）
   ↓
6. Amplify セットアップ（30分）
   ↓
7. 動作確認（10分）
```

**所要時間**: 約1時間

> **注意**: これは一人開発用の設定です。チーム開発の場合は `ci-cd-quickstart-team.md` を参照してください。

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

**詳細**: `docs/02-GitHub-Secrets-チェックリスト.md`

---

## ステップ2: ブランチ作成（5分）

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

# prodブランチ作成
git checkout -b prod
git push origin prod
```

**詳細**: `docs/03-ブランチ設定ガイド.md`

---

## ステップ3: テストPR作成とGitHub Actions実行（5分）

**重要**: ブランチ保護ルールを設定する前に、先にテストPRを作成してGitHub Actionsを実行します。
これにより、Status checksが選択可能になります。

### 3.1 テスト用ブランチ作成

```bash
# developブランチに移動
git checkout develop

# テスト用ブランチ作成
git checkout -b feature/test-ci

# 簡単な変更を追加
echo "# Test" >> README.md

# コミット
git add README.md
git commit -m "test: CI/CD動作確認"

# プッシュ
git push origin feature/test-ci
```

### 3.2 GitHub でPRを作成

1. GitHub リポジトリにアクセス
2. **Pull requests** タブをクリック
3. **New pull request** をクリック
4. base: `develop` ← compare: `feature/test-ci` を選択
5. **Create pull request** をクリック

### 3.3 GitHub Actions の実行を確認

**Actions** タブで以下が実行されることを確認：

- ✅ Lint and Format Check
- ✅ Unit Tests
- ✅ Integration Tests
- ✅ Build Check

**実行完了を待ちます（約2-3分）**

> この実行により、次のステップでStatus checksが選択可能になります。

---

## ステップ4: ブランチ保護ルール設定（10分）

GitHub Actions が実行された後、ブランチ保護ルールを設定します。

### 4.1 develop ブランチの保護ルール

GitHub → **Settings** → **Branches** → **Add branch protection rule**

```text
Branch name pattern: develop

☑ Require a pull request before merging
  Require approvals: 0  ← 一人なので0でOK

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  
  Status checks that are required:
  ☑ Lint and Format Check (GitHub Actions)
  ☑ unit-test (Any source)
  ☑ integration-test (Any source)
  ☑ Build Check (GitHub Actions)

☐ Require conversation resolution before merging  ← オフ
☐ Require linear history  ← オフ（好みで選択）
```

**Create** をクリック

> **注意**: `develop`ブランチには`e2e-test`は不要です（developへのPRではE2Eテストは実行されません）

### 4.2 staging ブランチの保護ルール

```text
Branch name pattern: staging

☑ Require a pull request before merging
  Require approvals: 0  ← 一人なので0でOK

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  
  Status checks that are required:
  ☑ Lint and Format Check (GitHub Actions)
  ☑ unit-test (Any source)
  ☑ integration-test (Any source)
  ☑ Build Check (GitHub Actions)
  ☑ e2e-test (Any source)

☐ Require conversation resolution before merging  ← オフ
```

**Create** をクリック

### 4.3 prod ブランチの保護ルール

```text
Branch name pattern: prod

☑ Require a pull request before merging
  Require approvals: 0  ← 一人なので0でOK

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  
  Status checks that are required:
  ☑ Lint and Format Check (GitHub Actions)
  ☑ unit-test (Any source)
  ☑ integration-test (Any source)
  ☑ Build Check (GitHub Actions)
  ☑ e2e-test (Any source)

☐ Require conversation resolution before merging  ← オフ
☐ Require linear history  ← オフ（好みで選択）
```

**Create** をクリック

> **重要**: "Any source"は、GitHub Actionsワークフローから来るステータスチェックを受け入れる設定です。そのままでOKです。

### 4.4 テストPRをマージ

ステップ3で作成したPRに戻り、全てのチェックが通ったら **Merge pull request** をクリック

---

## ステップ5: CODEOWNERS 更新（5分）

### 更新する理由
- PRの自動レビュアー割り当てが有効になり、レビュー漏れを防げる
- ブランチ保護の「CODEOWNERSの承認必須」を使う場合、正しい所有者が必要
- プレースホルダのままだと通知・承認が正しく機能しない

### 更新方法
1. `develop` ブランチで作業
2. `.github/CODEOWNERS` の `@your-org/...` を実在するユーザー名またはチーム名に置換
3. 変更をコミットして push

```bash
# 変更前（例）
* @your-org/core-team

# 変更後（あなたのGitHubユーザー名に変更）
* @your-github-username
```

```bash
git checkout develop

# 置換例
sed -i 's/@your-org\/core-team/@yutakoseki/g' .github/CODEOWNERS

# 置換後の確認（任意）
grep -n "@your-org" .github/CODEOWNERS

git add .github/CODEOWNERS
git commit -m "chore: CODEOWNERSを更新"
git push origin develop
```

---

## ステップ6: Amplify セットアップ（30分）

### 6.1 Amplify アプリ作成

1. [AWS Console](https://console.aws.amazon.com/) → **Amplify**
2. **Create new app** → **Host web app**
3. **GitHub** を選択 → リポジトリ選択
4. ブランチ: `develop` を選択

### 6.2 ビルド設定確認

`amplify.yml` が自動検出されることを確認

### 6.2.1 SSR（Web Compute）への切り替え【重要】

Next.js をバックエンド（API Routes/SSR）として使う場合、Amplify が **静的ホスティング（WEB）** のままだとトップページが **404** になります。必ず **SSR（WEB_COMPUTE）** に切り替えてください。

**手順（コンソール）**:
1. Amplify Console → 対象アプリ → **App settings** → **General**
2. **Platform** を `WEB_COMPUTE` に変更
3. **Hosting** → **Rewrites and redirects** で SPA ルール（`/<*> → /index.html (404-200)`）がある場合は削除
4. 再デプロイ

**補足**:
- `output: "export"` を使った静的ホスティングにする場合は、API Routes は利用できません

### 6.3 環境変数設定

**Advanced settings** で以下を追加：

```bash
# ブラウザから利用するAPIのベースURL（Next.jsのAPI RoutesならアプリURLと同一）
NEXT_PUBLIC_API_BASE_URL=https://develop.xxxxx.amplifyapp.com

# サーバーサイドから利用する内部APIのベースURL（同一オリジンなら上と同じ値）
API_BASE_URL=https://develop.xxxxx.amplifyapp.com

# アプリケーションが接続するDBの接続文字列（RDBを使う場合）
DATABASE_URL=postgres://user:pass@localhost:5432/dev_db

# 非同期ジョブ用のメッセージキュー（AMQP等）の接続URL
QUEUE_URL=amqp://user:pass@localhost:5672/vhost

# agent-coreサービスのAPIベースURL
AGENTCORE_API_URL=https://agent-core-dev.example.com

# agent-coreが利用するキュー名
AGENTCORE_QUEUE_NAME=agent-core-jobs-dev

# Amplify（AWS）**のリージョン**
AMPLIFY_REGION=ap-northeast-1

# デプロイ対象のブランチ名（環境識別に使用）
AMPLIFY_BRANCH=develop

# 認証用JWTの署名キー（本番は強力なランダム文字列）
JWT_SECRET=dev-jwt-secret-min-32-characters-long-change-in-production

# アクセストークンの有効期限
JWT_ACCESS_EXPIRES_IN=15m

# リフレッシュトークンの有効期限
JWT_REFRESH_EXPIRES_IN=7d

# セッションCookieの名前
SESSION_COOKIE_NAME=session

# Cookieの`Secure`属性（`true`ならHTTPSのみ）
SESSION_COOKIE_SECURE=true

# パスワードリセットトークンの有効期限
PASSWORD_RESET_EXPIRES_IN=1h

# パスワードリセット用トークンの署名キー（本番は強力なランダム文字列）
PASSWORD_RESET_SECRET=dev-password-reset-secret-min-32-characters-long
```

#### 値が未確定な場合の扱い

- この一覧の値は例なので、各環境の実値に置き換える（未準備なら一時的にダミーでも可）
- AmplifyのURLは初回デプロイ後に確定するため、決まり次第 `NEXT_PUBLIC_API_BASE_URL` と `API_BASE_URL` を更新する
- Next.jsのAPI Routesを使う構成なら、両方とも同じアプリURLにする（別バックエンドなら分ける）
- 本番環境では `JWT_SECRET` と `PASSWORD_RESET_SECRET` は必ず強力なランダム文字列にする
- DynamoDB利用予定の場合は `DATABASE_URL` を使わないため、DynamoDB用の設定に置き換える（必要なら `packages/config/src/env.ts` も更新）

### 6.4 デプロイ開始

**Save and deploy** → デプロイ完了を待つ（5-10分）

### 6.5 staging と prod ブランチを追加

同様の手順で `staging` と `prod` ブランチも接続

**重要**: 本番環境（prod）では強力なシークレットを使用：

```bash
# シークレット生成
openssl rand -base64 32
```

### 6.6 URLをコピー

各環境のURLをコピー：

- develop: `https://develop.xxxxx.amplifyapp.com`
- staging: `https://staging.xxxxx.amplifyapp.com`
- prod: `https://prod.xxxxx.amplifyapp.com`

### 6.7 GitHub Secrets に追加

GitHub → **Settings** → **Secrets and variables** → **Actions**

```
DEV_URL=https://develop.xxxxx.amplifyapp.com
STAGING_URL=https://staging.xxxxx.amplifyapp.com
PROD_URL=https://prod.xxxxx.amplifyapp.com
```

**詳細**: `docs/04-amplify-setup-guide.md`

---

## ステップ7: 動作確認（10分）

### 7.1 自動デプロイの確認

```bash
# developブランチで変更
git checkout develop
echo "# Deploy Test" >> README.md
git add README.md
git commit -m "test: 自動デプロイのテスト"
git push origin develop
```

Amplify Console でビルドが自動開始されることを確認

### 7.2 アプリの動作確認

各環境のURLにアクセス：

- <https://develop.xxxxx.amplifyapp.com>
- <https://staging.xxxxx.amplifyapp.com>
- <https://prod.xxxxx.amplifyapp.com>

### 7.3 E2Eテストの確認（staging/prod のみ）

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
- [ ] テストPR作成・実行完了
- [ ] ブランチ保護ルール設定完了
- [ ] テストPRマージ完了
- [ ] CODEOWNERS 更新完了

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

### Status checks が表示されない

**原因**: GitHub Actionsがまだ実行されていない

**解決方法**:

1. 先にPRを作成してGitHub Actionsを実行
2. その後、ブランチ保護ルールで選択可能になる

### GitHub Actions が失敗する

1. **Actions** タブでエラーログを確認
2. Secrets が正しく設定されているか確認
3. `docs/08-テストガイド.md` のトラブルシューティングを参照

### Amplify ビルドが失敗する

1. Amplify Console でビルドログを確認
2. 環境変数が正しく設定されているか確認
3. `docs/05-CI-CD-リファレンス.md` の Amplify セクションのトラブルシューティングを参照

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

- `docs/02-GitHub-Secrets-チェックリスト.md` - GitHub Secrets 詳細
- `docs/03-ブランチ設定ガイド.md` - ブランチ設定詳細
- `docs/05-CI-CD-リファレンス.md` - CI/CD 全体ガイド
- `docs/06-ブランチ戦略リファレンス.md` - ブランチ戦略
- `docs/07-ブランチ命名規則.md` - ブランチ命名規則
- `docs/07-Husky-セットアップ.md` - Husky セットアップ
- `docs/08-テストガイド.md` - テストガイド
- `docs/ci-cd-quickstart-team.md` - チーム開発版クイックスタート
