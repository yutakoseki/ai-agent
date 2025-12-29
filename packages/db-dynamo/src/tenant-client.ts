import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "./client";
import { TABLE_NAME, GSI1_NAME, GSI2_NAME } from "./table";

type TenantScopedKey = {
  tenantId: string;
};

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
  values: Record<string, unknown>
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
      ExpressionAttributeNames: undefined,
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

export const indexes = {
  GSI1_NAME,
  GSI2_NAME,
};
