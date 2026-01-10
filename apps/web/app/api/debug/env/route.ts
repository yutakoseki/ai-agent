import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function pickBool(key: string) {
  const v = process.env[key];
  return { present: !!v, length: typeof v === "string" ? v.length : 0 };
}

function pickDirect(key: "COGNITO_REGION" | "COGNITO_USER_POOL_ID" | "COGNITO_CLIENT_ID") {
  // NOTE: 直接参照は Next のビルド時 env 埋め込み(DefinePlugin)の影響を受ける。
  // ランタイムの実 env と区別するため、別項目で返す。
  const v =
    key === "COGNITO_REGION"
      ? process.env.COGNITO_REGION
      : key === "COGNITO_USER_POOL_ID"
        ? process.env.COGNITO_USER_POOL_ID
        : process.env.COGNITO_CLIENT_ID;
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
        // Gmail / PubSub
        GOOGLE_CLIENT_ID: pickBool("GOOGLE_CLIENT_ID"),
        GOOGLE_CLIENT_SECRET: pickBool("GOOGLE_CLIENT_SECRET"),
        GOOGLE_REDIRECT_URI: pickBool("GOOGLE_REDIRECT_URI"),
        GMAIL_PUBSUB_TOPIC: pickBool("GMAIL_PUBSUB_TOPIC"),
        GMAIL_WEBHOOK_TOKEN: pickBool("GMAIL_WEBHOOK_TOKEN"),
        OAUTH_TOKEN_ENC_KEY: pickBool("OAUTH_TOKEN_ENC_KEY"),
        OAUTH_STATE_SECRET: pickBool("OAUTH_STATE_SECRET"),
        // Push
        VAPID_PUBLIC_KEY: pickBool("VAPID_PUBLIC_KEY"),
        VAPID_PRIVATE_KEY: pickBool("VAPID_PRIVATE_KEY"),
        VAPID_SUBJECT: pickBool("VAPID_SUBJECT"),
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: pickBool("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
        // AI
        OPENAI_API_KEY: pickBool("OPENAI_API_KEY"),
        OPENAI_MODEL: pickBool("OPENAI_MODEL"),
      },
      // 直接参照（ビルド時埋め込みが効いているか）の確認用
      envDirect: {
        COGNITO_REGION: pickDirect("COGNITO_REGION"),
        COGNITO_USER_POOL_ID: pickDirect("COGNITO_USER_POOL_ID"),
        COGNITO_CLIENT_ID: pickDirect("COGNITO_CLIENT_ID"),
      },
      secretsInjected: {
        present: !!secrets,
        type: typeof secrets,
      },
    },
    { status: 200 }
  );
}


