## 現状

- Amplify Gen2（Web Compute / SSR）も Terraform（`infra/terraform/amplify/`）で管理します。
- Cognito と DynamoDB も Terraform で管理し、Amplify から参照します。

## 目的

- Amplify Gen2 に Next.js (`apps/web`) をデプロイし、Terraform 管理の Cognito/DynamoDB を利用する。

## 前提

- AWS CLI と Amplify CLI v12 以上がインストール済み。
- `pnpm install` 済み。
- AWS アカウントのクレデンシャルを `aws configure` で設定済み（`ap-northeast-1` 前提）。

## 手順（暫定）

1. インフラ初期化（Cognito/DynamoDB）

   ```bash
   cd /develop/project/ai-agent/infra/terraform
   terraform init
   terraform plan -var 'project=aiagent' -var 'environment=dev'
   terraform apply -var 'project=aiagent' -var 'environment=dev'
   ```

   - 出力: `user_pool_id`, `app_client_id`, `dynamodb_table_name` を控える。

2. Amplify プロジェクト作成（まだ Terraform 化していないため手動）

   ```bash
   cd /develop/project/ai-agent
   amplify init --appId <新規作成 or 既存ID> --envName dev
   ```

   - ビルドコマンドは `pnpm --filter @ai-agent/web build` を指定。
   - アーティファクトディレクトリは `.next`（App Router）を指定。

3. Amplify（Terraform）作成/更新（推奨）

   Amplify アプリは `infra/terraform/amplify/` で作成します。
   既に CLI/コンソールで作成済みの場合は **import** して Terraform 管理に取り込みます（後述）。

   ```bash
   cd /develop/project/ai-agent/infra/terraform/amplify
   terraform init
   terraform plan \
     -var 'project=aiagent' \
     -var 'environment=dev' \
     -var 'repository=<repo-url>' \
     -var 'oauth_token=<github-oauth-token>' \
     -var "cognito_user_pool_arn=<cognito出力>" \
     -var "dynamodb_policy_arn=<dynamodb出力>" \
     -var 'environment_variables={COGNITO_REGION="ap-northeast-1",COGNITO_USER_POOL_ID="<cognito出力>",COGNITO_CLIENT_ID="<cognito出力>",COGNITO_AUTH_FLOW="USER_PASSWORD_AUTH",DYNAMODB_TABLE_NAME="<dynamodb出力>",DYNAMODB_GSI1_NAME="GSI1",DYNAMODB_GSI2_NAME="GSI2",JWT_SECRET="<32文字以上>",SESSION_COOKIE_SECURE="true"}'
   terraform apply <同上>
   ```

4. 環境変数設定（Amplify コンソールまたは Terraform）

   ```
   NEXT_PUBLIC_API_BASE_URL=https://<domain>/api
   API_BASE_URL=https://<domain>/api
   COGNITO_REGION=ap-northeast-1
   COGNITO_USER_POOL_ID=<terraform出力>
   COGNITO_CLIENT_ID=<terraform出力>
   COGNITO_AUTH_FLOW=USER_PASSWORD_AUTH
   DYNAMODB_TABLE_NAME=<terraform出力>
   DYNAMODB_GSI1_NAME=GSI1
   DYNAMODB_GSI2_NAME=GSI2
   JWT_SECRET=<32文字以上のランダム値>
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   SESSION_COOKIE_NAME=session
   SESSION_COOKIE_SECURE=true
   LOG_LEVEL=info
   LOG_PRETTY=false
   LOG_SAMPLING_DEBUG=1
   ```

5. ビルド＆デプロイ
   - Amplify コンソールからブランチを接続し、ビルドを実行。
   - 必要に応じて `amplify.yml` のビルドステップを編集。

## トラブルシューティング（重要）

Amplify（SSR / Web Compute）でビルドは通るのにデプロイが失敗する場合は、以下を参照してください：

- [09-Amplify-Nextjs-SSR-デプロイ失敗の原因と解決.md](../09-Amplify-Nextjs-SSR-デプロイ失敗の原因と解決.md)

## PR のプレビュー（E2E の実行先）

PR時のE2Eは staging の固定URLではなく、Amplify の **ブランチURL（プレビュー）** を叩く前提です。

- [Amplifyプレビュー設定.md](./Amplifyプレビュー設定.md)

### ログインだけが 500 になる（ローカルはOK / AmplifyはNG）

`/api/auth/login` が Amplify で 500 になる場合、まず以下を確認してください。

- **Cognito 設定**: `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_AUTH_FLOW`
  - App Client が secret 有りの場合、`COGNITO_CLIENT_SECRET` が必要になります。可能なら **secret無しクライアント（`generate_secret=false`）を推奨**（`infra/terraform/cognito`）。
- **SSR Compute Role**（重要）:
  - DynamoDB が **CMK(KMS)** で暗号化されている場合、SSR実行ロールに `kms:Decrypt` 等が無いと 500 になります。
  - `infra/terraform/dynamodb` の `dynamodb_access` ポリシーに KMS 権限も含めるのが推奨です。
- **CloudWatch Logs**:
  - ランタイムログが CloudWatch に出ていないと原因調査が難しくなります。
  - `infra/terraform/amplify` で Service Role に CloudWatch Logs 権限を付与してください。

```bash
# appId/branch は Amplify のドメインから特定できる（例: develop.<appId>.amplifyapp.com）
AWS_PROFILE=ai-agent aws amplify get-app --app-id <appId> --region ap-northeast-1 \
  --query 'app.environmentVariables' --output table
```

#### ランタイムログ（CloudWatch）の見方

Service Role を設定すると、CloudWatch Logs に `/aws/amplify/<appId>` が作られます。
レスポンスの `traceId` を使って絞り込むと最短で原因に辿れます。

```bash
AWS_PROFILE=ai-agent aws logs filter-log-events \
  --region ap-northeast-1 \
  --log-group-name /aws/amplify/<appId> \
  --filter-pattern '<traceId>'
```

## セキュリティ注意（必須）

- **`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` のような長期キーを Amplify の環境変数や `amplify.yml` で配布しない**でください（漏洩リスクが高い）。
- 代わりに **SSR Compute Role** で DynamoDB/Cognito への権限を付与します（AWS公式: `https://docs.aws.amazon.com/ja_jp/amplify/latest/userguide/amplify-SSR-compute-role.html`）。
- 既に貼ってしまった場合は、IAM で **アクセスキーを無効化→削除→再発行（ローテーション）**してください。

## 今後のTODO

- ビルド成果物キャッシュと手動トリガを含む運用手順を追加する。
