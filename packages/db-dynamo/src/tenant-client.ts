import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "./client";
import { TABLE_NAME, GSI1_NAME, GSI2_NAME } from "./table";

type TenantScopedKey = {
  tenantId: string;
};

function encodeCursor(key: Record<string, unknown> | undefined): string | undefined {
  if (!key) return undefined;
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    return undefined;
  } catch {
    return undefined;
  }
}

export async function getItem<T>(
  tenantId: string,
  sk: string
): Promise<T | null> {
  const res = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: sk },
      ConsistentRead: true,
    })
  );
  return (res.Item as T | undefined) ?? null;
}

export async function putItem(
  tenantId: string,
  sk: string,
  item: Record<string, unknown>
) {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${tenantId}`,
        SK: sk,
        ...item,
      },
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    })
  );
}

export async function queryByPrefix<T>(
  tenantId: string,
  prefix: string
): Promise<T[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":prefix": prefix,
      },
    })
  );
  return (res.Items as T[] | undefined) ?? [];
}

export async function queryByPrefixPage<T>(
  tenantId: string,
  prefix: string,
  opts: { limit: number; cursor?: string }
): Promise<{ items: T[]; nextCursor?: string }> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":prefix": prefix,
      },
      Limit: Math.max(1, Math.min(opts.limit, 1000)),
      ExclusiveStartKey: decodeCursor(opts.cursor ?? null) as any,
    })
  );
  return {
    items: (res.Items as T[] | undefined) ?? [],
    nextCursor: encodeCursor(res.LastEvaluatedKey as any),
  };
}

export async function queryGSI1<T>(
  gsi1pk: string,
  gsi1skPrefix?: string
): Promise<T[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_NAME,
      KeyConditionExpression: gsi1skPrefix
        ? "GSI1PK = :pk AND begins_with(GSI1SK, :sk)"
        : "GSI1PK = :pk",
      ExpressionAttributeValues: gsi1skPrefix
        ? { ":pk": gsi1pk, ":sk": gsi1skPrefix }
        : { ":pk": gsi1pk },
    })
  );
  return (res.Items as T[] | undefined) ?? [];
}

export async function queryGSI1Page<T>(
  gsi1pk: string,
  opts: { limit: number; cursor?: string; gsi1skPrefix?: string }
): Promise<{ items: T[]; nextCursor?: string }> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_NAME,
      KeyConditionExpression: opts.gsi1skPrefix
        ? "GSI1PK = :pk AND begins_with(GSI1SK, :sk)"
        : "GSI1PK = :pk",
      ExpressionAttributeValues: opts.gsi1skPrefix
        ? { ":pk": gsi1pk, ":sk": opts.gsi1skPrefix }
        : { ":pk": gsi1pk },
      Limit: Math.max(1, Math.min(opts.limit, 1000)),
      ExclusiveStartKey: decodeCursor(opts.cursor ?? null) as any,
    })
  );
  return {
    items: (res.Items as T[] | undefined) ?? [],
    nextCursor: encodeCursor(res.LastEvaluatedKey as any),
  };
}

export async function queryGSI2<T>(
  gsi2pk: string,
  gsi2skPrefix?: string
): Promise<T[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI2_NAME,
      KeyConditionExpression: gsi2skPrefix
        ? "GSI2PK = :pk AND begins_with(GSI2SK, :sk)"
        : "GSI2PK = :pk",
      ExpressionAttributeValues: gsi2skPrefix
        ? { ":pk": gsi2pk, ":sk": gsi2skPrefix }
        : { ":pk": gsi2pk },
    })
  );
  return (res.Items as T[] | undefined) ?? [];
}

export async function updateItem(
  tenantId: string,
  sk: string,
  updateExpr: string,
  values: Record<string, unknown>,
  names?: Record<string, string>
) {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: sk },
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: {
        ...values,
        ":pk": `TENANT#${tenantId}`,
      },
      ConditionExpression: "PK = :pk",
      ExpressionAttributeNames: names,
    })
  );
}

export async function deleteItem(tenantId: string, sk: string) {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: sk },
      ConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `TENANT#${tenantId}` },
    })
  );
}

export async function transactWrite(transactItems: Array<Record<string, unknown>>) {
  // TableName を省略できるようにする（呼び出し側で毎回指定しない）
  const normalized = transactItems.map((ti) => {
    const copy: any = { ...(ti as any) };
    if (copy.Put && !copy.Put.TableName) copy.Put.TableName = TABLE_NAME;
    if (copy.Delete && !copy.Delete.TableName) copy.Delete.TableName = TABLE_NAME;
    if (copy.Update && !copy.Update.TableName) copy.Update.TableName = TABLE_NAME;
    if (copy.ConditionCheck && !copy.ConditionCheck.TableName)
      copy.ConditionCheck.TableName = TABLE_NAME;
    return copy;
  });
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: normalized as any,
    })
  );
}

export const indexes = {
  GSI1_NAME,
  GSI2_NAME,
};
