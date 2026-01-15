import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@db/client";
import { getTableName } from "@db/table";

const TABLE_NAME = getTableName("rss_usage");

function sk(userId: string, date: string) {
  return `RSS_USAGE#USER#${userId}#DATE#${date}` as const;
}

function buildExpiresAt(days: number): number {
  const seconds = Math.floor(Date.now() / 1000);
  return seconds + days * 24 * 60 * 60;
}

export async function tryConsumeDailyQuota(params: {
  tenantId: string;
  userId: string;
  date: string;
  amount: number;
  max: number;
}): Promise<{ ok: boolean }> {
  if (params.amount <= 0 || params.max <= 0 || params.amount > params.max) {
    return { ok: false };
  }

  const now = new Date().toISOString();
  const maxMinus = params.max - params.amount;
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `TENANT#${params.tenantId}`,
          SK: sk(params.userId, params.date),
        },
        UpdateExpression:
          "SET summariesUsed = if_not_exists(summariesUsed, :zero) + :inc, userId = :userId, #date = :date, createdAt = if_not_exists(createdAt, :now), updatedAt = :now, expiresAt = :expiresAt",
        ConditionExpression:
          "attribute_not_exists(summariesUsed) OR summariesUsed <= :maxMinus",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":inc": params.amount,
          ":userId": params.userId,
          ":date": params.date,
          ":now": now,
          ":expiresAt": buildExpiresAt(120),
          ":maxMinus": maxMinus,
        },
        ExpressionAttributeNames: {
          "#date": "date",
        },
      })
    );
    return { ok: true };
  } catch (error: any) {
    const name = error && typeof error === "object" ? String(error.name) : "";
    if (name === "ConditionalCheckFailedException") {
      return { ok: false };
    }
    throw error;
  }
}
