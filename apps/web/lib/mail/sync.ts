import { AppError } from '@shared/error';
import { logger } from '@/lib/logger';
import { classifyMail } from '@/lib/mail/classifier';
import { buildTaskDraft } from '@/lib/mail/summarizer';
import { inferDueAtISO } from '@/lib/mail/dueDate';
import {
  collectHistoryMessageIds,
  extractGmailMessageHeaders,
  extractGmailMessageBodyText,
  fetchGmailMessage,
  fetchGmailMessageFull,
  fetchGmailThreadMetadata,
  listGmailLabels,
  createGmailLabel,
  updateGmailLabelName,
  listGmailHistory,
  modifyGmailLabels,
  refreshGmailAccessToken,
} from '@/lib/mail/gmail';
import { decryptSecret, encryptSecret } from '@/lib/mail/tokenVault';
import { getEmailAccountItem, updateEmailAccountSyncState } from '@/lib/repos/emailAccountRepo';
import {
  buildEmailMessageId,
  createEmailMessageIfNotExists,
  updateEmailMessageTaskLink,
  getEmailMessageItem,
} from '@/lib/repos/emailMessageRepo';
import {
  buildTaskIdFromMessage,
  buildTaskIdFromThread,
  createTask,
  updateTask,
} from '@/lib/repos/taskRepo';
import { sendTaskPush } from '@/lib/push/webPush';
import { getUserEmailSubscription } from '@/lib/repos/userEmailSubscriptionRepo';
import { analyzeMailWithAI, isMailAIEnabled } from '@/lib/ai/mailAnalysis';
import type { MailCategory, MailLabelIds } from '@shared/mail';
import { formatFromForDisplay, parseFromHeader } from '@/lib/mail/from';
import { formatSignatureCounterparty, inferSignatureIdentity } from '@/lib/mail/signature';

function sanitizeNextAction(input?: string): string | undefined {
  const raw = (input ?? '').trim();
  if (!raw) return undefined;
  // nextAction にメールアドレスが混ざるとノイズなので削除（必要なら本文/詳細で確認できる）
  const withoutParenEmails = raw.replace(/\([^)]*@[^\)]*\)/g, '').trim();
  const withoutEmails = withoutParenEmails.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '');
  return withoutEmails.replace(/\s+/g, ' ').trim();
}

function sanitizeTitle(params: { title: string; company?: string | null }): string {
  let t = (params.title ?? '').trim();
  if (!t) return '要対応メール';
  const company = (params.company ?? '').trim();
  if (company) {
    // タイトルに会社名が入ると冗長なので、先頭の会社名プレフィックスは落とす
    const esc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`^${esc}[\\s:：/｜|・-]+`), '').trim();
    // 末尾に（会社名）が付いている場合も落とす
    t = t.replace(new RegExp(`[（(]\\s*${esc}\\s*[）)]$`), '').trim();
  }
  return t || '要対応メール';
}

function buildTimelineSummaryFallback(params: { subject?: string; snippet?: string }): string {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  // subject は装飾（【対応依頼】など）が入りがちなので、snippet 優先でフォールバックする
  const raw = normalize(params.snippet ?? '') || normalize(params.subject ?? '') || '（要約なし）';
  return raw.length <= 60 ? raw : `${raw.slice(0, 59)}…`;
}

function buildSnippetSummaryFallback(params: {
  title?: string;
  summary?: string;
}): string | undefined {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  const title = normalize(params.title ?? '');
  const summary = normalize(params.summary ?? '');
  if (!title && !summary) return undefined;
  if (title && summary) {
    const s = `${title}\n${summary}`;
    return s.length <= 400 ? s : `${s.slice(0, 399)}…`;
  }
  const single = title || summary;
  return single.length <= 400 ? single : `${single.slice(0, 399)}…`;
}

async function resolveLegacyTaskIdFromThread(params: {
  accessToken: string;
  provider: string;
  threadId: string;
  accountEmail: string;
}): Promise<string | undefined> {
  try {
    const thread = await fetchGmailThreadMetadata({
      accessToken: params.accessToken,
      threadId: params.threadId,
    });
    const msgs = thread.messages ?? [];
    const accountEmail = params.accountEmail.toLowerCase();
    // まず「受信（=自分以外）」のメッセージを探す
    for (const m of msgs) {
      const h = extractGmailMessageHeaders(m);
      const fromEmail = parseFromHeader(h.from).email?.toLowerCase();
      const outgoing =
        Boolean(m.labelIds?.includes('SENT')) || (fromEmail && fromEmail === accountEmail);
      if (!outgoing && m.id) {
        return buildTaskIdFromMessage(params.provider, m.id);
      }
    }
    // 無ければ先頭のメッセージでフォールバック
    const first = msgs.find((m) => m.id)?.id;
    return first ? buildTaskIdFromMessage(params.provider, first) : undefined;
  } catch {
    return undefined;
  }
}

