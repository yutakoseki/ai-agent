import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION || 'ap-northeast-1';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const ACCESS_KEY_ID = process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY =
  process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const SESSION_TOKEN = process.env.AMPLIFY_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'aiagent-dev';

const MULTI_TABLE_SUFFIXES = [
  'tenants',
  'users',
  'tenant_applications',
  'permission_policies',
  'user_preferences',
  'email_accounts',
  'email_messages',
  'tasks',
  'user_email_subscriptions',
  'push_subscriptions',
  'announcements',
  'notices',
  'rss_sources',
  'rss_items',
  'rss_drafts',
  'rss_usage',
  'x_post_batches',
  'x_accounts',
];

function getTableNames() {
  // このリポでは常にマルチテーブルを利用する（single テーブルは移行後に削除想定）
  return MULTI_TABLE_SUFFIXES.map((s) => `${TABLE_NAME}-${s}`);
}

const CREDENTIALS =
  ACCESS_KEY_ID && SECRET_ACCESS_KEY
    ? {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
        sessionToken: SESSION_TOKEN,
      }
    : undefined;

function isLocalDynamoEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    // Fallback for unexpected strings
    return (
      typeof endpoint === 'string' &&
      (endpoint.includes('localhost') || endpoint.includes('127.0.0.1'))
    );
  }
}

const IS_LOCAL = isLocalDynamoEndpoint(ENDPOINT);

const clientOptions = {
  region: REGION,
  endpoint: ENDPOINT,
};

// - Local DynamoDB: allow dummy credentials when no real creds are provided
// - AWS DynamoDB: do NOT force dummy creds; let the default credential chain work (profile/role/etc.)
if (CREDENTIALS) {
  clientOptions.credentials = CREDENTIALS;
} else if (IS_LOCAL) {
  clientOptions.credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
}

const client = new DynamoDBClient(clientOptions);
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(e) {
  // DynamoDB Local startup race / transient socket issues on CI
  const code = e?.code;
  const name = e?.name;
  return (
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    name === 'TimeoutError' ||
    name === 'NetworkingError'
  );
}

async function withRetry(fn, { retries = 10, baseDelayMs = 200 } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt += 1;
      if (!isRetryable(e) || attempt > retries) throw e;
      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), 3000);
      const jitter = Math.floor(Math.random() * 100);
      await sleep(backoff + jitter);
    }
  }
}

async function waitForDynamoDBLocal() {
  await withRetry(async () => client.send(new ListTablesCommand({ Limit: 1 })), {
    retries: 20,
    baseDelayMs: 150,
  });
}

async function ensureTable(tableName) {
  try {
    await withRetry(() =>
      client.send(
        new CreateTableCommand({
          TableName: tableName,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'PK', AttributeType: 'S' },
            { AttributeName: 'SK', AttributeType: 'S' },
            { AttributeName: 'GSI1PK', AttributeType: 'S' },
            { AttributeName: 'GSI1SK', AttributeType: 'S' },
            { AttributeName: 'GSI2PK', AttributeType: 'S' },
            { AttributeName: 'GSI2SK', AttributeType: 'S' },
          ],
          KeySchema: [
            { AttributeName: 'PK', KeyType: 'HASH' },
            { AttributeName: 'SK', KeyType: 'RANGE' },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'GSI1',
              KeySchema: [
                { AttributeName: 'GSI1PK', KeyType: 'HASH' },
                { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
            {
              IndexName: 'GSI2',
              KeySchema: [
                { AttributeName: 'GSI2PK', KeyType: 'HASH' },
                { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
          SSESpecification: { Enabled: false }, // local
        })
      )
    );
    console.log(`Created table ${tableName}`);
  } catch (e) {
    if (e.name === 'ResourceInUseException') {
      console.log(`Table ${tableName} already exists`);
      return;
    }
    throw e;
  }
}

async function seed() {
  // Only DynamoDB Local needs startup wait and table auto-create.
  if (IS_LOCAL) {
    // Avoid CI flakiness by waiting until DynamoDB Local is ready to accept connections.
    await waitForDynamoDBLocal();
    for (const name of getTableNames()) {
      await ensureTable(name);
    }
  }

  const now = new Date().toISOString();

  const tenantId = process.env.SEED_TENANT_ID || 'tenant-1';
  const adminSub = process.env.SEED_ADMIN_SUB || process.env.COGNITO_USER_SUB || 'user-1';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminName = process.env.SEED_ADMIN_NAME || '管理者';

  const tenantsTableName = `${TABLE_NAME}-tenants`;
  const usersTableName = `${TABLE_NAME}-users`;

  await withRetry(() =>
    doc.send(
      new PutCommand({
        TableName: tenantsTableName,
        Item: {
          PK: `TENANT#${tenantId}`,
          SK: `TENANT#${tenantId}`,
          name: 'サンプルテナント',
          plan: 'Pro',
          enabled: true,
          createdAt: now,
          updatedAt: now,
          GSI1PK: 'TENANT',
          GSI1SK: now,
        },
      })
    )
  );

  await withRetry(() =>
    doc.send(
      new PutCommand({
        TableName: usersTableName,
        Item: {
          PK: `TENANT#${tenantId}`,
          SK: `USER#${adminSub}`,
          email: adminEmail,
          role: 'Admin',
          name: adminName,
          createdAt: now,
          updatedAt: now,
          GSI1PK: 'USER',
          GSI1SK: now,
          GSI2PK: `USER#${adminSub}`,
          GSI2SK: `TENANT#${tenantId}`,
        },
      })
    )
  );

  console.log('Seed data inserted.');
  console.log(`Admin sub: ${adminSub}`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
