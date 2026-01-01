import type { TenantApplication } from "@shared/tenantApplication";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/notifications/email";

function getAdminRecipients(): string[] {
  const raw =
    process.env.TENANT_APPLICATION_ADMIN_EMAILS ||
    process.env.ADMIN_NOTIFICATION_EMAILS ||
    "";
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function sendTenantApplicationEmails(options: {
  application: TenantApplication;
  origin: string;
}): Promise<void> {
  const { application, origin } = options;
  const adminTo = getAdminRecipients();
  const applicantTo = [application.contactEmail];
  const adminUrl = `${origin}/admin/tenant-applications/${application.id}`;

  // 申請者向け
  try {
    await sendEmail({
      to: applicantTo,
      subject: "【AI Agent】テナント申請を受け付けました",
      text: [
        "AI Agent Platform です。",
        "",
        "テナント申請を受け付けました。管理者が内容を確認し、承認後に利用を開始できます。",
        "",
        `申請ID: ${application.id}`,
        `テナント名: ${application.tenantName}`,
        `プラン: ${application.plan}`,
        "",
        "本メールは自動送信です。",
      ].join("\n"),
    });
  } catch (error) {
    logger.warn("tenantApplication receipt email failed", {
      applicationId: application.id,
      to: applicantTo,
      error,
    });
  }

  // 管理者向け
  if (adminTo.length > 0) {
    try {
      await sendEmail({
        to: adminTo,
        subject: `【AI Agent】新規テナント申請: ${application.tenantName}`,
        text: [
          "AI Agent Platform です。",
          "",
          "新規テナント申請が届きました。",
          "",
          `申請ID: ${application.id}`,
          `テナント名: ${application.tenantName}`,
          `プラン: ${application.plan}`,
          `連絡先: ${application.contactEmail}`,
          application.contactName ? `担当者: ${application.contactName}` : undefined,
          application.note ? `備考: ${application.note}` : undefined,
          "",
          `承認/却下: ${adminUrl}`,
          "",
          "本メールは自動送信です。",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } catch (error) {
      logger.warn("tenantApplication admin notify email failed", {
        applicationId: application.id,
        to: adminTo,
        error,
      });
    }
  }
}


