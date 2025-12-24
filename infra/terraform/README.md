# infra/terraform

Amplify Gen2 と周辺リソースを Terraform で管理するための雛形。

## 方針
- 環境別に state を分離し、`plan`/`apply` はレビュー経由で実行。
- Amplify の環境変数/シークレットも IaC で管理し、平文コミットを避ける。
- Queue/DB/ストレージなど共有リソースもここで定義し、テナント分離方針を反映する。

