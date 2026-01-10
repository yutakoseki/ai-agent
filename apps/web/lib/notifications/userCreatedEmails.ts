import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/notifications/email";

function buildLoginUrl(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  return `${origin}/login`;
}

export async function sendUserCreatedEmail(options: {
  to: string;
  origin?: string;
  tenantId?: string;
  loginEmail: string;
  password: string;
  createdByRole?: string;
}): Promise<void> {
  const { to, origin, tenantId, loginEmail, password, createdByRole } = options;
  try {
    const loginUrl = buildLoginUrl(origin);
    await sendEmail({
      to: [to],
      subject: "【AI Agent】アカウント作成 / ログイン情報",
      text: [
        "AI Agent Platform です。",
        "",
        "あなたのアカウントが作成されました。以下の情報でログインできます。",
        "",
        tenantId ? `テナントID: ${tenantId}` : undefined,
        `ログインID（メール）: ${loginEmail}`,
        `初期パスワード: ${password}`,
        "",
        loginUrl ? `ログインURL: ${loginUrl}` : undefined,
        "",
        createdByRole ? `作成者権限: ${createdByRole}` : undefined,
        "",
        "セキュリティのため、ログイン後にパスワードの変更を推奨します。",
        "",
        "本メールは自動送信です。",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch (error) {
    logger.warn("user created email failed", {
      to,
      tenantId,
      error,
    });
  }
}


