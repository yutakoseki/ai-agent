import type { MailCategory } from "@shared/mail";

const ACTION_KEYWORDS = [
  "要対応",
  "至急",
  "確認",
  "返信",
  "お願い",
  "依頼",
  "ご対応",
  "対応お願いします",
  "期限",
];

const SALES_KEYWORDS = [
  "見積",
  "提案",
  "商談",
  "営業",
  "キャンペーン",
  "資料請求",
];

const BILLING_KEYWORDS = [
  "請求",
  "請求書",
  "支払い",
  "お支払い",
  "支払",
  "領収書",
  "インボイス",
  "invoice",
  "決済",
  "カード",
  "口座振替",
  "料金",
  "明細",
];

const SECURITY_KEYWORDS = [
  "セキュリティ",
  "security",
  "不正",
  "不審",
  "警告",
  "アラート",
  "alert",
  "ログイン",
  "サインイン",
  "signin",
  "認証",
  "mfa",
  "2段階",
  "二段階",
  "ワンタイム",
  "otp",
  "パスワード",
  "リセット",
  "本人確認",
  "アクセス",
  "検知",
];

const INFO_KEYWORDS = [
  "お知らせ",
  "通知",
  "アップデート",
  "重要",
];

const NOREPLY_PATTERNS = [
  "noreply",
  "no-reply",
  "do-not-reply",
  "mailer-daemon",
];

function normalize(input: string | undefined): string {
  return (input ?? "").toLowerCase();
}

function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

export function classifyMail(params: {
  subject?: string;
  from?: string;
  snippet?: string;
}): { category: MailCategory; needsAction: boolean } {
  const subject = normalize(params.subject);
  const from = normalize(params.from);
  const snippet = normalize(params.snippet);

  if (NOREPLY_PATTERNS.some((p) => from.includes(p))) {
    return { category: "notification", needsAction: false };
  }

  if (containsKeyword(subject, ACTION_KEYWORDS) || containsKeyword(snippet, ACTION_KEYWORDS)) {
    return { category: "action_required", needsAction: true };
  }

  if (containsKeyword(subject, SECURITY_KEYWORDS) || containsKeyword(snippet, SECURITY_KEYWORDS)) {
    // セキュリティ系は基本的に要対応扱い
    return { category: "security", needsAction: true };
  }

  if (containsKeyword(subject, BILLING_KEYWORDS) || containsKeyword(snippet, BILLING_KEYWORDS)) {
    // 請求/支払いは期限が絡むことが多いので、優先度は上げつつ needsAction は保守的に false
    // （AIが有効ならそちらに委譲）
    const maybeAction = subject.includes("期限") || snippet.includes("期限") || subject.includes("支払");
    return { category: "billing_payment", needsAction: maybeAction };
  }

  if (containsKeyword(subject, SALES_KEYWORDS) || containsKeyword(snippet, SALES_KEYWORDS)) {
    return { category: "sales", needsAction: false };
  }

  if (containsKeyword(subject, INFO_KEYWORDS) || containsKeyword(snippet, INFO_KEYWORDS)) {
    return { category: "information", needsAction: false };
  }

  return { category: "information", needsAction: false };
}

