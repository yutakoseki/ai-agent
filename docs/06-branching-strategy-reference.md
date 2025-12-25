# ブランチ戦略と CI/CD

このドキュメントでは、Git ブランチ戦略、CI/CD パイプライン、デプロイフローについて説明します。

## ブランチ戦略

### ブランチモデル：GitHub Flow + 環境ブランチ

```
prod (本番環境)
  ↑
staging (ステージング環境)
  ↑
develop (開発環境)
  ↑
feature/* (機能開発)
```

### ブランチの役割

#### 1. `prod` - 本番環境

- **目的**: 本番環境にデプロイされるコード
- **保護**: 直接 push は禁止、PR のみ
- **デプロイ**: 自動デプロイ（Amplify）
- **テスト**: E2E + 全テスト必須
- **レビュー**: 0 名以上の承認必須

#### 2. `staging` - ステージング環境

- **目的**: 本番前の最終確認
- **保護**: 直接 push は禁止、PR のみ
- **デプロイ**: 自動デプロイ（Amplify）
- **テスト**: 統合テスト + E2E
- **レビュー**: 0 名以上の承認必須

#### 3. `develop` - 開発環境

- **目的**: 機能統合とテスト
- **保護**: 直接 push は禁止、PR のみ
- **デプロイ**: 自動デプロイ（Amplify）
- **テスト**: 単体テスト + 統合テスト
- **レビュー**: 0 名以上の承認必須

#### 4. `feature/*` - 機能開発ブランチ

- **命名規則**: `feature/[issue番号]-[機能名]`
- **例**: `feature/123-user-authentication`
- **作成元**: `develop` から分岐
- **マージ先**: `develop` へマージ
- **ライフサイクル**: マージ後削除

#### 5. `hotfix/*` - 緊急修正ブランチ

- **命名規則**: `hotfix/[issue番号]-[修正内容]`
- **例**: `hotfix/456-fix-login-bug`
- **作成元**: `prod` から分岐
- **マージ先**: `prod` と `develop` の両方
- **ライフサイクル**: マージ後削除

---

## 開発フロー

### 1. 機能開発の流れ

```bash
# 1. developブランチを最新化
git checkout develop
git pull origin develop

# 2. 機能ブランチを作成
git checkout -b feature/123-add-tenant-api

# 3. 開発とコミット
git add .
git commit -m "feat: テナント管理APIを追加"

# 4. プッシュ
git push origin feature/123-add-tenant-api

# 5. GitHub でPR作成（develop へ）

# 6. レビュー後、マージ

# 7. ブランチ削除
git branch -d feature/123-add-tenant-api
```

### 2. ステージング環境へのデプロイ

```bash
# developからstagingへPR作成
# レビュー + テスト通過後、マージ
# → 自動的にステージング環境にデプロイ
```

### 3. 本番環境へのデプロイ

```bash
# stagingからmainへPR作成
# レビュー + E2Eテスト通過後、マージ
# → 自動的に本番環境にデプロイ
```

### 4. 緊急修正（Hotfix）の流れ

```bash
# 1. prodから緊急修正ブランチを作成
git checkout prod
git pull origin prod
git checkout -b hotfix/456-fix-critical-bug

# 2. 修正とコミット
git add .
git commit -m "fix: 重大なバグを修正"

# 3. プッシュ
git push origin hotfix/456-fix-critical-bug

# 4. prodへPR作成 → レビュー → マージ → 本番デプロイ

# 5. developへもマージ（バックポート）
git checkout develop
git merge hotfix/456-fix-critical-bug
git push origin develop
```

---

## CI/CD パイプライン

### パイプライン概要

```
┌─────────────┐
│ Push/PR作成 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Lint/Format│ ← ESLint, Prettier
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  単体テスト  │ ← Vitest (高速)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  統合テスト  │ ← API Tests
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   ビルド    │ ← Next.js build
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ E2Eテスト   │ ← Playwright (staging/prod のみ)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   デプロイ   │ ← Amplify
└─────────────┘
```

### ブランチ別のテスト実行

| ブランチ   | Lint | 単体 | 統合 | E2E | デプロイ          |
| ---------- | ---- | ---- | ---- | --- | ----------------- |
| feature/\* | ✅   | ✅   | ✅   | ❌  | ❌                |
| develop    | ✅   | ✅   | ✅   | ❌  | ✅ (開発環境)     |
| staging    | ✅   | ✅   | ✅   | ✅  | ✅ (ステージング) |
| prod       | ✅   | ✅   | ✅   | ✅  | ✅ (本番)         |
| hotfix/\*  | ✅   | ✅   | ✅   | ✅  | ❌                |

---

## GitHub Actions ワークフロー

### 1. PR 時のテストワークフロー

`.github/workflows/pr-test.yml`

```yaml
name: PR Tests

on:
  pull_request:
    branches:
      - develop
      - staging
      - prod

jobs:
  lint:
    name: Lint and Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

      - name: Check formatting
        run: pnpm format:check

  unit-test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm --filter @ai-agent/web test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/web/coverage/coverage-final.json

  integration-test:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-test
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run integration tests
        run: pnpm --filter @ai-agent/web test:integration
        env:
          JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

  build:
    name: Build Check
    runs-on: ubuntu-latest
    needs: integration-test
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm --filter @ai-agent/web build
```

### 2. E2E テストワークフロー（staging/prod のみ）

`.github/workflows/e2e-test.yml`

