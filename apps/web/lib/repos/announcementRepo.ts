import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@db/index";
import { getTableName } from "@db/table";
import { getItem } from "@db/tables/announcements";

export const ANNOUNCEMENT_BOARD_SK = "ANNOUNCEMENTS#BOARD";

export type AnnouncementBoardItem = {
  PK: `TENANT#${string}`;
  SK: typeof ANNOUNCEMENT_BOARD_SK;
  markdown: string;
  createdAt: string;
  updatedAt: string;
  updatedByUserId: string;
};

export async function getAnnouncementBoard(
  tenantId: string
): Promise<AnnouncementBoardItem | null> {
  return getItem<AnnouncementBoardItem>(tenantId, ANNOUNCEMENT_BOARD_SK);
}

export async function upsertAnnouncementBoard(params: {
  tenantId: string;
  markdown: string;
  updatedByUserId: string;
}): Promise<AnnouncementBoardItem> {
  const now = new Date().toISOString();
  const tableName = getTableName("announcements");

  const res = await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: `TENANT#${params.tenantId}`, SK: ANNOUNCEMENT_BOARD_SK },
      UpdateExpression:
        "SET #markdown = :markdown, updatedAt = :now, updatedByUserId = :updatedByUserId, createdAt = if_not_exists(createdAt, :now)",
      ExpressionAttributeNames: {
        "#markdown": "markdown",
      },
      ExpressionAttributeValues: {
        ":markdown": params.markdown,
        ":now": now,
        ":updatedByUserId": params.updatedByUserId,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return res.Attributes as AnnouncementBoardItem;
}


