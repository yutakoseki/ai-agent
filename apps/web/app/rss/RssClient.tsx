"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

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

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
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

export function RssClient(props: { sources: ViewSource[]; drafts: ViewDraft[] }) {
  const [sources, setSources] = useState<ViewSource[]>(props.sources);
  const [drafts] = useState<ViewDraft[]>(props.drafts);
  const [filter, setFilter] = useState<"all" | "blog" | "x">("all");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const filteredDrafts = useMemo(() => {
    if (filter === "all") return drafts;
    return drafts.filter((draft) => draft.target === filter);
  }, [drafts, filter]);

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
