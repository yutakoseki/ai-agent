"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Task, TaskStatus } from "@shared/mail";
import { formatFromForDisplay } from "@/lib/mail/from";

type TaskView = Omit<Task, "createdAt" | "updatedAt" | "dueAt"> & {
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
};

type EmailMessageView = {
  provider: string;
  accountId: string;
  messageId: string;
  threadId: string | null;
  subject: string | null;
  from: string | null;
  to: string[] | null;
  cc: string[] | null;
  snippet: string | null;
  receivedAt: string | null;
};

type ThreadMessageView = {
  messageKey: string;
  messageId: string;
  threadId: string | null;
  from: string | null;
  summary: string | null;
  receivedAt: string | null;
  direction: "incoming" | "outgoing" | "unknown";
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateTime(value: string | undefined | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}`;
}

function formatDue(value: string | undefined): string {
  if (!value) return "なし";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

function truncateLine(input: string | null | undefined, max = 110): string {
  const s = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "（本文なし）";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function pickKeyPoint(params: {
  direction: "incoming" | "outgoing" | "unknown";
  subject: string | null;
  snippet: string | null;
}): string {
  const subject = String(params.subject ?? "").trim();
  const snippet = String(params.snippet ?? "").replace(/\s+/g, " ").trim();

  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const splitSentences = (s: string) =>
    s
      .split(/(?:。|\n)+/)
      .map((v) => normalize(v))
      .filter(Boolean);

  const isBoilerplate = (s: string) =>
    /^(株式会社|有限会社|合同会社|.*ご担当者様|.*ご担当者さま|.*様|お世話になっております|いつもお世話になっております|こんにちは|はじめまして)/.test(
      s
    );

  const pickFromSnippet = () => {
    for (const sent of splitSentences(snippet)) {
      if (isBoilerplate(sent)) continue;
      if (sent.length < 6) continue;
      return sent;
    }
    return snippet;
  };

  // 受信: 件名（要点）優先。送信: 返信文の要点（挨拶を除いた最初の1文）優先。
  const raw =
    params.direction === "outgoing"
      ? pickFromSnippet() || subject
      : subject || pickFromSnippet();

  return truncateLine(raw, 56);
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "未対応",
  in_progress: "対応中",
  done: "完了",
  archived: "アーカイブ",
};

function buildGmailWebUrl(messageId: string): string {
  // best-effort: ユーザーがそのGoogleアカウントでログインしていれば開ける
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(messageId)}`;
}

