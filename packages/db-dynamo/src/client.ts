import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const REGION =
  process.env.AMPLIFY_AWS_REGION ||
  process.env.AWS_REGION ||
  process.env.AMPLIFY_AWS_DEFAULT_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ap-northeast-1";
const ENDPOINT =
  process.env.DYNAMODB_ENDPOINT ||
  (process.env.NODE_ENV === "test" ? "http://localhost:8000" : undefined); // local fallback for tests

const ACCESS_KEY_ID =
  process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY =
  process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const SESSION_TOKEN =
  process.env.AMPLIFY_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;

// DynamoDB Local は適当なクレデンシャルが必要。AWS 本番では環境変数/ロールに委ねる。
const LOCAL_CREDS = {
  accessKeyId: ACCESS_KEY_ID || "local",
  secretAccessKey: SECRET_ACCESS_KEY || "local",
  sessionToken: SESSION_TOKEN,
};

const EXPLICIT_CREDS =
  ACCESS_KEY_ID && SECRET_ACCESS_KEY
    ? {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
        sessionToken: SESSION_TOKEN,
      }
    : undefined;

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: ENDPOINT ? LOCAL_CREDS : EXPLICIT_CREDS,
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
