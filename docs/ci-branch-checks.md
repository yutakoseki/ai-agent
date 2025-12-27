# ブランチ別チェックフロー（現行運用）

各ブランチでどのチェックを・何の目的で実行しているかのまとめ。

## develop
- **想定フロー**: ローカルから直接 push。リモート CI は develop push 時にユニットテスト＋カバレッジ送信のみ実行（`pr-test.yml` の unit-test ジョブ）。
- **ローカル Hook**
  - `pre-commit`: `pnpm --filter @ai-agent/web lint` / `type-check`（静的チェックで初期不良を弾く）
  - `pre-push`: `pnpm --filter @ai-agent/web test`（ユニット）→ `test:integration`（API挙動）→ `build`（型+Nextビルド検証）→ `ruff check services/agent-core`（Python lint）→ `pytest services/agent-core`（Pythonテスト）→ `terraform fmt -check / validate`（backend=false）
  - 目的: develop に壊れた状態を持ち込まない。`--no-verify` は原則禁止。
- **前提**: `git config core.hooksPath .husky`, `pnpm install`, `.env` に build 用 env を用意。Python/ruff/pytest/terraform がローカルにインストールされていること（手順: `docs/00-ローカル環境セットアップ.md` を参照）。Playwright ブラウザは `pnpm exec playwright install --with-deps` で事前に取得。

## staging
- **トリガー**: `pull_request` / `push` to `staging`
- **CI**
  - `pr-test.yml`: Lint → Unit → Integration → Build（@ai-agent/web）
  - `e2e-test.yml`: Playwright E2E（`pnpm test:e2e`、`BASE_URL` は `STAGING_URL` シークレット）
  - `backend-infra.yml`: Python lint/test（ruff + pytest, services/agent-core）、Terraform fmt/validate（infra/terraform）
- **目的**: リリース候補の品質担保。BFF/API挙動・UI疎通・AgentCore/Pythonのlint/test・Terraform基本検証を網羅。

## prod
- **トリガー**: `pull_request` / `push` to `prod`
- **CI**
  - staging と同構成（`pr-test.yml`, `e2e-test.yml`, `backend-infra.yml`）。`e2e-test.yml` では `BASE_URL` に `PROD_URL` を使用。
- **目的**: 本番反映前の最終ゲート。staging 同等のテストを本番向け URL で確認。

## E2E（Playwright）の補足
- テストディレクトリ: `apps/web/e2e/`（現状はトップページ疎通のサンプル `home.spec.ts` のみ。必要に応じてシナリオを追加）
- 設定: `apps/web/playwright.config.ts`。`BASE_URL` が未設定の場合は `http://localhost:3000` を使用。

## Terraform の補足
- CI では `terraform init -backend=false` → `terraform validate` まで。実際の plan/apply は含めていない。

## 運用メモ
- develop ではローカル hook が唯一のチェックなので、各端末で Husky セットアップと `.env` の用意を必須とする。
- staging/prod はリモート CI が走るため、緊急時を除き `--no-verify` は使わずローカルでもできるだけ同じフローを通す。