const MAX_MESSAGES_DEFAULT = 50;

type GmailLabelMap = MailLabelIds;

const GMAIL_LABEL_NAMES_JP: Record<MailCategory, string> = {
  action_required: 'AI/要対応',
  information: 'AI/情報',
  sales: 'AI/営業',
  notification: 'AI/自動通知',
  billing_payment: 'AI/請求・支払い',
  security: 'AI/セキュリティ',
};

// 旧実装で作られた可能性が高い英語ラベル（見つけたら日本語へリネームして再利用）
const GMAIL_LABEL_NAMES_LEGACY_EN: Partial<Record<MailCategory, string[]>> = {
  action_required: ['AI/Action Required', 'AI/Action', 'AI/To Do'],
  information: ['AI/Information', 'AI/Info'],
  sales: ['AI/Sales'],
  notification: ['AI/Notification', 'AI/Notifications'],
  billing_payment: ['AI/Billing Payment', 'AI/Billing', 'AI/Payment'],
  security: ['AI/Security'],
};

function getGmailLabelMap(accountLabelIds?: GmailLabelMap): GmailLabelMap {
  if (accountLabelIds && Object.keys(accountLabelIds).length > 0) {
    return accountLabelIds;
  }
  const raw = process.env.GMAIL_LABEL_IDS_JSON;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as GmailLabelMap;
  } catch {
    return {};
  }
}

async function ensureLabelId(params: {
  accessToken: string;
  category: MailCategory;
  current: GmailLabelMap;
  cache: Map<string, string> | null;
}): Promise<{ labelId?: string; updated: boolean; cache: Map<string, string> }> {
  const labelName = GMAIL_LABEL_NAMES_JP[params.category];
  if (!labelName) return { labelId: undefined, updated: false, cache: params.cache ?? new Map() };

  const existingId = params.current?.[params.category];
  if (existingId) {
    // 既存IDが指しているラベルが英語名なら日本語へリネーム（best-effort）
    const cache = params.cache ?? new Map<string, string>();
    if (cache.size === 0) {
      const labels = await listGmailLabels(params.accessToken);
      for (const l of labels) {
        if (l?.name && l?.id) cache.set(l.name, l.id);
      }
    }
    const legacy = GMAIL_LABEL_NAMES_LEGACY_EN[params.category] ?? [];
    const legacyHit = legacy.find((n) => cache.get(n) === existingId);
    if (legacyHit) {
      try {
        await updateGmailLabelName({
          accessToken: params.accessToken,
          labelId: existingId,
          name: labelName,
        });
        cache.delete(legacyHit);
        cache.set(labelName, existingId);
      } catch {
        // ignore rename errors
      }
    }
    return { labelId: existingId, updated: false, cache };
  }

  const cache = params.cache ?? new Map<string, string>();
  if (cache.size === 0) {
    const labels = await listGmailLabels(params.accessToken);
    for (const l of labels) {
      if (l?.name && l?.id) cache.set(l.name, l.id);
    }
  }

  const fromCache = cache.get(labelName);
  if (fromCache) {
    params.current[params.category] = fromCache;
    return { labelId: fromCache, updated: true, cache };
  }

  // 旧英語ラベルが存在する場合はそれを再利用し、日本語へリネームして統一する
  const legacyNames = GMAIL_LABEL_NAMES_LEGACY_EN[params.category] ?? [];
  for (const legacyName of legacyNames) {
    const legacyId = cache.get(legacyName);
    if (!legacyId) continue;
    params.current[params.category] = legacyId;
    try {
      await updateGmailLabelName({
        accessToken: params.accessToken,
        labelId: legacyId,
        name: labelName,
      });
      cache.delete(legacyName);
      cache.set(labelName, legacyId);
    } catch {
      // ignore rename errors
    }
    return { labelId: legacyId, updated: true, cache };
  }

  const created = await createGmailLabel({ accessToken: params.accessToken, name: labelName });
  cache.set(labelName, created.id);
  params.current[params.category] = created.id;
  return { labelId: created.id, updated: true, cache };
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return true;
  return Date.now() >= new Date(expiresAt).getTime() - 60_000;
}

