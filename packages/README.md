# packages

共通の型定義/SDK/設定スキーマを置く領域。

推奨構成例:

- `packages/config`: 環境変数スキーマと設定読み込みロジック
- `packages/types`: API/DTO/ドメインの型
- `packages/sdk`: BFF→AgentCore など内部向けクライアント

モノレポ内のサービス間で依存を共有し、仕様ドリフトを防ぐ。


