import { logger } from '@/lib/logger';
import type { MailCategory } from '@shared/mail';
import type { TaskDraft } from '@/lib/mail/summarizer';
import { inferDueAtISO } from '@/lib/mail/dueDate';

export type MailAIAnalysis = {
  category: MailCategory;
  needsAction: boolean;
  draft: TaskDraft;
  /**
   * 時系列（タイムライン）に表示する「ひとこと要約」。
   * 例: "サービス管理画面のデータ反映遅延の対応依頼"
   */
  timelineSummary?: string;
  /**
   * 画面の本文抜粋(snippet)として表示する「要点まとめ」。
   * 複数行（改行区切り）を許容。
   */
  snippetSummary?: string;
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

function sanitizeTimelineSummary(input: any): string | undefined {
  const s = String(input ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return undefined;
  // メールアドレス/電話番号が混ざるとノイズなので落とす（best-effort）
  const withoutEmails = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '').trim();
  const withoutPhones = withoutEmails.replace(/\b0\d{1,4}-\d{1,4}-\d{3,4}\b/g, '').trim();
  const cleaned = withoutPhones.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.length <= 60 ? cleaned : `${cleaned.slice(0, 59)}…`;
}

function sanitizeSnippetSummary(input: any): string | undefined {
  const raw = String(input ?? '').trim();
  if (!raw) return undefined;
  // ``` を避け、長すぎる本文貼り付けを防ぐ
  const cleaned = raw
    .replace(/^```[\s\S]*?$/gm, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b0\d{1,4}-\d{1,4}-\d{3,4}\b/g, '[tel]')
    .trim();
  if (!cleaned) return undefined;
  // 1行が長すぎる場合は折り返しよりも切る（UIで崩れにくく）
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((l) => (l.length <= 100 ? l : `${l.slice(0, 99)}…`));
  const joined = lines.join('\n').trim();
  if (!joined) return undefined;
  return joined.length <= 600 ? joined : `${joined.slice(0, 599)}…`;
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
  traceId?: string;
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
    '  "timelineSummary": string,',
    '  "snippetSummary": string,',
    '  "title": string,',
    '  "summary": string,',
    '  "nextAction": string,',
    '  "dueAt": string | null,',
    '  "signature": { "company": string | null, "person": string | null }',
    '}',
    '',
    '重要: ユーザーが何か行動する必要がある場合は needsAction=true とし、category は必ず action_required にしてください（請求/支払い等でも、支払う等のタスクがあれば要対応）。',
    'timelineSummary は、時系列(タイムライン)に出す「ひとこと要約」です。60文字以内。挨拶・署名・定型句は含めず、要点だけ（例: "管理画面のデータ反映遅延の対応依頼"）。',
    'snippetSummary は、画面の本文抜粋として出す「要点まとめ」です。最大8行、各行100文字以内。可能なら以下のような項目を短く含めてください:',
    '- 1行目: 件名っぽい要点（名詞中心）',
    '- 対象: ...',
    '- 発生内容: ...',
    '- 発生開始: ...（日付/時刻があれば）',
    '- 期待: ...（期待状態があれば）',
    'メール本文のコピペはしないでください。挨拶や署名、メールアドレス/電話番号は入れないでください。',
    'title は、「何の件か」が一目でわかるように、案件名/機能名/依頼内容を短く含めてください。会社名は原則含めないでください。',
    'signature は、本文末尾の署名から推定できる場合のみ設定してください（無ければ null でOK）。会社名/氏名を短く抽出します。',
    'dueAt は、締切/期限が明示されている場合のみ ISO 8601 形式 (例: 2026-01-31T00:00:00.000Z) で設定し、無ければ null にしてください。',
    '入力:',
    JSON.stringify(input),
  ].join('\n');

  async function callOpenAI(
    userPrompt: string
  ): Promise<
    | { ok: true; parsed: any }
    | { ok: false; status?: number; code?: string; type?: string; message?: string }
  > {
    const startedAt = Date.now();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error ?? {};
      logger.warn('openai request failed', {
        traceId: params.traceId,
        status: res.status,
        durationMs: Date.now() - startedAt,
        model,
        code: err?.code ?? null,
        type: err?.type ?? null,
        message: err?.message ?? null,
      });
      return {
        ok: false,
        status: res.status,
        code: err?.code ? String(err.code) : undefined,
        type: err?.type ? String(err.type) : undefined,
        message: err?.message ? String(err.message) : undefined,
      };
    }
    const content = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!content) {
      logger.warn('openai empty content', {
        traceId: params.traceId,
        durationMs: Date.now() - startedAt,
        model,
      });
      return { ok: false };
    }
    try {
      const parsed = parseJsonLoose(content);
      logger.debug('openai response parsed', {
        traceId: params.traceId,
        durationMs: Date.now() - startedAt,
        model,
      });
      return { ok: true, parsed };
    } catch (error) {
      logger.warn('openai json parse failed', { error, content: content.slice(0, 500) });
      return { ok: false };
    }
  }

  try {
    logger.info('openai analyze: start', {
      traceId: params.traceId,
      model,
      hasBodyText: Boolean(params.bodyText),
      subjectLen: (params.subject ?? '').length,
      snippetLen: (params.snippet ?? '').length,
    });

    const first = await callOpenAI(user);
    if (!first.ok) return null;
    let parsed = first.parsed;

    // 新規フィールドが欠落することがあるので、1回だけ修復リトライする
    const missingTimeline = parsed.timelineSummary === undefined || parsed.timelineSummary === null;
    const missingSnippet = parsed.snippetSummary === undefined || parsed.snippetSummary === null;
    let didRepair = false;
    if (missingTimeline || missingSnippet) {
      const repair = [
        'あなたの直前の出力JSONに不足がありました。次の条件でJSONを返し直してください。',
        '- 必ず次のキーをすべて含める: category, needsAction, timelineSummary, snippetSummary, title, summary, nextAction, dueAt, signature',
        '- timelineSummary/snippetSummary が空でも良いので、必ず文字列として出す（空文字は不可。最低1文字）',
        '- 余計な文章は禁止。JSONのみ。',
        '',
        '入力:',
        JSON.stringify(input),
      ].join('\n');
      const repaired = await callOpenAI(repair);
      if (repaired.ok) {
        parsed = repaired.parsed;
        didRepair = true;
      }
    }

    const category = normalizeCategory(parsed?.category);
    // action_required は必ずタスク化対象（趣旨に合わせて強制）
    const needsAction = category === 'action_required' ? true : Boolean(parsed?.needsAction);
    const title = String(parsed?.title ?? '').trim() || '要対応メール';
    const summary = String(parsed?.summary ?? '').trim();
    const nextAction =
      String(parsed?.nextAction ?? '').trim() || '内容を確認し、必要な返信・処理を行う';
    const timelineSummary = sanitizeTimelineSummary(parsed?.timelineSummary);
    const snippetSummary = sanitizeSnippetSummary(parsed?.snippetSummary);
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

    const result: MailAIAnalysis = {
      category,
      needsAction,
      draft: { title, summary, nextAction, dueAt },
      timelineSummary,
      snippetSummary,
      signature,
    };

    logger.info('openai analyze: success', {
      traceId: params.traceId,
      model,
      didRepair,
      category,
      needsAction,
      hasTimelineSummary: Boolean(timelineSummary),
      hasSnippetSummary: Boolean(snippetSummary),
    });

    return result;
  } catch (error) {
    logger.warn('openai analyze failed', { error });
    return null;
  }
}
