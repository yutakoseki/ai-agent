# infra/terraform/amplify_branch_roles

既存の Amplify アプリ（1 app + 複数 branch）に対して、**branch ごとの SSR Compute Role を Terraform で作成し、branch に紐付ける**ためのモジュールです。

## 何をするか

- `aws_iam_role` / `aws_iam_policy`：SSR runtime が Cognito / DynamoDB（SSE-KMS含む）へアクセスできるようにする
- `aws_amplify_branch`：既存ブランチに `compute_role_arn` を設定する

## 重要（既存ブランチは import 必須）

現行の Terraform AWS Provider は `aws_amplify_branch` の `compute_role_arn` に未対応のため、
このモジュールは **AWS CLI を Terraform から実行して branch の compute role を設定**します。
そのため **branch の import は不要**です（IAM ロール/ポリシーは Terraform 管理）。

## 使い方（staging 例）

```bash
export AWS_PROFILE=ai-agent
export TF_STATE_BUCKET=aiagent-terraform-state
export TF_STATE_LOCK_TABLE=aiagent-terraform-lock
export AWS_REGION=ap-northeast-1

# init + workspace + plan/apply（apply 時に AWS CLI が必要）
./scripts/terraform/provision.sh amplify_branch_roles staging plan

# apply（IAM作成 + aws amplify update-branch 実行）
./scripts/terraform/provision.sh amplify_branch_roles staging apply
```

## prod 例

```bash
./scripts/terraform/provision.sh amplify_branch_roles prod plan
./scripts/terraform/provision.sh amplify_branch_roles prod apply
```

## 変数

- `app_id`: 既存 Amplify appId（デフォルト `d3twt10pcsc29v`）
- `branch_name`: 対象ブランチ名（未指定なら `environment`）
- `dynamodb_table_name`: 未指定なら `{project}-{environment}`（例: `aiagent-staging` / `aiagent-prod`）
- `cognito_user_pool_id`: デフォルトは現在の staging/prod の UserPool

## 安全策

Amplify 側の設定変更は `aws amplify update-branch --compute-role-arn` のみを実行し、環境変数等は触りません。


