# DynamoDB

Creates the DynamoDB table and the minimal IAM policy for Amplify access.

## Notes

- このモジュールは DynamoDB を **CMK(KMS) で暗号化**します。
- そのため、DynamoDB の IAM アクセスポリシーには **KMS の `kms:Decrypt` / `kms:GenerateDataKey` 等**も含めています（Amplify(Web Compute) の SSR 実行ロールが無いと 500 で落ちるため）。

## Usage (example)

```bash
terraform init \
  -backend-config="bucket=aiagent-terraform-state" \
  -backend-config="region=ap-northeast-1" \
  -backend-config="dynamodb_table=aiagent-terraform-lock" \
  -backend-config="encrypt=true" \
  -backend-config="workspace_key_prefix=aiagent/dynamodb"

terraform workspace new dev

terraform plan -var "project=aiagent" -var "environment=dev"
terraform apply -var "project=aiagent" -var "environment=dev"
```

## Outputs

- `amplify_role_name` can be passed as `amplify_role_name` to attach policies to an existing role
