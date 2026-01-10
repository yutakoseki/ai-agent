## DynamoDB Localを起動すること

- 起動:
  ```bash
  docker compose -f docker-compose.dynamodb.yml up -d
  ```
- シード（テーブル作成と初期データ投入）:
  ```bash
  DYNAMODB_ENDPOINT=http://localhost:8000 pnpm exec node packages/db-dynamo/scripts/seed.mjs
  ```