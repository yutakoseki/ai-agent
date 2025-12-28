import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const ENDPOINT =
  process.env.DYNAMODB_ENDPOINT ||
  (process.env.NODE_ENV === "test" ? "http://localhost:8000" : undefined); // local fallback for tests

// DynamoDB Local は適当なクレデンシャルが必要。AWS 本番では環境変数/ロールに委ねる。
const LOCAL_CREDS = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
};

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: ENDPOINT ? LOCAL_CREDS : undefined,
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

