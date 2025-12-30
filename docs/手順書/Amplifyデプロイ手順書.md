## 現状
- Amplify Gen2 用の Terraform 定義はまだ追加前です（`infra/terraform/amplify/` はプレースホルダー）。
- Cognito と DynamoDB は Terraform で管理済みです。Amplify から参照する前提で進めます。

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

3. 環境変数設定（Amplify コンソールまたは CLI）
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

4. ビルド＆デプロイ
   - Amplify コンソールからブランチを接続し、ビルドを実行。
   - 必要に応じて `amplify.yml` のビルドステップを編集。

## トラブルシューティング（重要）

Amplify（SSR / Web Compute）でビルドは通るのにデプロイが失敗する場合は、以下を参照してください：

- [09-Amplify-Nextjs-SSR-デプロイ失敗の原因と解決.md](../09-Amplify-Nextjs-SSR-デプロイ失敗の原因と解決.md)

## 今後のTODO
- Terraform で Amplify Gen2 アプリを管理するモジュールを追加し、環境変数も IaC 化する。
- ビルド成果物キャッシュと手動トリガを含む運用手順を追加する。