import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "./client";
import { GSI1_NAME, GSI2_NAME } from "./table";

type CreateTenantClientOptions = {
  tableName: string;
  gsi1Name?: string;
  gsi2Name?: string;
};

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

/**
 * `tenant-client.ts` の機能を「テーブル名を固定したクライアント」として生成する。
 * 単一テーブル→マルチテーブル移行で、Repoごとに対象テーブルを切り替えるために使用。
 */
export function createTenantClient(opts: CreateTenantClientOptions) {
  const tableName = opts.tableName;
  const gsi1Name = opts.gsi1Name ?? GSI1_NAME;
  const gsi2Name = opts.gsi2Name ?? GSI2_NAME;

  async function getItem<T>(tenantId: string, sk: string): Promise<T | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: `TENANT#${tenantId}`, SK: sk },
        ConsistentRead: true,
      })
    );
    return (res.Item as T | undefined) ?? null;
  }

  async function putItem(tenantId: string, sk: string, item: Record<string, unknown>) {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `TENANT#${tenantId}`,
          SK: sk,
          ...item,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  }

  async function queryByPrefix<T>(tenantId: string, prefix: string): Promise<T[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":prefix": prefix,
        },
      })
    );
    return (res.Items as T[] | undefined) ?? [];
  }

  async function queryByPrefixPage<T>(
    tenantId: string,
    prefix: string,
    opts2: { limit: number; cursor?: string }
  ): Promise<{ items: T[]; nextCursor?: string }> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":prefix": prefix,
        },
        Limit: Math.max(1, Math.min(opts2.limit, 1000)),
        ExclusiveStartKey: decodeCursor(opts2.cursor ?? null) as any,
      })
    );
    return {
      items: (res.Items as T[] | undefined) ?? [],
      nextCursor: encodeCursor(res.LastEvaluatedKey as any),
    };
  }

  async function queryGSI1<T>(gsi1pk: string, gsi1skPrefix?: string): Promise<T[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: gsi1Name,
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

  async function queryGSI1Page<T>(
    gsi1pk: string,
    opts2: { limit: number; cursor?: string; gsi1skPrefix?: string }
  ): Promise<{ items: T[]; nextCursor?: string }> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: gsi1Name,
        KeyConditionExpression: opts2.gsi1skPrefix
          ? "GSI1PK = :pk AND begins_with(GSI1SK, :sk)"
          : "GSI1PK = :pk",
        ExpressionAttributeValues: opts2.gsi1skPrefix
          ? { ":pk": gsi1pk, ":sk": opts2.gsi1skPrefix }
          : { ":pk": gsi1pk },
        Limit: Math.max(1, Math.min(opts2.limit, 1000)),
        ExclusiveStartKey: decodeCursor(opts2.cursor ?? null) as any,
      })
    );
    return {
      items: (res.Items as T[] | undefined) ?? [],
      nextCursor: encodeCursor(res.LastEvaluatedKey as any),
    };
  }

  async function queryGSI2<T>(gsi2pk: string, gsi2skPrefix?: string): Promise<T[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: gsi2Name,
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

  async function updateItem(
    tenantId: string,
    sk: string,
    updateExpr: string,
    values: Record<string, unknown>,
    names?: Record<string, string>
  ) {
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
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

  async function deleteItem(tenantId: string, sk: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK: `TENANT#${tenantId}`, SK: sk },
        ConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": `TENANT#${tenantId}` },
      })
    );
  }

  async function transactWrite(transactItems: Array<Record<string, unknown>>) {
    // TableName を省略できるようにする（呼び出し側で毎回指定しない）
    const normalized = transactItems.map((ti) => {
      const copy: any = { ...(ti as any) };
      if (copy.Put && !copy.Put.TableName) copy.Put.TableName = tableName;
      if (copy.Delete && !copy.Delete.TableName) copy.Delete.TableName = tableName;
      if (copy.Update && !copy.Update.TableName) copy.Update.TableName = tableName;
      if (copy.ConditionCheck && !copy.ConditionCheck.TableName)
        copy.ConditionCheck.TableName = tableName;
      return copy;
    });
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: normalized as any,
      })
    );
  }

  return {
    getItem,
    putItem,
    queryByPrefix,
    queryByPrefixPage,
    queryGSI1,
    queryGSI1Page,
    queryGSI2,
    updateItem,
    deleteItem,
    transactWrite,
    indexes: {
      GSI1_NAME: gsi1Name,
      GSI2_NAME: gsi2Name,
    },
  };
}

export type TenantClient = ReturnType<typeof createTenantClient>;

export function tenantKey({ tenantId }: TenantScopedKey) {
  return `TENANT#${tenantId}`;
}


