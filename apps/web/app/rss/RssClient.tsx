"use client";

import { useMemo, useState } from "react";
import type { RssGenerationTarget } from "@shared/rss";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { XPostBatchView } from "@/lib/x-posts/serializer";

type ViewSource = {
  id: string;
  url: string;
  status: "active" | "disabled" | "error";
  title?: string;
  lastFetchedAt?: string | null;
  nextFetchAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ViewDraft = {
  id: string;
  target: "blog" | "x";
  itemTitle: string;
  itemUrl: string;
  sourceTitle?: string;
  title?: string;
  text: string;
  createdAt: string;
};

type Status = "idle" | "saving" | "success" | "error";
type PostStatus = "idle" | "posting" | "posted" | "error";

const DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Tokyo",
});

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return DATE_FORMATTER.format(date);
}

function normalizeSource(raw: any): ViewSource {
  return {
    id: String(raw?.id ?? ""),
    url: String(raw?.url ?? ""),
    status: raw?.status ?? "active",
    title: raw?.title ?? undefined,
    lastFetchedAt: raw?.lastFetchedAt ?? null,
    nextFetchAt: raw?.nextFetchAt ?? null,
    createdAt: raw?.createdAt ?? "",
    updatedAt: raw?.updatedAt ?? "",
  };
}

