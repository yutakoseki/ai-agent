import { logger } from '@/lib/logger';
import type { MailCategory } from '@shared/mail';
import type { TaskDraft } from '@/lib/mail/summarizer';
import { inferDueAtISO } from '@/lib/mail/dueDate';

export type MailAIAnalysis = {
  category: MailCategory;
  needsAction: boolean;
  draft: TaskDraft;
  signature?: {
    company?: string | null;
    person?: string | null;
  };
};

function truncate(text: string | undefined, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function parseJsonLoose(input: string): any {
  // 念のため ```json ... ``` を剥がす
  const cleaned = input
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

function normalizeCategory(raw: any): MailCategory {
  const v = String(raw ?? '').toLowerCase();
  if (v === 'action_required') return 'action_required';
  if (v === 'information') return 'information';
  if (v === 'sales') return 'sales';
  if (v === 'notification') return 'notification';
  if (v === 'billing_payment' || v === 'billing' || v === 'payment' || v === 'invoice')
    return 'billing_payment';
  if (v === 'security' || v === 'account_security' || v === 'auth_security') return 'security';
  return 'information';
}

export function isMailAIEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function analyzeMailWithAI(params: {
  subject?: string;
  from?: string;
  to?: string;
  snippet?: string;
  bodyText?: string;
}): Promise<MailAIAnalysis | null> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-5.2';

  const input = {
    subject: truncate(params.subject, 300),
    from: truncate(params.from, 300),
    to: truncate(params.to, 300),
    snippet: truncate(params.snippet, 800),
    bodyText: truncate(params.bodyText, 8000),
  };

  const system = [
    'あなたはメールの内容を読み、分類・要約・次アクション抽出を行うアシスタントです。',
    '必ずJSONだけを返してください。余計な文章は禁止です。',
    '本文は機密の可能性があるので、要約は短く、必要最小限にします。',
  ].join('\n');

  const user = [
    '次のメールを解析して、JSONで返してください。',
    '',
    '出力JSONスキーマ:',
    '{',
    '  "category": "action_required" | "information" | "sales" | "notification" | "billing_payment" | "security",',
    '  "needsAction": boolean,',
    '  "title": string,',
    '  "summary": string,',
    '  "nextAction": string,',
    '  "dueAt": string | null,',
    '  "signature": { "company": string | null, "person": string | null }',
    '}',
    '',
    '重要: ユーザーが何か行動する必要がある場合は needsAction=true とし、category は必ず action_required にしてください（請求/支払い等でも、支払う等のタスクがあれば要対応）。',
    'title は、「何の件か」が一目でわかるように、案件名/機能名/依頼内容を短く含めてください。会社名は原則含めないでください。',
    'signature は、本文末尾の署名から推定できる場合のみ設定してください（無ければ null でOK）。会社名/氏名を短く抽出します。',
    'dueAt は、締切/期限が明示されている場合のみ ISO 8601 形式 (例: 2026-01-31T00:00:00.000Z) で設定し、無ければ null にしてください。',
    '入力:',
    JSON.stringify(input),
  ].join('\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.warn('openai request failed', { status: res.status, data });
      return null;
    }
    const content = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!content) return null;
    const parsed = parseJsonLoose(content);

    const category = normalizeCategory(parsed?.category);
    // action_required は必ずタスク化対象（趣旨に合わせて強制）
    const needsAction = category === 'action_required' ? true : Boolean(parsed?.needsAction);
    const title = String(parsed?.title ?? '').trim() || '要対応メール';
    const summary = String(parsed?.summary ?? '').trim();
    const nextAction =
      String(parsed?.nextAction ?? '').trim() || '内容を確認し、必要な返信・処理を行う';
    const signature =
      parsed?.signature && typeof parsed.signature === 'object'
        ? {
            company:
              parsed.signature.company === null || parsed.signature.company === undefined
                ? null
                : String(parsed.signature.company).trim() || null,
            person:
              parsed.signature.person === null || parsed.signature.person === undefined
                ? null
                : String(parsed.signature.person).trim() || null,
          }
        : undefined;
    const rawDueAt = parsed?.dueAt;
    const dueAt =
      rawDueAt === null || rawDueAt === undefined || rawDueAt === ''
        ? undefined
        : (() => {
            const v = String(rawDueAt).trim();
            // date-only を許容
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
              const iso = new Date(`${v}T00:00:00.000Z`);
              return Number.isNaN(iso.getTime()) ? undefined : iso.toISOString();
            }
            const d = new Date(v);
            if (!Number.isNaN(d.getTime())) return d.toISOString();
            return inferDueAtISO({ text: v });
          })();

    return {
      category,
      needsAction,
      draft: { title, summary, nextAction, dueAt },
      signature,
    };
  } catch (error) {
    logger.warn('openai analyze failed', { error });
    return null;
  }
}