async function ensureAccessToken(params: {
  accessTokenEnc?: string;
  refreshTokenEnc?: string;
}): Promise<{
  accessToken: string;
  accessTokenEnc: string;
  accessTokenExpiresAt?: string;
  refreshTokenEnc?: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    throw new AppError('INTERNAL_ERROR', 'Google OAuth credentials are missing');
  }

  const refreshToken = params.refreshTokenEnc ? decryptSecret(params.refreshTokenEnc) : '';
  if (!refreshToken) {
    throw new AppError('BAD_REQUEST', 'Refresh token is missing');
  }

  const refreshed = await refreshGmailAccessToken({
    clientId,
    clientSecret,
    refreshToken,
  });
  if (!refreshed.access_token) {
    throw new AppError('BAD_REQUEST', 'アクセストークンの更新に失敗しました');
  }
  const expiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : undefined;

  return {
    accessToken: refreshed.access_token,
    accessTokenEnc: encryptSecret(refreshed.access_token),
    accessTokenExpiresAt: expiresAt,
    refreshTokenEnc: refreshed.refresh_token ? encryptSecret(refreshed.refresh_token) : undefined,
  };
}

export async function syncGmailAccount(params: {
  tenantId: string;
  accountId: string;
  maxMessages?: number;
  labelId?: string;
  traceId?: string;
}): Promise<{ processed: number; skipped: number }> {
  const startedAt = Date.now();
  const account = await getEmailAccountItem(params.tenantId, params.accountId);
  if (!account) {
    throw new AppError('NOT_FOUND', 'Email account not found');
  }
  if (account.status !== 'active') {
    return { processed: 0, skipped: 0 };
  }

  // SaaS（個人の複数受信箱）: 受信箱ごとの監視/通知設定
  // subscription が無い（既存データ）場合はデフォルトで ON 扱い
  const sub = await getUserEmailSubscription({
    tenantId: params.tenantId,
    userId: account.userId,
    accountId: account.id,
  });

  let accessTokenEnc = account.accessTokenEnc;
  let accessToken = accessTokenEnc ? decryptSecret(accessTokenEnc) : '';
  let accessTokenExpiresAt = account.accessTokenExpiresAt;
  let refreshTokenEnc = account.refreshTokenEnc;

  logger.info('gmail sync: start', {
    traceId: params.traceId,
    tenantId: params.tenantId,
    accountId: params.accountId,
    userId: account.userId,
    maxMessages: params.maxMessages ?? MAX_MESSAGES_DEFAULT,
    labelId: params.labelId ?? null,
  });

  if (!accessToken || isExpired(accessTokenExpiresAt)) {
    const refreshed = await ensureAccessToken({
      accessTokenEnc,
      refreshTokenEnc,
    });
    accessToken = refreshed.accessToken;
    accessTokenEnc = refreshed.accessTokenEnc;
    accessTokenExpiresAt = refreshed.accessTokenExpiresAt;
    refreshTokenEnc = refreshed.refreshTokenEnc ?? refreshTokenEnc;
  }

  if (!account.gmailHistoryId) {
    logger.warn('gmail historyId missing', {
      traceId: params.traceId,
      tenantId: params.tenantId,
      accountId: params.accountId,
    });
    return { processed: 0, skipped: 0 };
  }

  const rawMax = params.maxMessages ?? MAX_MESSAGES_DEFAULT;
  const maxMessages = Math.min(Math.max(1, rawMax), 200);
  let pageToken: string | undefined;
  let historyId: string | undefined = account.gmailHistoryId;
  const messageIds = new Set<string>();

  do {
    const history = await listGmailHistory({
      accessToken,
      startHistoryId: account.gmailHistoryId,
      pageToken,
      labelId: params.labelId,
    });
    historyId = history.historyId ?? historyId;
    const collected = collectHistoryMessageIds(history);
    for (const id of collected) {
      if (messageIds.size >= maxMessages) break;
      messageIds.add(id);
    }
    pageToken = history.nextPageToken;
  } while (pageToken && messageIds.size < maxMessages);

  logger.info('gmail sync: history collected', {
    traceId: params.traceId,
    tenantId: params.tenantId,
    accountId: params.accountId,
    startHistoryId: account.gmailHistoryId,
    endHistoryId: historyId,
    messageCount: messageIds.size,
  });

  let processed = 0;
  let skipped = 0;
  const labelMap = getGmailLabelMap(account.labelIds);
  let labelCache: Map<string, string> | null = null;
  let labelIdsDirty = false;

  // monitoringEnabled=false の場合は「タスク化/ラベル付与/保存」を行わず、
  // historyId だけ追従して取りこぼしを防ぐ（再ON時に大量処理にならない）
  if (sub && sub.monitoringEnabled === false) {
    logger.info('gmail sync: monitoring disabled (skip processing)', {
      traceId: params.traceId,
      tenantId: params.tenantId,
      accountId: params.accountId,
    });
    await updateEmailAccountSyncState({
      tenantId: params.tenantId,
      accountId: params.accountId,
      accessTokenEnc,
      refreshTokenEnc,
      accessTokenExpiresAt,
      gmailHistoryId: historyId,
    });
    return { processed: 0, skipped: 0 };
  }

  for (const messageId of Array.from(messageIds)) {
    try {
      const aiEnabled = isMailAIEnabled();
      logger.debug('gmail sync: message start', {
        traceId: params.traceId,
        tenantId: params.tenantId,
        accountId: params.accountId,
        messageId,
        aiEnabled,
      });
      const message = aiEnabled
        ? await fetchGmailMessageFull({ accessToken, messageId })
        : await fetchGmailMessage({ accessToken, messageId });
      const headers = extractGmailMessageHeaders(message);
      const bodyText = aiEnabled ? extractGmailMessageBodyText(message) : undefined;

      const ai = aiEnabled
        ? await analyzeMailWithAI({
            subject: headers.subject,
            from: headers.from,
            to: headers.to,
            snippet: message.snippet,
            bodyText,
            traceId: params.traceId,
          })
        : null;

      logger.debug('gmail sync: analyzed', {
        traceId: params.traceId,
        tenantId: params.tenantId,
        accountId: params.accountId,
        messageId,
        hasAI: Boolean(ai),
        aiCategory: ai?.category ?? null,
        aiNeedsAction: ai?.needsAction ?? null,
        hasTimelineSummary: Boolean((ai?.timelineSummary ?? '').trim()),
        hasSnippetSummary: Boolean((ai?.snippetSummary ?? '').trim()),
        draftTitleLen: (ai?.draft?.title ?? '').length,
        draftSummaryLen: (ai?.draft?.summary ?? '').length,
      });

      // 署名はAIが有効ならAIの抽出を最優先（本文は既にAIに渡しているので追加コストほぼなし）
      const signature =
        ai?.signature?.company || ai?.signature?.person
          ? {
              company: ai.signature?.company ?? undefined,
              person: ai.signature?.person ?? undefined,
            }
          : inferSignatureIdentity(bodyText);
      const counterpartyFromSignature = formatSignatureCounterparty(signature as any);

      // 送信済み（=自分の返信）も拾えるので、方向を判定
      const accountEmail = (account.email ?? '').toLowerCase();
      const fromEmail = parseFromHeader(headers.from).email?.toLowerCase();
      const isOutgoing =
        Boolean(message.labelIds?.includes('SENT')) || (fromEmail && fromEmail === accountEmail);
      const direction: 'incoming' | 'outgoing' | 'unknown' = isOutgoing
        ? 'outgoing'
        : fromEmail
          ? 'incoming'
          : 'unknown';

      const rawClassification = ai
        ? {
            category: ai.category,
            // action_required は必ずタスク化対象（AIが false を返しても矯正）
            needsAction: ai.category === 'action_required' ? true : ai.needsAction,
          }
        : classifyMail({
            subject: headers.subject,
            from: headers.from,
            snippet: message.snippet,
          });

      // 「ユーザーがやることがある(=needsAction=true)」なら、カテゴリは最優先で要対応に寄せる
      const classification = (isOutgoing ? false : rawClassification.needsAction)
        ? { ...rawClassification, category: 'action_required' as const }
        : rawClassification;

      const messageKey = buildEmailMessageId(account.provider, message.id);
      const now = new Date().toISOString();
      const receivedAt = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : undefined;
      const timelineSummary =
        // まず AI の timelineSummary（新仕様）
        (ai?.timelineSummary ?? '').trim() ||
        // AIが新フィールドを返さない場合でも、最低限AIの title を使って件名依存を避ける
        (ai?.draft?.title ?? '').trim() ||
        buildTimelineSummaryFallback({ subject: headers.subject, snippet: message.snippet });

      const snippetSummary =
        // AIの要点まとめ（新仕様）
        (ai?.snippetSummary ?? '').trim() ||
        // 返ってこない場合の最低限: AIの title/summary を使う（Gmail snippet 生表示を避ける）
        buildSnippetSummaryFallback({ title: ai?.draft?.title, summary: ai?.draft?.summary });
      const created = await createEmailMessageIfNotExists(params.tenantId, {
        id: messageKey,
        provider: account.provider,
        accountId: account.id,
        messageId: message.id,
        threadId: message.threadId,
        subject: headers.subject,
        from: headers.from,
        to: headers.to ? [headers.to] : undefined,
        cc: headers.cc ? [headers.cc] : undefined,
        snippet: message.snippet,
        snippetSummary,
        timelineSummary,
        direction,
        receivedAt,
        internalDate: message.internalDate,
        labelIds: message.labelIds,
        category: classification.category,
        needsAction: classification.needsAction,
        createdAt: now,
        updatedAt: now,
      });

      logger.debug('gmail sync: email_message saved', {
        traceId: params.traceId,
        tenantId: params.tenantId,
        accountId: params.accountId,
        messageId: message.id,
        messageKey,
        created,
        hasTimelineSummary: Boolean(String(timelineSummary ?? '').trim()),
        hasSnippetSummary: Boolean(String(snippetSummary ?? '').trim()),
      });

      if (!created) {
        // 既存でも、taskIdリンクや要約が未セットなら追記したいので確認する
        const existing = await getEmailMessageItem(params.tenantId, messageKey);
        const existingTimeline = String(existing?.timelineSummary ?? '').trim();
        const existingSubject = String(existing?.subject ?? '').trim();
        // 既存timelineSummaryが「件名そのまま」っぽい場合は、本文要約に更新したいのでスキップしない
        const looksLikeSubject = Boolean(
          existingTimeline && existingSubject && existingTimeline === existingSubject
        );
        const existingSnippetSummary = String((existing as any)?.snippetSummary ?? '').trim();
        const needsUpgrade = looksLikeSubject || !existingTimeline || !existingSnippetSummary;
        if (existing?.taskId && !needsUpgrade) {
          skipped += 1;
          logger.debug('gmail sync: message skipped (already linked & summarized)', {
            traceId: params.traceId,
            tenantId: params.tenantId,
            accountId: params.accountId,
            messageId: message.id,
            messageKey,
            taskId: existing.taskId,
          });
          continue;
        }
      }

      processed += 1;

      // Gmail: スレッド単位で1タスクに集約。
      // ただし移行期間のため、旧(messageId)ベースで既に作られたタスクがあるスレッドは旧IDを優先して更新する。
      const threadTaskId = message.threadId
        ? buildTaskIdFromThread(account.provider, message.threadId)
        : buildTaskIdFromMessage(account.provider, message.id);
      const legacyTaskId = message.threadId
        ? await resolveLegacyTaskIdFromThread({
            accessToken,
            provider: account.provider,
            threadId: message.threadId,
            accountEmail: account.email,
          })
        : undefined;
      const taskId = legacyTaskId ?? threadTaskId;

      // 送信済み（自分の返信）の場合: 新規タスクは作らず、既存タスクを「返信済み（確認待ち）」に寄せる
      if (isOutgoing) {
        try {
          const updated = await updateTask({
            tenantId: params.tenantId,
            taskId,
            status: 'done',
            nextAction: '返信済み（相手の確認待ち）',
          });
          await updateEmailMessageTaskLink({
            tenantId: params.tenantId,
            messageKey,
            taskId: updated.id,
            timelineSummary,
            snippetSummary,
            direction,
            receivedAt: receivedAt ?? null,
          });
          logger.info('gmail sync: outgoing linked to task (done)', {
            traceId: params.traceId,
            tenantId: params.tenantId,
            accountId: params.accountId,
            messageId: message.id,
            messageKey,
            taskId: updated.id,
          });
        } catch {
          // 既存タスクが無い等は無視
        }
      } else if (classification.needsAction) {
        const draft =
          ai?.draft ??
          buildTaskDraft({
            subject: headers.subject,
            snippet: message.snippet,
          });
        const title = sanitizeTitle({ title: draft.title, company: signature?.company ?? null });
        const inferredDueAt =
          draft.dueAt ??
          inferDueAtISO({
            text: [headers.subject, message.snippet, bodyText, draft.nextAction, draft.summary]
              .filter(Boolean)
              .join('\n'),
            now: message.internalDate ? new Date(Number(message.internalDate)) : new Date(),
          });
        try {
          const task = await createTask({
            tenantId: params.tenantId,
            userId: account.userId,
            accountId: account.id,
            category: classification.category,
            from: headers.from,
            counterparty: counterpartyFromSignature ?? formatFromForDisplay(headers.from),
            title,
            summary: draft.summary,
            nextAction: sanitizeNextAction(draft.nextAction),
            dueAt: inferredDueAt,
            sourceProvider: account.provider,
            sourceMessageId: message.id,
            taskId,
          });
          await updateEmailMessageTaskLink({
            tenantId: params.tenantId,
            messageKey,
            taskId: task.id,
            timelineSummary,
            snippetSummary,
            direction,
            receivedAt: receivedAt ?? null,
          });
          logger.info('gmail sync: task created & linked', {
            traceId: params.traceId,
            tenantId: params.tenantId,
            accountId: params.accountId,
            messageId: message.id,
            messageKey,
            taskId: task.id,
            category: classification.category,
          });
          // pushEnabled=false の場合は通知しない
          if (!sub || sub.pushEnabled) {
            await sendTaskPush({
              userId: account.userId,
              task,
            });
          }
        } catch (error: any) {
          const name = error && typeof error === 'object' ? String(error.name) : '';
          if (name !== 'ConditionalCheckFailedException') throw error;

          // 既存タスクがあれば「新着で再オープン」し、内容を最新化
          try {
            const updated = await updateTask({
              tenantId: params.tenantId,
              taskId,
              status: 'open',
              title,
              summary: draft.summary,
              nextAction: sanitizeNextAction(draft.nextAction),
              dueAt: inferredDueAt ?? null,
              category: classification.category,
              from: headers.from ?? null,
              counterparty: counterpartyFromSignature ? counterpartyFromSignature : undefined,
            });
            await updateEmailMessageTaskLink({
              tenantId: params.tenantId,
              messageKey,
              taskId: updated.id,
              timelineSummary,
              snippetSummary,
              direction,
              receivedAt: receivedAt ?? null,
            });
            logger.info('gmail sync: task updated & linked', {
              traceId: params.traceId,
              tenantId: params.tenantId,
              accountId: params.accountId,
              messageId: message.id,
              messageKey,
              taskId: updated.id,
              category: classification.category,
            });
            if (!sub || sub.pushEnabled) {
              await sendTaskPush({ userId: account.userId, task: updated });
            }
          } catch {
            // ignore
          }
        }
      } else {
        logger.debug('gmail sync: no task needed', {
          traceId: params.traceId,
          tenantId: params.tenantId,
          accountId: params.accountId,
          messageId: message.id,
          messageKey,
          category: classification.category,
          needsAction: classification.needsAction,
          isOutgoing,
        });
      }

      const ensured = await ensureLabelId({
        accessToken,
        category: classification.category,
        current: labelMap,
        cache: labelCache,
      });
      labelCache = ensured.cache;
      if (ensured.updated) labelIdsDirty = true;

      if (ensured.labelId) {
        await modifyGmailLabels({
          accessToken,
          messageId: message.id,
          addLabelIds: [ensured.labelId],
        });
      }
    } catch (error) {
      skipped += 1;
      logger.warn('gmail sync message failed', {
        error,
        messageId,
        traceId: params.traceId,
        tenantId: params.tenantId,
        accountId: params.accountId,
      });
    }
  }

  await updateEmailAccountSyncState({
    tenantId: params.tenantId,
    accountId: params.accountId,
    accessTokenEnc,
    refreshTokenEnc,
    accessTokenExpiresAt,
    labelIds: labelIdsDirty ? labelMap : undefined,
    gmailHistoryId: historyId,
  });

  logger.info('gmail sync: done', {
    traceId: params.traceId,
    tenantId: params.tenantId,
    accountId: params.accountId,
    processed,
    skipped,
    durationMs: Date.now() - startedAt,
  });
  return { processed, skipped };
}
