# apps/web

Next.js (App Router) フロント/Route Handler 層の想定。

## 方針
- 認証・RBAC・テナント検証はここで終端し、AgentCore へはテナントスコープ済みの呼び出しのみ渡す。
- 公開/非公開環境変数の境界を守り、`.env` は `config/env.example` に従う。
- 状態管理は RSC 優先、クライアント側は最小限。

## 開発メモ
- パッケージ管理: pnpm (予定)
- lint/test: CIで影響範囲のみ実行する想定



