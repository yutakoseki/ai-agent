# Amplify Gen2

Amplify アプリ、**Service Role（CloudWatch Logs 含む）**、**SSR Compute Role**、環境変数を Terraform で管理します。

## 事前準備

- S3 backend 用のバケットと DynamoDB ロックテーブルを用意
- リポジトリ連携用の OAuth トークンを用意

## 使い方（例）

```bash
terraform init \
  -backend-config="bucket=aiagent-terraform-state" \
  -backend-config="region=ap-northeast-1" \
  -backend-config="dynamodb_table=aiagent-terraform-lock" \
  -backend-config="encrypt=true" \
  -backend-config="workspace_key_prefix=aiagent/amplify"

terraform workspace new dev

terraform plan \
  -var "project=aiagent" \
  -var "environment=dev" \
  -var "repository=https://github.com/your-org/ai-agent" \
  -var "oauth_token=${GITHUB_TOKEN}" \
  -var "cognito_user_pool_arn=arn:aws:cognito-idp:ap-northeast-1:123456789012:userpool/ap-northeast-1_XXXX" \
  -var "dynamodb_policy_arn=arn:aws:iam::123456789012:policy/aiagent-dev-dynamodb-access" \
  -var 'environment_variables={NEXT_PUBLIC_API_BASE_URL="https://develop.xxxxx.amplifyapp.com",API_BASE_URL="https://develop.xxxxx.amplifyapp.com",COGNITO_REGION="ap-northeast-1",COGNITO_USER_POOL_ID="...",COGNITO_CLIENT_ID="...",DYNAMODB_TABLE_NAME="aiagent-dev",JWT_SECRET="..." }'
```

## 変数のポイント

- `environment_variables` で Amplify の環境変数を設定
- `dynamodb_policy_arn` は DynamoDB モジュールの出力に合わせて指定
- `cognito_user_pool_arn` は Cognito モジュールの出力に合わせて指定

## 既存リソースを Terraform 管理に取り込む（import）

既に Amplify アプリ/ロールを CLI やコンソールで作成済みの場合は、同じ名前で Terraform 側の定義を用意してから `terraform import` します。

例（appId が `d3twt10pcsc29v`、ブランチが `develop` の場合）:

```bash
# Amplify app
terraform import aws_amplify_app.main d3twt10pcsc29v

# Amplify branch（作成している場合）
terraform import 'aws_amplify_branch.main[0]' d3twt10pcsc29v/develop

# IAM roles（名前が一致するように service_role_name / compute_role_name を指定してから import）
terraform import aws_iam_role.amplify_service ai-agent-amplify-service-role
terraform import aws_iam_role.amplify_compute ai-agent-amplify-ssr-compute-develop
```

###### Note

- import 後に `terraform plan` で差分が出る場合は、環境変数やロール名の指定が一致しているかを確認してください。
