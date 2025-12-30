import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION =
  process.env.AMPLIFY_AWS_REGION ||
  process.env.AWS_REGION ||
  "ap-northeast-1";
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000";
const ACCESS_KEY_ID =
  process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY =
  process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const SESSION_TOKEN =
  process.env.AMPLIFY_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "aiagent-dev";

const CREDENTIALS =
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
  credentials: ENDPOINT ? CREDENTIALS || { accessKeyId: "local", secretAccessKey: "local" } : CREDENTIALS,
});
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

async function ensureTable() {
  try {
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "PK", AttributeType: "S" },
          { AttributeName: "SK", AttributeType: "S" },
          { AttributeName: "GSI1PK", AttributeType: "S" },
          { AttributeName: "GSI1SK", AttributeType: "S" },
          { AttributeName: "GSI2PK", AttributeType: "S" },
          { AttributeName: "GSI2SK", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "GSI1",
            KeySchema: [
              { AttributeName: "GSI1PK", KeyType: "HASH" },
              { AttributeName: "GSI1SK", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
          {
            IndexName: "GSI2",
            KeySchema: [
              { AttributeName: "GSI2PK", KeyType: "HASH" },
              { AttributeName: "GSI2SK", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        ],
        SSESpecification: { Enabled: false }, // local
      })
    );
    console.log(`Created table ${TABLE_NAME}`);
  } catch (e) {
    if (e.name === "ResourceInUseException") {
      console.log(`Table ${TABLE_NAME} already exists`);
      return;
    }
    throw e;
  }
}

async function seed() {
  await ensureTable();

  const now = new Date().toISOString();

  const tenantId = process.env.SEED_TENANT_ID || "tenant-1";
  const adminSub =
    process.env.SEED_ADMIN_SUB || process.env.COGNITO_USER_SUB || "user-1";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminName = process.env.SEED_ADMIN_NAME || "管理者";

  await doc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${tenantId}`,
        SK: `TENANT#${tenantId}`,
        name: "サンプルテナント",
        plan: "Pro",
        enabled: true,
        createdAt: now,
        updatedAt: now,
        GSI1PK: "TENANT",
        GSI1SK: now,
      },
    })
  );

  await doc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${tenantId}`,
        SK: `USER#${adminSub}`,
        email: adminEmail,
        role: "Admin",
        name: adminName,
        createdAt: now,
        updatedAt: now,
        GSI1PK: "USER",
        GSI1SK: now,
        GSI2PK: `USER#${adminSub}`,
        GSI2SK: `TENANT#${tenantId}`,
      },
    })
  );

  console.log("Seed data inserted.");
  console.log(`Admin sub: ${adminSub}`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
