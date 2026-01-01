'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TenantApplication } from "@shared/tenantApplication";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Props = {
  initialApplications: TenantApplication[];
};

export function TenantApplicationManagerClient({ initialApplications }: Props) {
  const [applications, setApplications] = useState(initialApplications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TenantApplication | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  const rows = useMemo(() => applications, [applications]);

  async function review(
    id: string,
    decision: "approve" | "reject",
    decisionNote?: string
  ) {
    setBusyId(id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/tenant-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ decision, decisionNote }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message ?? "更新に失敗しました");
        return;
      }

      setApplications((prev) => prev.map((a) => (a.id === id ? data : a)));
      setMessage(decision === "approve" ? "承認しました" : "却下しました");
    } catch (e) {
      console.error(e);
      setError("通信に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  function openRejectModal(application: TenantApplication) {
    setRejectTarget(application);
    setRejectReason("");
    setMessage(null);
    setError(null);
  }

  function closeRejectModal() {
    setRejectTarget(null);
    setRejectReason("");
  }

  async function submitReject() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError("却下理由を入力してください");
      return;
    }
    await review(rejectTarget.id, "reject", reason);
    closeRejectModal();
  }

  return (
    <section className="space-y-4">
      <Card
        className="overflow-hidden border border-ink/10 bg-surface/90 shadow-panel"
        title="申請一覧"
        actions={
          <span className="text-xs text-ink-soft">total: {rows.length}</span>
        }
        padded={false}
      >
        <div className="divide-y divide-ink/10">
          <div className="grid grid-cols-[1.4fr_0.8fr_1.4fr_0.9fr_1.2fr] items-center bg-secondary/40 px-4 py-3 text-sm font-medium text-ink-soft">
            <span>テナント名</span>
            <span>プラン</span>
            <span>連絡先</span>
            <span>状態</span>
            <span className="text-right">操作</span>
          </div>

          {rows.map((a) => {
            const isPending = a.status === "Pending";
            const busy = busyId === a.id;
            return (
              <div
                key={a.id}
                className="grid grid-cols-[1.4fr_0.8fr_1.4fr_0.9fr_1.2fr] items-center px-4 py-3 text-sm text-ink"
              >
                <Link
                  href={`/admin/tenant-applications/${a.id}`}
                  className="col-span-4 grid grid-cols-[1.4fr_0.8fr_1.4fr_0.9fr] items-center gap-0 rounded-xl px-2 py-2 hover:bg-surface-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title="詳細を開く"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.tenantName}</div>
                    <div className="truncate text-xs text-ink-soft">
                      {a.contactName ? `${a.contactName} / ` : ""}
                      {a.contactEmail}
                    </div>
                  </div>

                  <div className="text-ink-soft">{a.plan}</div>
                  <div className="truncate text-ink-soft">{a.contactEmail}</div>
                  <div className="text-ink-soft">
                    {a.status}
                    {a.createdTenantId ? (
                      <div className="mt-0.5 truncate text-[11px] text-ink-soft">
                        tenant: <span className="font-mono">{a.createdTenantId}</span>
                      </div>
                    ) : null}
                  </div>
                </Link>

                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!isPending || busy}
                    onClick={() => review(a.id, "approve")}
                  >
                    {busy ? "処理中..." : "承認"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!isPending || busy}
                    onClick={() => openRejectModal(a)}
                  >
                    却下
                  </Button>
                </div>
              </div>
            );
          })}

          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-soft">
              申請はまだありません
            </div>
          ) : null}
        </div>
      </Card>

      <div className="min-h-[28px] text-sm">
        {message ? <p className="text-primary">{message}</p> : null}
        {error ? <p className="text-accent">{error}</p> : null}
      </div>

      {rejectTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="却下理由の入力"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeRejectModal();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeRejectModal();
          }}
          tabIndex={-1}
        >
          <div className="w-full max-w-lg rounded-2xl border border-ink/10 bg-surface/95 p-5 shadow-panel">
            <div className="mb-3">
              <p className="text-sm font-semibold text-ink">却下理由を入力</p>
              <p className="mt-1 text-sm text-ink-muted">
                対象: <span className="font-medium">{rejectTarget.tenantName}</span>
              </p>
            </div>

            <label className="flex flex-col gap-1 text-sm text-ink">
              <span className="font-medium">却下理由（必須）</span>
              <textarea
                className="min-h-[120px] rounded-xl border border-ink/10 bg-surface-raised/80 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="例: 要件が不足しています（会社情報/利用目的/担当者情報など）"
                disabled={busyId === rejectTarget.id}
              />
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeRejectModal}
                disabled={busyId === rejectTarget.id}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={submitReject}
                disabled={busyId === rejectTarget.id}
              >
                {busyId === rejectTarget.id ? "送信中..." : "却下する"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}


