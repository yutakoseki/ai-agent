import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

/**
 * シングルテーブル → マルチテーブル バックフィル用スクリプト。
 *
 * 使い方（例）:
 * - single テーブル名: aiagent-dev
 * - multi テーブル名:  aiagent-dev-<suffix>
 *
 * 環境変数:
 * - DYNAMODB_TABLE_NAME (必須): ベース名（single=そのまま / multi=prefix）
 * - DYNAMODB_ENDPOINT (任意): local 用
 * - AWS_REGION / AMPLIFY_AWS_REGION (任意)
 */

const BASE = process.env.DYNAMODB_TABLE_NAME;
if (!BASE) {
  console.error("DYNAMODB_TABLE_NAME is required");
  process.exit(1);
}

const REGION =
  process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || undefined;

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: ENDPOINT ? { accessKeyId: "local", secretAccessKey: "local" } : undefined,
});
const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

const SINGLE_TABLE = BASE;
// 最小移行: ユーザー周りだけバックフィルする
const TABLES = {
  tenants: `${BASE}-tenants`,
  users: `${BASE}-users`,
  user_preferences: `${BASE}-user_preferences`,
  permission_policies: `${BASE}-permission_policies`,
};

function pickDestTable(item) {
  const pk = item?.PK;
  const sk = item?.SK;

  if (typeof pk !== "string" || typeof sk !== "string") return null;
  if (!pk.startsWith("TENANT#")) return null;

  if (sk.startsWith("TENANT#")) return TABLES.tenants;
  if (sk.startsWith("USER#")) return TABLES.users;
  if (sk === "POLICY#PERMISSIONS") return TABLES.permission_policies;
  if (sk.startsWith("USER_PREFS#")) return TABLES.user_preferences;

  return null;
}

async function batchWrite(tableName, items) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) chunks.push(items.slice(i, i + 25));

  for (const chunk of chunks) {
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((Item) => ({ PutRequest: { Item } })),
        },
      })
    );
  }
}

async function main() {
  console.log(`Scanning from single table: ${SINGLE_TABLE}`);

  let startKey = undefined;
  let scanned = 0;
  let routed = 0;
  let skipped = 0;

  while (true) {
    const res = await doc.send(
      new ScanCommand({
        TableName: SINGLE_TABLE,
        ExclusiveStartKey: startKey,
      })
    );

    const items = res.Items ?? [];
    scanned += items.length;

    const byTable = new Map();
    for (const item of items) {
      const dest = pickDestTable(item);
      if (!dest) {
        skipped += 1;
        continue;
      }
      routed += 1;
      if (!byTable.has(dest)) byTable.set(dest, []);
      byTable.get(dest).push(item);
    }

    for (const [dest, destItems] of byTable.entries()) {
      await batchWrite(dest, destItems);
    }

    if (scanned % 1000 === 0) {
      console.log({ scanned, routed, skipped });
    }

    startKey = res.LastEvaluatedKey;
    if (!startKey) break;
  }

  console.log("Done.", { scanned, routed, skipped });
  console.log("Next: deploy the app (it always uses multi-table now), then you can destroy the legacy single table.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


