import type { TenantApplication } from "@shared/tenantApplication";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/notifications/email";

export async function sendTenantApplicationRejectedEmail(options: {
  application: TenantApplication;
  decisionNote: string;
  origin: string;
}): Promise<void> {
  const { application, decisionNote } = options;
  try {
    await sendEmail({
      to: [application.contactEmail],
      subject: "【AI Agent】テナント申請の結果（却下）",
      text: [
        "AI Agent Platform です。",
        "",
        "テナント申請を確認しましたが、今回は見送り（却下）となりました。",
        "",
        `申請ID: ${application.id}`,
        `テナント名: ${application.tenantName}`,
        "",
        "理由:",
        decisionNote,
        "",
        "内容を更新して再申請いただくことも可能です。",
        "",
        "本メールは自動送信です。",
      ].join("\n"),
    });
  } catch (error) {
    logger.warn("tenantApplication reject email failed", {
      applicationId: application.id,
      to: application.contactEmail,
      error,
    });
  }
}

export async function sendTenantApplicationApprovedEmail(options: {
  application: TenantApplication;
  tenantId: string;
  loginEmail: string;
  password: string;
  decisionNote?: string;
  origin: string;
}): Promise<void> {
  const { application, tenantId, loginEmail, password, decisionNote, origin } = options;
  const loginUrl = `${origin}/login`;
  try {
    await sendEmail({
      to: [application.contactEmail],
      subject: "【AI Agent】テナント申請の結果（承認）/ ログイン情報",
      text: [
        "AI Agent Platform です。",
        "",
        "テナント申請が承認されました。以下の情報でログインできます。",
        "",
        `テナントID: ${tenantId}`,
        `ログインID（メール）: ${loginEmail}`,
        `初期パスワード: ${password}`,
        "",
        `ログインURL: ${loginUrl}`,
        "",
        decisionNote ? "管理者コメント:" : undefined,
        decisionNote || undefined,
        "",
        "セキュリティのため、ログイン後にパスワードの変更を推奨します。",
        "",
        "本メールは自動送信です。",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch (error) {
    logger.warn("tenantApplication approve email failed", {
      applicationId: application.id,
      to: application.contactEmail,
      error,
    });
  }
}