export function RssClient(props: {
  sources: ViewSource[];
  drafts: ViewDraft[];
  initialRssTargets: RssGenerationTarget[];
  initialRssWriterRole: string;
  initialRssTargetPersona: string;
  initialRssPostTone: string;
  initialRssPostFormat: string;
  initialXPostBatches: XPostBatchView[];
  xAccountConnected: boolean;
  xAccountScreenName?: string;
}) {
  const [sources, setSources] = useState<ViewSource[]>(props.sources);
  const [drafts] = useState<ViewDraft[]>(props.drafts);
  const [xPostBatches, setXPostBatches] = useState<XPostBatchView[]>(
    props.initialXPostBatches
  );
  const xConnected = props.xAccountConnected;
  const xScreenName = props.xAccountScreenName;
  const [filter, setFilter] = useState<"all" | "blog" | "x">("all");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [styleStatus, setStyleStatus] = useState<Status>("idle");
  const [styleMessage, setStyleMessage] = useState<string | null>(null);
  const [xPostStatus, setXPostStatus] = useState<Status>("idle");
  const [xPostMessage, setXPostMessage] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<Record<string, PostStatus>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [writerRole, setWriterRole] = useState(props.initialRssWriterRole);
  const [targetPersona, setTargetPersona] = useState(props.initialRssTargetPersona);
  const [postTone, setPostTone] = useState(props.initialRssPostTone);
  const [postFormat, setPostFormat] = useState(props.initialRssPostFormat);
  const [rssSelected, setRssSelected] = useState<Record<RssGenerationTarget, boolean>>(() => {
    const init = new Set(props.initialRssTargets);
    return {
      blog: init.has("blog"),
      x: init.has("x"),
    };
  });

  const filteredDrafts = useMemo(() => {
    if (filter === "all") return drafts;
    return drafts.filter((draft) => draft.target === filter);
  }, [drafts, filter]);

  const rssTargets = useMemo(
    () =>
      (Object.keys(rssSelected) as RssGenerationTarget[]).filter(
        (k) => rssSelected[k]
      ),
    [rssSelected]
  );

  async function addSource() {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("URLを入力してください。");
      return;
    }

    setStatus("saving");
    setMessage(null);
    const res = await fetch("/api/rss/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setMessage(data?.message || "登録に失敗しました。");
      return;
    }
    const created = normalizeSource(data);
    setSources((prev) => [created, ...prev]);
    setUrl("");
    setStatus("success");
    setMessage("RSSを登録しました。");
  }

  async function toggleStatus(source: ViewSource) {
    const nextStatus = source.status === "disabled" ? "active" : "disabled";
    const res = await fetch(`/api/rss/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) return;
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, status: nextStatus } : s))
    );
  }

  async function removeSource(source: ViewSource) {
    const res = await fetch(`/api/rss/sources/${source.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) return;
    setSources((prev) => prev.filter((s) => s.id !== source.id));
  }

  async function copyDraft(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  async function saveRssStyle() {
    setStyleStatus("saving");
    setStyleMessage(null);
    if (rssTargets.length === 0) {
      setStyleStatus("error");
      setStyleMessage("少なくとも1つの出力先を選択してください。");
      return;
    }
    if (writerRole.length > 200) {
      setStyleStatus("error");
      setStyleMessage("ロールは200文字以内で入力してください。");
      return;
    }
    if (targetPersona.length > 200) {
      setStyleStatus("error");
      setStyleMessage("ペルソナは200文字以内で入力してください。");
      return;
    }
    if (postTone.length > 200) {
      setStyleStatus("error");
      setStyleMessage("テイストは200文字以内で入力してください。");
      return;
    }
    if (postFormat.length > 500) {
      setStyleStatus("error");
      setStyleMessage("出力フォーマットは500文字以内で入力してください。");
      return;
    }

    const res = await fetch("/api/rss/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        generationTargets: rssTargets,
        writerRole,
        targetPersona,
        postTone,
        postFormat,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStyleStatus("error");
      setStyleMessage(data?.message || "保存に失敗しました。");
      return;
    }
    setStyleStatus("success");
    setStyleMessage("保存しました。新規生成に反映されます。");
  }

  async function generateXPosts() {
    setXPostStatus("saving");
    setXPostMessage(null);
    const res = await fetch("/api/x-posts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setXPostStatus("error");
      setXPostMessage(data?.message || "生成に失敗しました。");
      return;
    }
    if (data?.batch) {
      setXPostBatches((prev) => [data.batch, ...prev]);
    }
    setXPostStatus("success");
    setXPostMessage("ポスト候補を生成しました。");
  }

  async function postToX(batchId: string, rank: number) {
    if (!xConnected) {
      setXPostStatus("error");
      setXPostMessage("X連携が必要です。");
      return;
    }
    const key = `${batchId}:${rank}`;
    setPostStatus((prev) => ({ ...prev, [key]: "posting" }));
    const res = await fetch(`/api/x-posts/${batchId}/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rank }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPostStatus((prev) => ({ ...prev, [key]: "error" }));
      setXPostStatus("error");
      setXPostMessage(data?.message || "投稿に失敗しました。");
      return;
    }
    setPostStatus((prev) => ({ ...prev, [key]: "posted" }));
    setXPostStatus("success");
    setXPostMessage("Xに投稿しました。");
    setXPostBatches((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch;
        const posted = batch.posted ? [...batch.posted] : [];
        posted.push({
          rank,
          tweetId: String(data?.tweetId ?? ""),
          postedAt: new Date().toISOString(),
        });
        return { ...batch, posted };
      })
    );
  }

  async function copyUrls(urls: string[], key: string) {
    const text = urls.filter(Boolean).join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-screen-xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">RSS</p>
        <h1 className="text-2xl font-semibold">RSS収集</h1>
      </header>

      <Card title="RSSソースの登録" className="border border-ink/10 bg-surface/90 shadow-panel">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="h-11 flex-1"
            />
            <Button
              type="button"
              className="h-11 rounded-xl"
              onClick={addSource}
              disabled={status === "saving"}
            >
              {status === "saving" ? "登録中..." : "追加"}
            </Button>
          </div>
          {message ? (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                status === "success"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : status === "error"
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-ink/10 bg-surface-raised/60 text-ink-soft"
              }`}
            >
              {message}
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="登録済みRSS" className="border border-ink/10 bg-surface/90 shadow-panel">
        <div className="space-y-3 text-sm">
          {sources.length === 0 ? (
            <p className="text-ink-soft">まだRSSが登録されていません。</p>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-surface-raised/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">
                        {source.status}
                      </div>
                      <div className="font-medium text-ink">{source.title ?? source.url}</div>
                      <div className="break-all text-xs text-ink-soft">{source.url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        className="h-9 rounded-xl"
                        onClick={() => toggleStatus(source)}
                      >
                        {source.status === "disabled" ? "有効化" : "停止"}
                      </Button>
                      <Button
                        type="button"
                        className="h-9 rounded-xl"
                        onClick={() => removeSource(source)}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs text-ink-soft sm:grid-cols-2">
                    <div>最終取得: {formatDate(source.lastFetchedAt)}</div>
                    <div>次回取得: {formatDate(source.nextFetchAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="投稿スタイル" className="border border-ink/10 bg-surface/90 shadow-panel">
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {(["x", "blog"] as RssGenerationTarget[]).map((k) => (
              <label
                key={k}
                className="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl border border-ink/10 bg-secondary px-3 py-2 text-ink"
              >
                <input
                  type="checkbox"
                  checked={rssSelected[k]}
                  onChange={(e) =>
                    setRssSelected((prev) => ({ ...prev, [k]: e.target.checked }))
                  }
                />
                <span className="font-medium">{k === "x" ? "X" : "ブログ"}</span>
              </label>
            ))}
          </div>
          <label className="grid gap-1 text-ink">
            <span className="font-medium">書き手のロール</span>
            <Input
              value={writerRole}
              onChange={(e) => setWriterRole(e.target.value)}
              placeholder="例: AIプロダクトの戦略担当"
              className="h-11"
            />
          </label>
          <label className="grid gap-1 text-ink">
            <span className="font-medium">対象ペルソナ</span>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-ink/10 bg-secondary px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
              value={targetPersona}
              onChange={(e) => setTargetPersona(e.target.value)}
              placeholder={"例:\n国内SaaSのCTO。意思決定者で、効率と安全性に関心がある。"}
            />
          </label>
          <label className="grid gap-1 text-ink">
            <span className="font-medium">ポストのテイスト</span>
            <Input
              value={postTone}
              onChange={(e) => setPostTone(e.target.value)}
              placeholder="例: 実務に使える視点で、簡潔かつフレンドリー"
              className="h-11"
            />
          </label>
          <label className="grid gap-1 text-ink">
            <span className="font-medium">出力フォーマット</span>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-ink/10 bg-secondary px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
              value={postFormat}
              onChange={(e) => setPostFormat(e.target.value)}
              placeholder={"例:\n1文目: 事実の要約\n2文目: 重要性\n3文目: 具体例/たとえ"}
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              className="h-10 rounded-xl"
              onClick={saveRssStyle}
              disabled={styleStatus === "saving"}
            >
              {styleStatus === "saving" ? "保存中..." : "保存"}
            </Button>
          </div>
          {styleMessage ? (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                styleStatus === "success"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : styleStatus === "error"
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-ink/10 bg-surface-raised/60 text-ink-soft"
              }`}
            >
              {styleMessage}
            </div>
          ) : null}
          <p className="text-xs text-ink-soft">
            新しく作成される下書きから反映されます。
          </p>
        </div>
      </Card>

      <Card title="Xポスト生成" className="border border-ink/10 bg-surface/90 shadow-panel">
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs text-ink-soft">
                システムプロンプトで今日の候補を生成します。
              </p>
              <div className="text-xs text-ink-soft">
                X連携:{" "}
                <span className="font-semibold text-ink">
                  {xConnected ? `連携済み${xScreenName ? ` @${xScreenName}` : ""}` : "未連携"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="h-10 rounded-xl"
                onClick={() => {
                  window.location.href = "/api/auth/x?redirect=/rss";
                }}
              >
                {xConnected ? "再連携" : "X連携"}
              </Button>
              <Button
                type="button"
                className="h-10 rounded-xl"
                onClick={generateXPosts}
                disabled={xPostStatus === "saving"}
              >
                {xPostStatus === "saving" ? "生成中..." : "ポスト生成"}
              </Button>
            </div>
          </div>
          {xPostMessage ? (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                xPostStatus === "success"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : xPostStatus === "error"
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-ink/10 bg-surface-raised/60 text-ink-soft"
              }`}
            >
              {xPostMessage}
            </div>
          ) : null}
          {xPostBatches.length === 0 ? (
            <p className="text-sm text-ink-soft">まだ生成されていません。</p>
          ) : (
            <div className="space-y-3">
              {xPostBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="space-y-3 rounded-xl border border-ink/10 bg-surface-raised/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                    <span>対象日: {batch.date}</span>
                    <span>生成: {formatDate(batch.createdAt)}</span>
                  </div>
                  <div className="space-y-3">
                    {batch.topics.map((topic) => {
                      const key = `${batch.id}:${topic.rank}`;
                      const wasPosted = batch.posted?.some(
                        (entry) => entry.rank === topic.rank
                      );
                      const currentStatus = postStatus[key] ?? (wasPosted ? "posted" : "idle");
                      const postLabel = !xConnected
                        ? "連携が必要"
                        : currentStatus === "posting"
                          ? "投稿中..."
                          : currentStatus === "posted"
                            ? "投稿済み"
                            : currentStatus === "error"
                              ? "再投稿"
                              : "Xに投稿";
                      const postDisabled =
                        !xConnected || currentStatus === "posting" || currentStatus === "posted";
                      const copyLabel =
                        copiedKey === key ? "コピー済み" : "URLコピー";

                      return (
                        <div
                          key={key}
                          className="space-y-2 rounded-xl border border-ink/10 bg-surface/80 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                            <span>
                              #{topic.rank} / {topic.importance}
                            </span>
                            <span>{topic.sourceType}</span>
                          </div>
                          <div className="text-sm font-semibold text-ink">
                            {topic.title}
                          </div>
                          <pre className="whitespace-pre-wrap text-sm text-ink">
                            {topic.summary}
                          </pre>
                          <div className="flex flex-wrap gap-2 text-xs text-ink-soft">
                            <span>{topic.postTypeName}</span>
                            {topic.publishedDate ? (
                              <span>公開日 {topic.publishedDate}</span>
                            ) : null}
                          </div>
                          {topic.urls.length ? (
                            <div className="break-all text-xs text-ink-soft">
                              {topic.urls.join(" ")}
                            </div>
                          ) : null}
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              className="h-9 rounded-xl"
                              onClick={() => copyUrls(topic.urls, key)}
                              disabled={topic.urls.length === 0}
                            >
                              {copyLabel}
                            </Button>
                            <Button
                              type="button"
                              className="h-9 rounded-xl"
                              onClick={() => postToX(batch.id, topic.rank)}
                              disabled={postDisabled}
                            >
                              {postLabel}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="下書き一覧" className="border border-ink/10 bg-surface/90 shadow-panel">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {(["all", "x", "blog"] as const).map((key) => (
              <Button
                key={key}
                type="button"
                className="h-9 rounded-xl"
                onClick={() => setFilter(key)}
              >
                {key === "all" ? "すべて" : key === "x" ? "X" : "ブログ"}
              </Button>
            ))}
          </div>
          {filteredDrafts.length === 0 ? (
            <p className="text-sm text-ink-soft">下書きはまだありません。</p>
          ) : (
            <div className="space-y-3">
              {filteredDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-xl border border-ink/10 bg-surface-raised/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                    <span>{draft.target === "x" ? "X" : "ブログ"}</span>
                    <span>{formatDate(draft.createdAt)}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <a
                      href={draft.itemUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      {draft.itemTitle}
                    </a>
                    {draft.title ? (
                      <div className="text-sm font-medium text-ink">{draft.title}</div>
                    ) : null}
                    <pre className="whitespace-pre-wrap text-sm text-ink">{draft.text}</pre>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      className="h-9 rounded-xl"
                      onClick={() => copyDraft(draft.text)}
                    >
                      コピー
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
