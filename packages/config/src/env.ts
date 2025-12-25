import { z } from "zod";

export const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  DATABASE_URL: z.string(),
  QUEUE_URL: z.string(),
  AGENTCORE_API_URL: z.string().url(),
  AGENTCORE_QUEUE_NAME: z.string(),
  AMPLIFY_REGION: z.string(),
  AMPLIFY_BRANCH: z.string(),

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
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  // fail-fastで不足/型不一致を検出
  return envSchema.parse(source);
}
