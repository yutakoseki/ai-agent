"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type AccountView = {
  id: string;
  provider?: string;
  email?: string;
  status?: string;
  monitoringEnabled: boolean;
  pushEnabled: boolean;
  updatedAt?: string;
};

type Status = "idle" | "loading" | "saving" | "success" | "error";

export function EmailAccountsCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountView[]>([]);

  const statusClass = useMemo(() => {
    if (status === "success") return "border-primary/40 bg-primary/10 text-primary";
    if (status === "error") return "border-accent/40 bg-accent/10 text-accent";
    if (status === "saving") return "border-ink/10 bg-surface-raised/80 text-ink-soft";
    if (status === "loading") return "border-ink/10 bg-surface-raised/80 text-ink-soft";
    return "border-ink/10 bg-surface-raised/60 text-ink-soft";
  }, [status]);

  async function load() {
    setStatus("loading");
    setMessage(null);
    setTraceId(null);
    try {
      const res = await fetch("/api/email-accounts", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      const responseTraceId = res.headers.get("X-Trace-Id");
      setTraceId(data?.traceId || responseTraceId);
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message || "取得に失敗しました。");
        return;
      }
      const raw = Array.isArray(data?.accounts) ? (data.accounts as any[]) : [];
      const normalized: AccountView[] = raw
        .filter((v) => v && typeof v === "object")
        .map((v) => ({
          id: String(v.id ?? ""),
          provider: v.provider === undefined ? undefined : String(v.provider),
          email: v.email === undefined ? undefined : String(v.email),
          status: v.status === undefined ? undefined : String(v.status),
          monitoringEnabled: v.monitoringEnabled === undefined ? true : Boolean(v.monitoringEnabled),
          pushEnabled: v.pushEnabled === undefined ? true : Boolean(v.pushEnabled),
          updatedAt: v.updatedAt === undefined ? undefined : String(v.updatedAt),
        }))
        .filter((v) => Boolean(v.id));
      setAccounts(normalized);
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました。ネットワークを確認してください。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function patchSub(accountId: string, patch: Partial<Pick<AccountView, "monitoringEnabled" | "pushEnabled">>) {
    setStatus("saving");
    setMessage(null);
    setTraceId(null);
    const res = await fetch(`/api/email-accounts/${encodeURIComponent(accountId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    const responseTraceId = res.headers.get("X-Trace-Id");
    setTraceId(data?.traceId || responseTraceId);
    if (!res.ok) {
      setStatus("error");
      setMessage(data?.message || "更新に失敗しました。");
      return;
    }
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId
          ? {
              ...a,
              monitoringEnabled:
                data?.monitoringEnabled === undefined ? a.monitoringEnabled : Boolean(data.monitoringEnabled),
              pushEnabled: data?.pushEnabled === undefined ? a.pushEnabled : Boolean(data.pushEnabled),
              updatedAt: String(data?.updatedAt ?? a.updatedAt),
            }
          : a
      )
    );
    setStatus("success");
    setMessage("更新しました。");
  }

  async function syncNow(accountId: string) {
    setStatus("saving");
    setMessage(null);
    setTraceId(null);
    const res = await fetch("/api/sync/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      // 手動同期は「直近の差分」を軽く確認できるように上限を小さめにする
      body: JSON.stringify({ accountId, maxMessages: 10 }),
    });
    const data = await res.json().catch(() => ({}));
    const responseTraceId = res.headers.get("X-Trace-Id");
    setTraceId(data?.traceId || responseTraceId);
    if (!res.ok) {
      setStatus("error");
      setMessage(data?.message || "同期に失敗しました。");
      return;
    }
    const result = Array.isArray(data?.results)
      ? data.results.find((r: any) => String(r?.accountId ?? "") === accountId)
      : null;
    const processed = result?.processed ?? 0;
    const skipped = result?.skipped ?? 0;
    setStatus("success");
    setMessage(`同期しました（処理: ${processed} / スキップ: ${skipped}）。`);
    // ついでに最新状態を再取得
    void load();
  }

  return (
    <Card
      title="受信箱（接続済み）"
      actions={
        <Button
          variant="secondary"
          className="h-9 rounded-xl"
          type="button"
          onClick={() => load()}
          disabled={status === "loading" || status === "saving"}
        >
          {status === "loading" ? "更新中..." : "更新"}
        </Button>
      }
      className="border border-ink/10 bg-surface/90 shadow-panel"
    >
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <p className="text-sm text-ink-soft">まだ受信箱は接続されていません。</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-surface-raised/40 p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">{acc.email ?? "（不明なメールアドレス）"}</div>
                  <div className="text-xs text-ink-soft">
                    {(acc.provider ? acc.provider.toUpperCase() : "UNKNOWN")} / {acc.status ?? "unknown"} / 更新:{" "}
                    {acc.updatedAt ?? "-"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={acc.monitoringEnabled}
                      onChange={(e) => patchSub(acc.id, { monitoringEnabled: e.target.checked })}
                      disabled={status === "saving" || status === "loading"}
                    />
                    監視（タスク化）
                  </label>
                  <label className="flex items-center gap-2 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={acc.pushEnabled}
                      onChange={(e) => patchSub(acc.id, { pushEnabled: e.target.checked })}
                      disabled={status === "saving" || status === "loading"}
                    />
                    通知（Push）
                  </label>
                  <Button
                    variant="secondary"
                    className="h-9 rounded-xl"
                    type="button"
                    onClick={() => syncNow(acc.id)}
                    disabled={status === "saving" || status === "loading"}
                  >
                    同期
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {message || traceId ? (
          <div className={`rounded-xl border px-3 py-2 text-sm ${statusClass}`}>
            {message}
            {traceId ? (
              <span className="mt-1 block text-xs text-ink-soft">トレースID: {traceId}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}


