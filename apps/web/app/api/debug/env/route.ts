import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

function pickBool(key: string) {
  const v = process.env[key];
  return { present: !!v, length: typeof v === "string" ? v.length : 0 };
}

export async function GET(_req: NextRequest) {
  const traceId = randomUUID();
  const secrets = (process.env as unknown as { secrets?: unknown }).secrets;

  return NextResponse.json(
    {
      traceId,
      nodeEnv: process.env.NODE_ENV,
      // 値は返さない（漏洩防止）。存在/長さだけ返す。
      env: {
        COGNITO_REGION: pickBool("COGNITO_REGION"),
        COGNITO_USER_POOL_ID: pickBool("COGNITO_USER_POOL_ID"),
        COGNITO_CLIENT_ID: pickBool("COGNITO_CLIENT_ID"),
        COGNITO_CLIENT_SECRET: pickBool("COGNITO_CLIENT_SECRET"),
        COGNITO_AUTH_FLOW: pickBool("COGNITO_AUTH_FLOW"),
        AMPLIFY_AWS_REGION: pickBool("AMPLIFY_AWS_REGION"),
        AWS_REGION: pickBool("AWS_REGION"),
      },
      secretsInjected: {
        present: !!secrets,
        type: typeof secrets,
      },
    },
    { status: 200 }
  );
}


