# Cognito (User Pool + App Client)

認証基盤（Cognito User Pool と App Client）を作成する Terraform 定義。

## 生成されるリソース

- User Pool
- App Client（`USER_PASSWORD_AUTH` / `ADMIN_USER_PASSWORD_AUTH` / `REFRESH_TOKEN_AUTH`）

## 使い方（例）

```bash
terraform init
terraform plan -var "project=aiagent" -var "environment=dev"
terraform apply -var "project=aiagent" -var "environment=dev"
```

## 出力（環境変数に反映する値）

- `user_pool_id` → `COGNITO_USER_POOL_ID`
- `app_client_id` → `COGNITO_CLIENT_ID`
- `app_client_secret` → `COGNITO_CLIENT_SECRET`（secretを有効にした場合）

## 変更ポイント

- パスワードポリシー/MFA/トークン期限は `main.tf` の変数で調整する。
- secret なしを推奨する場合は `cognito_client_generate_secret=false` を維持する。
