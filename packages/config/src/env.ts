import { z } from "zod";

export const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  DATABASE_URL: z.string(),
  QUEUE_URL: z.string(),
  AGENTCORE_API_URL: z.string().url(),
  AGENTCORE_QUEUE_NAME: z.string(),
  AMPLIFY_REGION: z.string(),
  AMPLIFY_BRANCH: z.string()
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  // fail-fastで不足/型不一致を検出
  return envSchema.parse(source);
}

