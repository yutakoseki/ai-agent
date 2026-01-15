import type { UserEmailAccountSubscription } from '@shared/mail';
import { getItem, putItem, queryGSI2, updateItem } from '@db/tables/user-email-subscriptions';
import type { UserEmailAccountSubscriptionItem } from '@db/types';

const SUB_PREFIX = 'USER_EMAIL_SUB#';

function buildSk(userId: string, accountId: string) {
  return `${SUB_PREFIX}USER#${userId}#ACCOUNT#${accountId}`;
}

function mapSub(item: UserEmailAccountSubscriptionItem): UserEmailAccountSubscription {
  return {
    tenantId: item.PK.replace('TENANT#', ''),
    userId: item.userId,
    accountId: item.accountId,
    monitoringEnabled: item.monitoringEnabled,
    pushEnabled: item.pushEnabled,
    role: item.role,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

export async function getUserEmailSubscription(params: {
  tenantId: string;
  userId: string;
  accountId: string;
}): Promise<UserEmailAccountSubscription | null> {
  const item = await getItem<UserEmailAccountSubscriptionItem>(
    params.tenantId,
    buildSk(params.userId, params.accountId)
  );
  return item ? mapSub(item) : null;
}

export async function listUserEmailSubscriptions(params: {
  userId: string;
}): Promise<UserEmailAccountSubscription[]> {
  const items = await queryGSI2<UserEmailAccountSubscriptionItem>(
    `USER#${params.userId}#EMAIL_SUB`
  );
  return items.map(mapSub);
}

export async function upsertUserEmailSubscription(params: {
  tenantId: string;
  userId: string;
  accountId: string;
  monitoringEnabled: boolean;
  pushEnabled: boolean;
  role?: UserEmailAccountSubscription['role'];
}): Promise<UserEmailAccountSubscription> {
  const now = new Date().toISOString();
  const sk = buildSk(params.userId, params.accountId);

  try {
    await putItem(params.tenantId, sk, {
      userId: params.userId,
      accountId: params.accountId,
      monitoringEnabled: params.monitoringEnabled,
      pushEnabled: params.pushEnabled,
      role: params.role ?? 'owner',
      createdAt: now,
      updatedAt: now,
      GSI2PK: `USER#${params.userId}#EMAIL_SUB`,
      GSI2SK: `ACCOUNT#${params.accountId}`,
    });
  } catch (error: any) {
    const name = error && typeof error === 'object' ? String(error.name) : '';
    if (name !== 'ConditionalCheckFailedException') throw error;

    await updateItem(
      params.tenantId,
      sk,
      'SET monitoringEnabled = :m, pushEnabled = :p, #role = :r, updatedAt = :u, GSI2PK = :g2pk, GSI2SK = :g2sk',
      {
        ':m': params.monitoringEnabled,
        ':p': params.pushEnabled,
        ':r': params.role ?? 'owner',
        ':u': now,
        ':g2pk': `USER#${params.userId}#EMAIL_SUB`,
        ':g2sk': `ACCOUNT#${params.accountId}`,
      },
      { '#role': 'role' }
    );
  }

  const item = await getItem<UserEmailAccountSubscriptionItem>(params.tenantId, sk);
  if (!item) throw new Error('Subscription not found after upsert');
  return mapSub(item);
}
