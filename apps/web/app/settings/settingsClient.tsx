"use client";

import { useMemo, useState } from "react";
import type { MailCategory } from "@shared/mail";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const LABELS: Record<MailCategory, string> = {
  action_required: "要対応",
  information: "情報",
  sales: "営業",
  notification: "自動通知",
  billing_payment: "請求・支払い",
  security: "セキュリティ",
};

type Status = "idle" | "saving" | "success" | "error";

export function SettingsClient(props: {
  initialTaskVisibleCategories: MailCategory[];
}) {
  const [selected, setSelected] = useState<Record<MailCategory, boolean>>(() => {
    const init = new Set(props.initialTaskVisibleCategories);
    return {
      action_required: init.has("action_required"),
      information: init.has("information"),
      sales: init.has("sales"),
      notification: init.has("notification"),
      billing_payment: init.has("billing_payment"),
      security: init.has("security"),
    };
  });
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const chosen = useMemo(
    () => (Object.keys(selected) as MailCategory[]).filter((k) => selected[k]),
    [selected]
  );

  async function save() {
    setStatus("saving");
    setMessage(null);
    if (chosen.length === 0) {
      setStatus("error");
      setMessage("少なくとも1つのラベルを選択してください。");
      return;
    }

    const res = await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ taskVisibleCategories: chosen }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setMessage(data?.message || "保存に失敗しました。");
      return;
    }
    setStatus("success");
    setMessage("保存しました。/tasks の表示に反映されます。");
  }

  return (
    <div className="mx-auto max-w-screen-lg space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Settings</p>
        <h1 className="text-2xl font-semibold">設定</h1>
      </header>

      <Card title="タスク一覧に表示するラベル" className="border border-ink/10 bg-surface/90 shadow-panel">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            {(Object.keys(LABELS) as MailCategory[]).map((k) => (
              <label
                key={k}
                className="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl border border-ink/10 bg-secondary px-3 py-2 text-ink"
              >
                <input
                  type="checkbox"
                  checked={selected[k]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [k]: e.target.checked }))}
                />
                <span className="font-medium">{LABELS[k]}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              className="h-10 rounded-xl"
              type="button"
              onClick={save}
              disabled={status === "saving"}
            >
              {status === "saving" ? "保存中..." : "保存"}
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

    </div>
  );
}
