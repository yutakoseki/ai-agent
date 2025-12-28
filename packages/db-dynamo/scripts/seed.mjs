import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "ap-northeast-1";
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000";
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "aiagent-dev";

const client = new DynamoDBClient({ region: REGION, endpoint: ENDPOINT });
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

  const tenantId = "tenant-1";
  const adminId = "user-1";

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
        SK: `USER#${adminId}`,
        email: "admin@example.com",
        role: "Admin",
        name: "管理者",
        passwordHash:
          "$2b$12$f1rxQ0wpDLldae4uHS7SduS2uaXkXPoNLjvYQETRfp1cv34XAmBES", // "Test1234"
        createdAt: now,
        updatedAt: now,
        GSI1PK: "USER",
        GSI1SK: now,
        GSI2PK: `USER#${adminId}`,
        GSI2SK: `TENANT#${tenantId}`,
      },
    })
  );

  console.log("Seed data inserted.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

