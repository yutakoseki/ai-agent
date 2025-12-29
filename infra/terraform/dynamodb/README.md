# DynamoDB

Creates the DynamoDB table and the minimal IAM policy for Amplify access.

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
