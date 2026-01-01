# CIドラフト（モノレポ: Next.js + Python + Terraform）

## 目的

- 影響範囲のみで lint/test/build を実行し、パイプライン時間を抑制。
- 言語ごとにジョブを分離し、失敗箇所を即特定。
- SBOM/脆弱性スキャンを Node/Python 両方で実施。

## ジョブ構成（例）

- `node-lint`: pnpm install（lockfile厳守）→ eslint / typecheck
- `node-test`: 影響範囲のみ jest/uvu 等を実行（App Router対応の設定）
- `node-build`: Next.js build（App Router）、環境変数は CI 用に最小注入
- `python-lint-test`: poetry/uv install → ruff/flake8 + pytest（影響範囲可）
- `sbom-sca`: Node/Python それぞれ sbom 生成 + 脆弱性スキャン（例: osv-scanner）
- `terraform-plan`: 環境別 state で plan を出力、PR に結果をコメント
- ※本リポ: `Backend & Infra Checks` で `python-lint-test` と `terraform-validate` を staging/prod の push/PR で実行

## 影響範囲の切り分け

- Turborepo または changesets で `apps/web` / `services/agent-core` / `packages` の差分を判定。
- Terraform は `infra/terraform` 配下の差分で plan をトリガ。

## キャッシュ方針

- Node: pnpm store + .next/cache（lint/test/buildで適用範囲を限定）
- Python: uv/poetry の仮想環境キャッシュ（バージョンと lockfile ハッシュをキー）
- Terraform: plugin/cache ディレクトリをキャッシュ（stateはS3/Dynamo等に分離）

## Secrets/Env

- CI用の最小限の環境変数を注入し、公開/非公開の境界を徹底。
- Amplify/Infra のシークレットは CI シークレットストアから供給、平文コミット禁止。

## 成果物

- Next.js build の `.next` / standalone 出力をアーティファクト化（必要時のみ）。
- SBOM レポートと脆弱性レポートをアーティファクト化し、ブロッカー基準を設定。

## 運用メモ

- PR 時: lint/test/sbom/terraform plan を必須。build はオプションでも可（頻度次第）。
- prod へのマージ後: build とデプロイ（Amplify Gen2）、AgentCore コンテナビルド/プッシュをトリガ。

## 現行のブランチ運用とE2Eの参照先（重要）

このリポジトリでは、環境ブランチは以下の運用を前提とします。

- **develop**: ローカルから直接 push して更新（ローカルhookで各種チェック）
- **staging 以降**: 必ず GitHub 上で PR を作って更新

### develop → staging のPR

- **GitHub Actions**: 各種チェックを実行
- **E2E（Playwright）**: staging のURLではなく、**PRの head ブランチ（= develop）の Amplify ブランチURL**を参照
  - 例: `https://develop.<appId>.amplifyapp.com`

### staging → prod のPR

- **GitHub Actions**: 各種チェックを実行
- **E2E（Playwright）**: **PRの head ブランチ（= staging）の Amplify ブランチURL**を参照
  - 例: `https://staging.<appId>.amplifyapp.com`

### push（staging / prod）

- `staging` への push: `STAGING_URL`（Secrets）を参照
- `prod` への push: `PROD_URL`（Secrets）を参照

> NOTE:
>
> - PR時に参照するブランチURLの組み立てには `AMPLIFY_APP_ID`（GitHub Secrets）が必要です。
> - `develop / staging / prod` は Amplify 側でブランチ接続されている必要があります（Auto branch creation は必須ではありません）。
