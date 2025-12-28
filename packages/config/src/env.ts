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