export function TaskDetailClient(props: { task: TaskView }) {
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error">("loading");
  const [emailMessage, setEmailMessage] = useState<EmailMessageView | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessageView[] | null>(null);
  const [mailBodyText, setMailBodyText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMessageKey, setSelectedMessageKey] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [chatStatus, setChatStatus] = useState<"idle" | "asking" | "error">("idle");

  useEffect(() => {
    async function load() {
      setDetailStatus("loading");
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(props.task.id)}/detail`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setDetailStatus("error");
          setErrorMessage(data?.message || "詳細の取得に失敗しました。");
          return;
        }
        setEmailMessage(data?.emailMessage ?? null);
        setMailBodyText(typeof data?.mailBodyText === "string" ? data.mailBodyText : null);
        setThreadMessages(Array.isArray(data?.threadMessages) ? data.threadMessages : null);
        const firstKey =
          Array.isArray(data?.threadMessages) && data.threadMessages.length
            ? String(data.threadMessages[data.threadMessages.length - 1]?.messageKey ?? "")
            : null;
        setSelectedMessageKey(firstKey || null);
        setDetailStatus("idle");
      } catch {
        setDetailStatus("error");
        setErrorMessage("通信に失敗しました。ネットワークを確認してください。");
      }
    }
    void load();
  }, [props.task.id]);

  async function selectMessage(messageKey: string) {
    setSelectedMessageKey(messageKey);
    try {
      const res = await fetch(
        `/api/tasks/${encodeURIComponent(props.task.id)}/message?messageKey=${encodeURIComponent(
          messageKey
        )}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setEmailMessage(data?.emailMessage ?? null);
      setMailBodyText(typeof data?.mailBodyText === "string" ? data.mailBodyText : null);
    } catch {
      // ignore
    }
  }

  const gmailUrl = useMemo(() => {
    if (!emailMessage?.messageId || emailMessage.provider !== "gmail") return null;
    return buildGmailWebUrl(emailMessage.messageId);
  }, [emailMessage]);

  async function ask() {
    if (!emailMessage?.accountId || !emailMessage?.messageId) {
      setChatStatus("error");
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "このタスクに紐づくメール情報がありません。" },
      ]);
      return;
    }
    const question = chatInput.trim();
    if (!question) return;
    setChatStatus("asking");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatInput("");
    try {
      const res = await fetch("/api/mail/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accountId: emailMessage.accountId,
          messageId: emailMessage.messageId,
          question,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChatStatus("error");
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: String(data?.message || "AIに質問できませんでした。") },
        ]);
        return;
      }
      setChatStatus("idle");
      setChatMessages((prev) => [...prev, { role: "assistant", content: String(data?.answer ?? "") }]);
    } catch {
      setChatStatus("error");
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "通信に失敗しました。ネットワークを確認してください。" },
      ]);
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Task</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">タスク詳細</h1>
          <Link className="text-sm text-primary hover:underline" href="/tasks">
            ← 一覧に戻る
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 左: 時系列 */}
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-6">
            <Card title="時系列" className="border border-ink/10 bg-surface/90 shadow-panel">
              {detailStatus === "loading" ? (
                <p className="text-sm text-ink-soft">読み込み中...</p>
              ) : detailStatus === "error" ? (
                <p className="text-sm text-accent">{errorMessage ?? "読み込みに失敗しました。"}</p>
              ) : !threadMessages || threadMessages.length === 0 ? (
                <p className="text-sm text-ink-soft">スレッド情報がありません。</p>
              ) : (
                <div className="space-y-2">
                  {threadMessages.map((m) => {
                    const outgoing = m.direction === "outgoing";
                    const who = outgoing
                      ? "自分"
                      : props.task.counterparty ?? formatFromForDisplay(m.from);
                    const line = truncateLine(m.summary, 56);
                    const active = selectedMessageKey === m.messageKey;
                    return (
                      <button
                        type="button"
                        key={m.messageId}
                        onClick={() => void selectMessage(m.messageKey)}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                          outgoing
                            ? "border-primary/20 bg-primary/10"
                            : "border-ink/10 bg-surface-raised/40"
                        } ${active ? "ring-2 ring-primary/40" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-ink">{who}</span>
                          <span className="text-ink-soft">{formatDateTime(m.receivedAt)}</span>
                        </div>
                        <div className="mt-1 text-sm text-ink-soft">{line}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* 中央: タスク詳細 */}
        <div className="space-y-6 lg:col-span-5">
          <Card title="タスク" className="border border-ink/10 bg-surface/90 shadow-panel">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-ink">{props.task.title}</div>
              <div className="text-xs text-ink-soft">
                締切: <span className="font-medium text-ink">{formatDue(props.task.dueAt)}</span>
                <span className="mx-2 text-ink/20">|</span>
                更新: <span className="font-medium text-ink">{formatDateTime(props.task.updatedAt)}</span>
                <span className="mx-2 text-ink/20">|</span>
                ステータス: <span className="font-medium text-ink">{STATUS_LABELS[props.task.status]}</span>
              </div>

              {props.task.summary ? (
                <div className="rounded-xl border border-ink/10 bg-surface-raised/40 p-3 text-sm text-ink">
                  {props.task.summary}
                </div>
              ) : null}

              <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
                <div className="text-xs font-semibold text-primary">次アクション</div>
                <div className="mt-1 text-base font-semibold text-ink">
                  {props.task.nextAction ? props.task.nextAction : "（未設定）"}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="元メール"
            actions={
              gmailUrl ? (
                <a
                  className="inline-flex h-9 items-center rounded-xl border border-ink/10 bg-surface-raised/60 px-3 text-sm text-ink hover:bg-surface-raised"
                  href={gmailUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Gmailで開く
                </a>
              ) : null
            }
            className="border border-ink/10 bg-surface/90 shadow-panel"
          >
            {!emailMessage ? (
              <p className="text-sm text-ink-soft">このタスクに紐づくメール情報がありません。</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="text-ink">
                  <span className="text-ink-soft">件名:</span> {emailMessage.subject ?? "（不明）"}
                </div>
                <div className="text-ink">
                  <span className="text-ink-soft">差出人:</span>{" "}
                  {formatFromForDisplay(emailMessage.from)}
                </div>
                <div className="text-ink">
                  <span className="text-ink-soft">受信:</span> {formatDateTime(emailMessage.receivedAt)}
                </div>
                {emailMessage.snippet ? (
                  <pre className="whitespace-pre-wrap rounded-xl border border-ink/10 bg-surface-raised/40 p-3 text-sm text-ink">
                    {emailMessage.snippet}
                  </pre>
                ) : null}
                {mailBodyText ? (
                  <details className="rounded-xl border border-ink/10 bg-surface-raised/40 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-ink">
                      本文（抜粋）
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
                      {mailBodyText.slice(0, 4000)}
                    </pre>
                  </details>
                ) : null}
              </div>
            )}
          </Card>
        </div>

        {/* 右: チャット */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-6">
            <Card title="AIチャット" className="border border-ink/10 bg-surface/90 shadow-panel">
              <div className="flex h-[82svh] flex-col">
                <div className="flex-1 space-y-2 overflow-auto rounded-xl border border-ink/10 bg-surface-raised/30 p-3">
                  {chatMessages.length === 0 ? (
                    <p className="text-sm text-ink-soft">
                      右下の入力欄から質問できます（例: 次に何を返す？期限は？）。
                    </p>
                  ) : (
                    chatMessages.map((m, idx) => (
                      <div
                        key={idx}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[92%] whitespace-pre-wrap rounded-2xl border px-3 py-2 text-sm ${
                            m.role === "user"
                              ? "border-primary/20 bg-primary/10 text-ink"
                              : "border-ink/10 bg-surface-raised/60 text-ink"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form
                  className="mt-3 flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask();
                  }}
                >
                  <textarea
                    className="min-h-[44px] flex-1 resize-none rounded-xl border border-ink/10 bg-secondary px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="質問を入力…"
                  />
                  <Button
                    className="h-10 rounded-xl"
                    type="submit"
                    disabled={chatStatus === "asking" || !chatInput.trim()}
                  >
                    {chatStatus === "asking" ? "送信中..." : "送信"}
                  </Button>
                </form>
                <p className="mt-2 text-xs text-ink-soft">
                  ※ AIチャットは `OPENAI_API_KEY` が設定されている必要があります。
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


