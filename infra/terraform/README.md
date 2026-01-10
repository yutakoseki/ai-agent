# infra/terraform

Amplify Gen2 と周辺リソースを Terraform で管理するための雛形。

## 方針
- 環境別に state を分離し、`plan`/`apply` はレビュー経由で実行。
- S3 backend + DynamoDB ロックを使用し、`dev/staging/prod` を workspace で分離。
- Amplify の環境変数/シークレットも IaC で管理し、平文コミットを避ける。
- Queue/DB/ストレージなど共有リソースもここで定義し、テナント分離方針を反映する。

## S3 backend + workspace 例

```bash
terraform init \
  -backend-config="bucket=aiagent-terraform-state" \
  -backend-config="region=ap-northeast-1" \
  -backend-config="dynamodb_table=aiagent-terraform-lock" \
  -backend-config="encrypt=true" \
  -backend-config="key=terraform.tfstate" \
  -backend-config="workspace_key_prefix=aiagent"

terraform workspace new dev
terraform workspace new staging
terraform workspace new prod
```

## 共通スクリプト

反復作業をまとめたい場合は `scripts/terraform/provision.sh` を使います。

```bash
TF_STATE_BUCKET=aiagent-terraform-state \
TF_STATE_LOCK_TABLE=aiagent-terraform-lock \
AWS_REGION=ap-northeast-1 \
./scripts/terraform/provision.sh dynamodb dev apply
```

## 一括プロビジョニング

State backend をブートストラップした上で Cognito/DynamoDB を一括作成する場合:

```bash
TF_STATE_BUCKET=aiagent-terraform-state \
TF_STATE_LOCK_TABLE=aiagent-terraform-lock \
AWS_REGION=ap-northeast-1 \
TF_BOOTSTRAP_STATE=true \
./scripts/terraform/provision-all.sh dev apply
```

## GitHub Actions 運用

`.github/workflows/terraform-apply.yml` で `infra/terraform/**` の変更を自動反映します。

### GitHub Secrets

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `TF_STATE_BUCKET`（state 用 S3 バケット）
- `TF_STATE_LOCK_TABLE`（state 用 DynamoDB ロックテーブル）
- `TF_PROJECT`（任意。未設定なら `aiagent`）

### 初回のみ

state backend を作成してから実行します。

```bash
TF_STATE_BUCKET=aiagent-terraform-state \
TF_STATE_LOCK_TABLE=aiagent-terraform-lock \
AWS_REGION=ap-northeast-1 \
TF_BOOTSTRAP_STATE=true \
./scripts/terraform/provision-all.sh dev apply
```

### 以後は一括実行

```bash
TF_STATE_BUCKET=aiagent-terraform-state \
TF_STATE_LOCK_TABLE=aiagent-terraform-lock \
AWS_REGION=ap-northeast-1 \
./scripts/terraform/provision-all.sh dev apply
```

### backend 設定変更時

`Backend configuration changed` が出た場合は各モジュールで `terraform init -reconfigure` を一度実行してから再実行します。



