import { randomUUID } from 'crypto';
import type { MailCategory, Task, TaskStatus } from '@shared/mail';
import {
  getItem,
  putItem,
  queryByPrefix,
  queryGSI1,
  queryGSI2,
  updateItem,
} from '@db/tables/tasks';
import type { TaskItem } from '@db/types';

const TASK_PREFIX = 'TASK#';

function mapTask(item: TaskItem): Task {
  return {
    id: item.id,
    tenantId: item.PK.replace('TENANT#', ''),
    userId: item.userId,
    accountId: item.accountId,
    category: item.category as MailCategory | undefined,
    from: item.from,
    counterparty: item.counterparty,
    title: item.title,
    summary: item.summary,
    nextAction: item.nextAction,
    dueAt: item.dueAt ? new Date(item.dueAt) : undefined,
    status: item.status,
    sourceProvider: item.sourceProvider,
    sourceMessageId: item.sourceMessageId,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

function buildStatusGsi(tenantId: string, status: TaskStatus) {
  return `TENANT#${tenantId}#TASK#STATUS#${status}`;
}

export function buildTaskIdFromMessage(provider: string, messageId: string): string {
  return `msg-${provider}-${messageId}`;
}

export function buildTaskIdFromThread(provider: string, threadId: string): string {
  return `thread-${provider}-${threadId}`;
}

export async function getTaskById(tenantId: string, taskId: string): Promise<Task | null> {
  const item = await getItem<TaskItem>(tenantId, `${TASK_PREFIX}${taskId}`);
  return item ? mapTask(item) : null;
}

export async function listTasks(params: {
  tenantId: string;
  status?: TaskStatus;
  userId?: string;
}): Promise<Task[]> {
  if (params.userId) {
    const items = await queryGSI2<TaskItem>(`USER#${params.userId}#TASK`);
    return items.map(mapTask);
  }

  if (params.status) {
    const items = await queryGSI1<TaskItem>(buildStatusGsi(params.tenantId, params.status));
    return items.map(mapTask);
  }

  const items = await queryByPrefix<TaskItem>(params.tenantId, TASK_PREFIX);
  return items.map(mapTask);
}

export async function createTask(params: {
  tenantId: string;
  userId: string;
  accountId?: string;
  category?: MailCategory;
  from?: string;
  counterparty?: string;
  title: string;
  summary?: string;
  nextAction?: string;
  dueAt?: string;
  status?: TaskStatus;
  sourceProvider?: TaskItem['sourceProvider'];
  sourceMessageId?: string;
  taskId?: string;
}): Promise<Task> {
  const now = new Date().toISOString();
  const id = params.taskId ?? randomUUID();
  const status = params.status ?? 'open';
  const sk = `${TASK_PREFIX}${id}`;
  const gsi1pk = buildStatusGsi(params.tenantId, status);

  const item: Omit<TaskItem, 'PK' | 'SK'> = {
    id,
    userId: params.userId,
    accountId: params.accountId,
    category: params.category,
    from: params.from,
    counterparty: params.counterparty,
    title: params.title,
    summary: params.summary,
    nextAction: params.nextAction,
    dueAt: params.dueAt,
    status,
    sourceProvider: params.sourceProvider,
    sourceMessageId: params.sourceMessageId,
    createdAt: now,
    updatedAt: now,
    GSI1PK: gsi1pk,
    GSI1SK: `${now}#${id}`,
    GSI2PK: `USER#${params.userId}#TASK`,
    GSI2SK: `${now}#${id}`,
  };

  await putItem(params.tenantId, sk, item as any);
  const created = await getItem<TaskItem>(params.tenantId, sk);
  if (!created) {
    throw new Error('Task not found after create');
  }
  return mapTask(created);
}

export async function updateTask(params: {
  tenantId: string;
  taskId: string;
  title?: string;
  summary?: string;
  nextAction?: string;
  dueAt?: string | null;
  status?: TaskStatus;
  category?: MailCategory;
  from?: string | null;
  counterparty?: string | null;
}): Promise<Task> {
  const now = new Date().toISOString();
  const sets: string[] = ['updatedAt = :updatedAt', 'GSI1SK = :gsi1sk', 'GSI2SK = :gsi2sk'];
  const values: Record<string, unknown> = { ':updatedAt': now };
  const names: Record<string, string> = {};
  values[':gsi1sk'] = `${now}#${params.taskId}`;
  values[':gsi2sk'] = `${now}#${params.taskId}`;

  if (params.title !== undefined) {
    sets.push('title = :title');
    values[':title'] = params.title;
  }
  if (params.summary !== undefined) {
    sets.push('summary = :summary');
    values[':summary'] = params.summary;
  }
  if (params.nextAction !== undefined) {
    sets.push('nextAction = :nextAction');
    values[':nextAction'] = params.nextAction;
  }
  if (params.dueAt !== undefined) {
    sets.push('dueAt = :dueAt');
    values[':dueAt'] = params.dueAt ?? null;
  }
  if (params.category !== undefined) {
    sets.push('category = :category');
    values[':category'] = params.category;
  }
  if (params.from !== undefined) {
    sets.push('from = :from');
    values[':from'] = params.from ?? null;
  }
  if (params.counterparty !== undefined) {
    sets.push('counterparty = :counterparty');
    values[':counterparty'] = params.counterparty ?? null;
  }
  if (params.status !== undefined) {
    // DynamoDB予約語回避
    sets.push('#status = :status');
    sets.push('GSI1PK = :gsi1pk');
    values[':status'] = params.status;
    values[':gsi1pk'] = buildStatusGsi(params.tenantId, params.status);
    names['#status'] = 'status';
  }

  await updateItem(
    params.tenantId,
    `${TASK_PREFIX}${params.taskId}`,
    `SET ${sets.join(', ')}`,
    values,
    Object.keys(names).length ? names : undefined
  );

  const item = await getItem<TaskItem>(params.tenantId, `${TASK_PREFIX}${params.taskId}`);
  if (!item) {
    throw new Error('Task not found after update');
  }
  return mapTask(item);
}