```yaml
name: E2E Tests

on:
  pull_request:
    branches:
      - staging
      - prod
  push:
    branches:
      - staging
      - prod

jobs:
  e2e-test:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          BASE_URL: ${{ github.ref == 'refs/heads/prod' && secrets.PROD_URL || secrets.STAGING_URL }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### 3. デプロイワークフロー

`.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches:
      - develop
      - staging
      - prod

jobs:
  deploy:
    name: Deploy to Amplify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/prod" ]]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "amplify_branch=prod" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "amplify_branch=staging" >> $GITHUB_OUTPUT
          else
            echo "environment=development" >> $GITHUB_OUTPUT
            echo "amplify_branch=develop" >> $GITHUB_OUTPUT
          fi

      - name: Deploy to Amplify
        run: |
          echo "Deploying to ${{ steps.env.outputs.environment }}"
          # Amplify は自動的にデプロイされるため、ここでは通知のみ

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Deploy to ${{ steps.env.outputs.environment }}
            Branch: ${{ github.ref }}
            Commit: ${{ github.sha }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## コミットメッセージ規約

### Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type（必須）

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの意味に影響しない変更（空白、フォーマット等）
- `refactor`: バグ修正や機能追加を伴わないコード変更
- `perf`: パフォーマンス改善
- `test`: テストの追加・修正
- `chore`: ビルドプロセスやツールの変更

### 例

```bash
# 新機能
git commit -m "feat(auth): ログイン機能を追加"

# バグ修正
git commit -m "fix(api): テナント作成時のバリデーションを修正"

# ドキュメント
git commit -m "docs: テストガイドを追加"

# リファクタリング
git commit -m "refactor(middleware): 認証ミドルウェアを整理"

# テスト
git commit -m "test(auth): パスワード検証のテストを追加"

# 破壊的変更
git commit -m "feat(api)!: ユーザーAPIのレスポンス形式を変更

BREAKING CHANGE: レスポンスの構造が変更されました"
```

---

## プルリクエスト（PR）テンプレート

`.github/pull_request_template.md`

```markdown
## 概要

<!-- このPRで何を実現するか簡潔に説明 -->

## 変更内容

<!-- 主な変更点をリストアップ -->

-
-

## 関連 Issue

<!-- 関連するIssue番号を記載 -->

Closes #

## テスト

<!-- 実施したテストを記載 -->

- [ ] 単体テスト追加・更新
- [ ] 統合テスト追加・更新
- [ ] 手動テスト実施
- [ ] E2E テスト確認（staging/prod のみ）

## チェックリスト

- [ ] コードレビュー依頼済み
- [ ] テストが全て通過
- [ ] ドキュメント更新済み
- [ ] 破壊的変更がある場合、マイグレーション手順を記載

## スクリーンショット（該当する場合）

<!-- UIの変更がある場合、スクリーンショットを添付 -->

## 備考

<!-- その他、レビュアーに伝えたいことがあれば記載 -->
```

## デプロイ戦略

### 環境と URL

| 環境         | ブランチ | URL                         | 用途             |
| ------------ | -------- | --------------------------- | ---------------- |
| 開発         | develop  | https://dev.example.com     | 開発者の動作確認 |
| ステージング | staging  | https://staging.example.com | QA・本番前確認   |
| 本番         | prod     | https://example.com         | エンドユーザー   |

### デプロイタイミング

```
feature/* → develop
  ↓ (自動デプロイ: 開発環境)
  ↓ QA確認
  ↓
develop → staging
  ↓ (自動デプロイ: ステージング環境)
  ↓ E2Eテスト + 最終確認
  ↓
staging → prod
  ↓ (自動デプロイ: 本番環境)
  ↓ 本番監視
```

### ロールバック手順

```bash
# 1. 問題を検知

# 2. 緊急対応：前のコミットに戻す
git checkout prod
git revert HEAD
git push origin prod

# 3. または、特定のコミットまで戻す
git reset --hard <前の安定版コミット>
git push origin prod --force-with-lease

# 4. 根本原因の修正
# hotfixブランチで修正 → PR → マージ
```

---

## モニタリングとアラート

### デプロイ後の確認項目

- [ ] アプリケーションが起動している
- [ ] ヘルスチェックエンドポイントが正常
- [ ] エラーログが増加していない
- [ ] レスポンスタイムが正常範囲内
- [ ] 主要機能が動作している

### アラート設定

```yaml
# Amplify Console でアラート設定
- ビルド失敗
- デプロイ失敗
- エラー率が閾値を超過
- レスポンスタイムが閾値を超過
```

---

## FAQ

### Q: feature ブランチから直接 staging にマージできますか？

A: いいえ。必ず `develop` を経由してください。これにより、開発環境での統合テストが保証されます。

### Q: 緊急修正が必要な場合、テストをスキップできますか？

A: いいえ。緊急修正でも最低限の単体テスト・統合テストは必須です。ただし、E2E テストは本番デプロイ後に実施することも可能です。

### Q: develop ブランチが壊れた場合はどうすればいいですか？

A:

1. 問題のコミットを特定
2. `git revert` で該当コミットを取り消し
3. 修正版を新しい PR で作成

### Q: 複数の機能を同時に開発する場合は？

A: 各機能ごとに独立した `feature/*` ブランチを作成し、並行開発してください。マージ競合が発生した場合は、後からマージする側が解決します。

---

## 参考リンク

- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
- [GitHub Actions](https://docs.github.com/en/actions)
