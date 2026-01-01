import { DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "@db/index";

export type NoticeItem = {
  PK: "GLOBAL";
  SK: `NOTICE#${string}`;
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
};

const NOTICE_PREFIX = "NOTICE#";
const GLOBAL_PK = "GLOBAL" as const;

export async function listNotices(): Promise<NoticeItem[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": GLOBAL_PK,
        ":prefix": NOTICE_PREFIX,
      },
    })
  );

  const items = (res.Items as NoticeItem[] | undefined) ?? [];
  // DynamoDBの返却順（SK順）はUUIDだと意味がないので、更新日時で並び替える
  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function createNotice(params: {
  title: string;
  body: string;
  actorUserId: string;
}): Promise<NoticeItem> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const sk = `NOTICE#${id}` as const;

  const item: Omit<NoticeItem, "PK" | "SK"> = {
    id,
    title: params.title,
    body: params.body,
    createdAt: now,
    updatedAt: now,
    createdByUserId: params.actorUserId,
    updatedByUserId: params.actorUserId,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: GLOBAL_PK, SK: sk, ...item },
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    })
  );
  return { PK: GLOBAL_PK, SK: sk, ...item };
}

export async function updateNotice(params: {
  id: string;
  title: string;
  body: string;
  actorUserId: string;
}): Promise<NoticeItem> {
  const now = new Date().toISOString();
  const sk = `NOTICE#${params.id}` as const;

  const res = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: GLOBAL_PK, SK: sk },
      UpdateExpression:
        "SET #title = :title, #body = :body, updatedAt = :now, updatedByUserId = :actor",
      ExpressionAttributeNames: {
        "#title": "title",
        "#body": "body",
      },
      ExpressionAttributeValues: {
        ":title": params.title,
        ":body": params.body,
        ":now": now,
        ":actor": params.actorUserId,
        ":pk": GLOBAL_PK,
      },
      ConditionExpression: "PK = :pk",
      ReturnValues: "ALL_NEW",
    })
  );

  return res.Attributes as NoticeItem;
}

export async function deleteNotice(params: {
  id: string;
}): Promise<void> {
  const sk = `NOTICE#${params.id}`;
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: GLOBAL_PK, SK: sk },
      ConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": GLOBAL_PK },
    })
  );
}


