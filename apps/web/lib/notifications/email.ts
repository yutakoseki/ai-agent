import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logger } from "@/lib/logger";

export type EmailProvider = "ses" | "console" | "disabled";

export type EmailMessage = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
};

function getRegion(): string {
  return (
    process.env.AMPLIFY_AWS_REGION ||
    process.env.AWS_REGION ||
    process.env.AMPLIFY_AWS_DEFAULT_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "ap-northeast-1"
  );
}

function getExplicitCredentials():
  | { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
  | undefined {
  const accessKeyId =
    process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken =
    process.env.AMPLIFY_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) return undefined;
  return { accessKeyId, secretAccessKey, sessionToken };
}

function getProvider(): EmailProvider {
  const raw = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (raw === "ses" || raw === "console" || raw === "disabled") return raw;
  // 既定は開発/検証で安全な console
  return process.env.NODE_ENV === "production" ? "ses" : "console";
}

function normalizeTo(to: string[]): string[] {
  return [...new Set(to.map((v) => v.trim()).filter(Boolean))];
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  // テストは副作用を避ける（統合テストも含む）
  if (process.env.NODE_ENV === "test") return;

  const provider = getProvider();
  const to = normalizeTo(message.to);
  if (to.length === 0) return;

  if (provider === "disabled") return;

  if (provider === "console") {
    logger.info("email (console)", {
      to,
      subject: message.subject,
      preview: message.text.slice(0, 500),
    });
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is required for EMAIL_PROVIDER=ses");
  }

  const client = new SESClient({
    region: getRegion(),
    // Amplifyでは AWS_* を環境変数に置けない運用があるため、AMPLIFY_* を優先して明示的に渡す
    credentials: getExplicitCredentials(),
  });
  const cmd = new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: to },
    Message: {
      Subject: { Data: message.subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: message.text, Charset: "UTF-8" },
        ...(message.html
          ? { Html: { Data: message.html, Charset: "UTF-8" } }
          : {}),
      },
    },
  });

  await client.send(cmd);
}


