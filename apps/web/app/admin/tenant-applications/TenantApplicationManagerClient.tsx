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

  const rows = useMemo(() => applications, [applications]);

  async function review(id: string, decision: "approve" | "reject") {
    setBusyId(id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/tenant-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ decision }),
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
                <div className="min-w-0">
                  <Link
                    href={`/admin/tenant-applications/${a.id}`}
                    className="truncate font-medium underline decoration-ink/20 underline-offset-4 hover:decoration-ink/40"
                  >
                    {a.tenantName}
                  </Link>
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
                    onClick={() => review(a.id, "reject")}
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
    </section>
  );
}


