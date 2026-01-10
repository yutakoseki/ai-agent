"use client";

import { useMemo, useState } from "react";
import type { MailCategory, Task, TaskStatus } from "@shared/mail";
import { Card } from "@/components/ui/Card";
import { useRouter } from "next/navigation";
import { formatFromForDisplay } from "@/lib/mail/from";

type Status = "idle" | "saving" | "error" | "success";

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "未対応",
  in_progress: "対応中",
  done: "完了",
  archived: "アーカイブ",
};

type TaskView = Omit<Task, "createdAt" | "updatedAt" | "dueAt"> & {
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
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

export function TasksClient(props: {
  tasks: TaskView[];
  accountEmailById: Record<string, string>;
  initialTaskVisibleCategories: MailCategory[];
}) {
  const router = useRouter();
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({
    action_required: props.initialTaskVisibleCategories.includes("action_required"),
    information: props.initialTaskVisibleCategories.includes("information"),
    sales: props.initialTaskVisibleCategories.includes("sales"),
    notification: props.initialTaskVisibleCategories.includes("notification"),
    billing_payment: props.initialTaskVisibleCategories.includes("billing_payment"),
    security: props.initialTaskVisibleCategories.includes("security"),
    uncategorized: false,
  });
  const [tasks, setTasks] = useState<TaskView[]>(
    [...props.tasks].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  );
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const statusClass = useMemo(() => {
    if (status === "success") return "border-primary/40 bg-primary/10 text-primary";
    if (status === "error") return "border-accent/40 bg-accent/10 text-accent";
    if (status === "saving") return "border-ink/10 bg-surface-raised/80 text-ink-soft";
    return "border-ink/10 bg-surface-raised/60 text-ink-soft";
  }, [status]);

  async function updateTask(id: string, next: Partial<TaskView>) {
    setStatus("saving");
    setMessage(null);
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        status: next.status,
        title: next.title,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setMessage(data?.message || "更新に失敗しました。");
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
    setStatus("success");
    setMessage("更新しました。");
  }

  return (
    <div className="mx-auto max-w-screen-lg space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Tasks</p>
        <h1 className="text-2xl font-semibold">要対応タスク</h1>
      </header>

      <Card
        title="タスク一覧"
        className="border border-ink/10 bg-surface/90 shadow-panel"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-soft">表示ラベル:</span>
            {[
              ["action_required", "要対応"],
              ["information", "情報"],
              ["sales", "営業"],
              ["notification", "自動通知"],
              ["billing_payment", "請求・支払い"],
              ["security", "セキュリティ"],
              ["uncategorized", "未分類"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="inline-flex cursor-pointer select-none items-center gap-1 rounded-full border border-ink/10 bg-secondary px-2 py-1 text-ink"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={Boolean(visibleCategories[key])}
                  onChange={(e) =>
                    setVisibleCategories((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span className="font-medium">{label}</span>
              </label>
            ))}
            <a
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl border border-ink/10 bg-surface-raised/60 text-ink hover:bg-surface-raised"
              href="/settings"
              aria-label="設定"
              title="設定"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
                />
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.5-2-3.5-2.4.7a8 8 0 0 0-1.7-1L15 6h-6l-.4 2.7a8 8 0 0 0-1.7 1L4.5 9 2.5 12.5l2 1.5a8 8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-.7a8 8 0 0 0 1.7 1L9 22h6l.4-2.7a8 8 0 0 0 1.7-1l2.4.7 2-3.5-2-1.5z"
                />
              </svg>
            </a>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-ink-soft">まだタスクはありません。</p>
          ) : (
            tasks
              .filter((task) => {
                const key = task.category ?? "uncategorized";
                return Boolean(visibleCategories[key]);
              })
              .map((task) => (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                className="rounded-xl border border-ink/10 bg-surface-raised/40 p-3 transition-colors hover:bg-surface-raised/60"
                onClick={() => router.push(`/tasks/${encodeURIComponent(task.id)}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/tasks/${encodeURIComponent(task.id)}`);
                  }
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{task.title}</div>
                    <div className="mt-1 text-xs text-ink-soft">
                      {(task.counterparty || task.from) ? (
                        <>
                          差出人:{" "}
                          <span className="font-medium text-ink">
                            {task.counterparty ?? formatFromForDisplay(task.from)}
                          </span>
                          <span className="mx-2 text-ink/20">|</span>
                        </>
                      ) : null}
                      宛先:{" "}
                      <span className="font-medium text-ink">
                        {task.accountId ? props.accountEmailById[task.accountId] ?? "（不明）" : "（不明）"}
                      </span>
                      <span className="mx-2 text-ink/20">|</span>
                      締切: <span className="font-medium text-ink">{formatDue(task.dueAt)}</span>
                      <span className="mx-2 text-ink/20">|</span>
                      ラベル:{" "}
                      <span className="font-medium text-ink">
                        {task.category
                          ? {
                              action_required: "要対応",
                              information: "情報",
                              sales: "営業",
                              notification: "自動通知",
                              billing_payment: "請求・支払い",
                              security: "セキュリティ",
                            }[task.category] ?? task.category
                          : "未分類"}
                      </span>
                    </div>
                    {task.summary ? (
                      <p className="mt-1 text-xs text-ink-soft">{task.summary}</p>
                    ) : null}
                  </div>
                  <select
                    className="h-9 rounded-xl border border-ink/10 bg-secondary px-3 text-xs text-ink"
                    value={task.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateTask(task.id, { status: e.target.value as TaskStatus })
                    }
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
                  <div className="text-xs font-semibold text-primary">次アクション</div>
                  <div className="mt-1 text-sm font-semibold text-ink">
                    {task.nextAction ? task.nextAction : "（未設定）"}
                  </div>
                </div>

                <div className="mt-2 text-xs text-ink-soft">更新: {formatDateTime(task.updatedAt)}</div>
              </div>
            ))
          )}
        </div>
      </Card>

      {message ? (
        <div className={`rounded-xl border px-3 py-2 text-sm ${statusClass}`}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
