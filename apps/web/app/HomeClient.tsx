"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PushSubscribeCard } from "@/components/push/PushSubscribeCard";

type Status = "idle" | "saving" | "success" | "error";

type Notice = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

export function HomeClient(props: {
  notices: Notice[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState<Notice[]>(
    [...props.notices].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const statusClass = useMemo(() => {
    if (status === "success") return "border-primary/40 bg-primary/10 text-primary";
    if (status === "error") return "border-accent/40 bg-accent/10 text-accent";
    if (status === "saving") return "border-ink/10 bg-surface-raised/80 text-ink-soft";
    return "border-ink/10 bg-surface-raised/60 text-ink-soft";
  }, [status]);

  const statusText = useMemo(() => {
    if (message) return message;
    if (props.canEdit) return "新規作成/編集/削除ができます。";
    return null;
  }, [message, props.canEdit]);

  async function createNotice() {
    setStatus("saving");
    setMessage(null);
    setTraceId(null);
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newTitle, body: newBody }),
      });
      const data = await res.json().catch(() => ({}));
      const responseTraceId = res.headers.get("X-Trace-Id");
      setTraceId(data?.traceId || responseTraceId);

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message || "保存に失敗しました。");
        return;
      }

      const created: Notice = {
        id: String(data?.id ?? ""),
        title: String(data?.title ?? ""),
        body: String(data?.body ?? ""),
        updatedAt: String(data?.updatedAt ?? ""),
      };
      setItems((prev) => [created, ...prev].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
      setNewTitle("");
      setNewBody("");
      setCreateOpen(false);
      setStatus("success");
      setMessage("保存しました。");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました。ネットワークを確認してください。");
    }
  }

  async function updateNotice(id: string) {
    setStatus("saving");
    setMessage(null);
    setTraceId(null);
    try {
      const res = await fetch(`/api/notices/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      const data = await res.json().catch(() => ({}));
      const responseTraceId = res.headers.get("X-Trace-Id");
      setTraceId(data?.traceId || responseTraceId);

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message || "保存に失敗しました。");
        return;
      }

      const updated: Notice = {
        id: String(data?.id ?? id),
        title: String(data?.title ?? ""),
        body: String(data?.body ?? ""),
        updatedAt: String(data?.updatedAt ?? ""),
      };
      setItems((prev) =>
        prev
          .map((n) => (n.id === id ? updated : n))
          .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      );
      setEditingId(null);
      setStatus("success");
      setMessage("保存しました。");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました。ネットワークを確認してください。");
    }
  }

  async function removeNotice(id: string) {
    if (!confirm("このお知らせを削除しますか？")) return;
    setStatus("saving");
    setMessage(null);
    setTraceId(null);
    try {
      const res = await fetch(`/api/notices/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      const responseTraceId = res.headers.get("X-Trace-Id");
      setTraceId(data?.traceId || responseTraceId);

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message || "削除に失敗しました。");
        return;
      }

      setItems((prev) => prev.filter((n) => n.id !== id));
      if (editingId === id) setEditingId(null);
      setStatus("success");
      setMessage("削除しました。");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました。ネットワークを確認してください。");
    }
  }

  return (
    <div className="mx-auto max-w-screen-lg space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Home</p>
        <h1 className="text-2xl font-semibold">ホーム</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <PushSubscribeCard />
      </div>

      <Card
        title="お知らせ"
        actions={
          props.canEdit ? (
            <Button
              variant="secondary"
              className="h-9 rounded-xl"
              type="button"
              onClick={() => {
                setCreateOpen((v) => !v);
                setStatus("idle");
                setMessage(null);
                setTraceId(null);
              }}
            >
              {createOpen ? "新規作成を閉じる" : "新規作成"}
            </Button>
          ) : null
        }
        className="border border-ink/10 bg-surface/90 shadow-panel"
      >
        <div className="space-y-3">
          {props.canEdit && createOpen ? (
            <div className="rounded-xl border border-ink/10 bg-surface-raised/40 p-3">
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm text-ink">
                  <span className="font-medium">タイトル</span>
                  <input
                    className="h-10 rounded-xl border border-ink/10 bg-secondary px-3 text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例: メンテナンス予定"
                  />
                </label>
                <label className="grid gap-1 text-sm text-ink">
                  <span className="font-medium">本文</span>
                  <textarea
                    className="min-h-[140px] w-full rounded-xl border border-ink/10 bg-secondary px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    placeholder={"例:\n1/10 02:00-03:00 メンテナンス予定（ログイン不可）\n"}
                  />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    className="h-10 rounded-xl"
                    type="button"
                    onClick={() => {
                      setCreateOpen(false);
                      setNewTitle("");
                      setNewBody("");
                    }}
                  >
                    キャンセル
                  </Button>
                  <Button
                    className="h-10 rounded-xl"
                    type="button"
                    onClick={createNotice}
                    disabled={status === "saving"}
                  >
                    {status === "saving" ? "保存中..." : "登録"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-ink-soft">まだお知らせはありません。</p>
            ) : (
              items.map((n) => {
                const editing = editingId === n.id;
                return (
                  <div
                    key={n.id}
                    className="rounded-xl border border-ink/10 bg-surface-raised/40 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">{n.title}</div>
                        <div className="text-xs text-ink-soft">更新: {n.updatedAt}</div>
                      </div>
                      {props.canEdit ? (
                        <div className="flex items-center gap-2">
                          {editing ? (
                            <>
                              <Button
                                variant="secondary"
                                className="h-9 rounded-xl"
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditTitle("");
                                  setEditBody("");
                                }}
                              >
                                キャンセル
                              </Button>
                              <Button
                                className="h-9 rounded-xl"
                                type="button"
                                onClick={() => updateNotice(n.id)}
                                disabled={status === "saving"}
                              >
                                {status === "saving" ? "保存中..." : "保存"}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                className="h-9 rounded-xl"
                                type="button"
                                onClick={() => {
                                  setEditingId(n.id);
                                  setEditTitle(n.title);
                                  setEditBody(n.body);
                                  setStatus("idle");
                                  setMessage(null);
                                  setTraceId(null);
                                }}
                              >
                                編集
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-9 rounded-xl"
                                type="button"
                                onClick={() => removeNotice(n.id)}
                                disabled={status === "saving"}
                              >
                                削除
                              </Button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      {editing ? (
                        <div className="grid gap-3">
                          <label className="grid gap-1 text-sm text-ink">
                            <span className="font-medium">タイトル</span>
                            <input
                              className="h-10 rounded-xl border border-ink/10 bg-secondary px-3 text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                            />
                          </label>
                          <label className="grid gap-1 text-sm text-ink">
                            <span className="font-medium">本文</span>
                            <textarea
                              className="min-h-[140px] w-full rounded-xl border border-ink/10 bg-secondary px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                            />
                          </label>
                        </div>
                      ) : n.body.trim() ? (
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                          {n.body}
                        </pre>
                      ) : (
                        <p className="text-sm text-ink-soft">（本文なし）</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {statusText || traceId ? (
            <div className={`rounded-xl border px-3 py-2 text-sm ${statusClass}`}>
              {statusText}
              {traceId ? (
                <span className="mt-1 block text-xs text-ink-soft">
                  トレースID: {traceId}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

