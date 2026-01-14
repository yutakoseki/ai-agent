import { z } from "zod";

export const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  API_BASE_URL: z.string().url(),
  DATABASE_URL: z.string(),
  QUEUE_URL: z.string(),
  AGENTCORE_API_URL: z.string().url(),
  AGENTCORE_QUEUE_NAME: z.string(),
  AMPLIFY_REGION: z.string(),
  AMPLIFY_BRANCH: z.string(),

  // Cognito
  COGNITO_REGION: z.string(),
  COGNITO_USER_POOL_ID: z.string(),
  COGNITO_CLIENT_ID: z.string(),
  COGNITO_CLIENT_SECRET: z.string().optional(),
  COGNITO_AUTH_FLOW: z
    .enum(["USER_PASSWORD_AUTH", "ADMIN_USER_PASSWORD_AUTH"])
    .default("USER_PASSWORD_AUTH"),

  // DynamoDB
  DYNAMODB_TABLE_NAME: z.string(),
  DYNAMODB_ENDPOINT: z.string().url().optional(),
  DYNAMODB_GSI1_NAME: z.string().default("GSI1"),
  DYNAMODB_GSI2_NAME: z.string().default("GSI2"),

  // 認証関連
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  SESSION_COOKIE_NAME: z.string().default("session"),
  SESSION_COOKIE_SECURE: z
    .string()
    .transform((v) => v === "true")
    .default("true"),

  // パスワードリセット
  PASSWORD_RESET_EXPIRES_IN: z.string().default("1h"),
  PASSWORD_RESET_SECRET: z.string().min(32),

  // OAuth (Gmail/Outlook)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GMAIL_PUBSUB_TOPIC: z.string().optional(),
  GMAIL_WEBHOOK_TOKEN: z.string().optional(),
  GMAIL_LABEL_IDS_JSON: z.string().optional(),
  GMAIL_WATCH_LABEL_IDS: z.string().optional(),
  OAUTH_TOKEN_ENC_KEY: z.string().optional(),
  OAUTH_STATE_SECRET: z.string().optional(),

  // X API
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_TOKEN_SECRET: z.string().optional(),

  // Web Push
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // ログ関連
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_PRETTY: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default("false"),
  LOG_SAMPLING_DEBUG: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return 1;
      const parsed = Number.parseFloat(v);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
        throw new Error("LOG_SAMPLING_DEBUG must be between 0 and 1");
      }
      return parsed;
    }),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  // fail-fastで不足/型不一致を検出
  return envSchema.parse(source);
}
