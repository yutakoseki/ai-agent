# Bootstrap (state backend)

Creates the S3 bucket and DynamoDB lock table used for Terraform state.

## Usage (example)

```bash
terraform init
terraform apply \
  -var "state_bucket_name=aiagent-terraform-state" \
  -var "lock_table_name=aiagent-terraform-lock" \
  -var "region=ap-northeast-1"
```
