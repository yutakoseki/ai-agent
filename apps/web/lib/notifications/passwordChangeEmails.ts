import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/notifications/email";

function buildLoginUrl(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  return `${origin}/login`;
}

export async function sendPasswordChangedEmail(options: {
  to: string;
  origin?: string;
}): Promise<void> {
  try {
    const loginUrl = buildLoginUrl(options.origin);
    await sendEmail({
      to: [options.to],
      subject: "【AI Agent】パスワードが変更されました",
      text: [
        "AI Agent Platform です。",
        "",
        "あなたのアカウントのパスワードが変更されました。",
        "",
        "もしこの変更に心当たりがない場合は、速やかに管理者へ連絡してください。",
        "",
        loginUrl ? `ログインURL: ${loginUrl}` : undefined,
        "",
        "本メールは自動送信です。",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch (error) {
    logger.warn("password changed email failed", {
      to: options.to,
      error,
    });
  }
}

export async function sendPasswordResetByAdminEmail(options: {
  to: string;
  origin?: string;
}): Promise<void> {
  try {
    const loginUrl = buildLoginUrl(options.origin);
    await sendEmail({
      to: [options.to],
      subject: "【AI Agent】管理者によりパスワードが再設定されました",
      text: [
        "AI Agent Platform です。",
        "",
        "管理者により、あなたのアカウントのパスワードが再設定されました。",
        "",
        "セキュリティのため、ログイン後にパスワードの変更を推奨します。",
        "",
        loginUrl ? `ログインURL: ${loginUrl}` : undefined,
        "",
        "本メールは自動送信です。",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch (error) {
    logger.warn("password reset email failed", {
      to: options.to,
      error,
    });
  }
}



