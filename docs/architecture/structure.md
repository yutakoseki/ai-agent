# リポ構成ドラフトと実行順序

## ディレクトリ
- `apps/web` : Next.js (App Router)。認証/RBAC/テナント終端とBFFを担う。
- `services/agent-core` : Python。非同期ジョブ実行（キュー優先）、同期APIは最小限。
- `packages` : 型/SDK/設定スキーマを共有してドリフト防止。
- `infra/terraform` : Amplify Gen2 ほかインフラをIaC管理。
- `docs` : 設計・運用ドキュメント。

## 推奨実行順序
1) リポ階層の確定と README 記載
2) 環境変数スキーマ `config/env.example` / `packages/config` 雛形
3) CIドラフト（lint/test/build/SBOM、NodeとPythonをジョブ分離）
4) AgentCore 連携方針（非同期キュー優先、同期最小）
5) Terraform 雛形（Amplify Gen2 + 周辺）と state 分離
6) テスト戦略（コンポーネント/E2E/疎通の最低カバレッジ）

