'use client';

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { TenantApplication } from "@shared/tenantApplication";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Status = "idle" | "loading" | "success" | "error";
type PlanType = "Basic" | "Pro" | "Enterprise";

type Props = {
  initialApplication: TenantApplication;
};

export function TenantApplicationReviewClient({ initialApplication }: Props) {
  const [application, setApplication] = useState(initialApplication);
  const [decisionNote, setDecisionNote] = useState("");
  const [editTenantName, setEditTenantName] = useState(initialApplication.tenantName);
  const [editPlan, setEditPlan] = useState<PlanType>(initialApplication.plan);
  const [editContactEmail, setEditContactEmail] = useState(initialApplication.contactEmail);
  const [editContactName, setEditContactName] = useState(initialApplication.contactName ?? "");
  const [editNote, setEditNote] = useState(initialApplication.note ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const isBusy = status === "loading";
  const isPending = application.status === "Pending";

  const statusClass = useMemo(() => {
    if (status === "success") {
      return "border-primary/40 bg-primary/10 text-primary";
    }
    if (status === "error") {
      return "border-accent/40 bg-accent/10 text-accent";
    }
    return "border-ink/10 bg-surface-raised/80 text-ink-soft";
  }, [status]);

  async function submit(decision: "approve" | "reject") {
    setStatus("loading");
    setMessage(null);
    setTraceId(null);

    try {
      const res = await fetch(`/api/tenant-applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          decision,
          decisionNote: decisionNote || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setTraceId(data?.traceId || res.headers.get("X-Trace-Id"));

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message ?? "更新に失敗しました");
        return;
      }

      setApplication(data);
      setStatus("success");
      setMessage(decision === "approve" ? "承認しました" : "却下しました");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました");
    }
  }

  async function saveEdits() {
    setStatus("loading");
    setMessage(null);
    setTraceId(null);

    try {
      const res = await fetch(`/api/tenant-applications/${application.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenantName: editTenantName,
          plan: editPlan,
          contactEmail: editContactEmail,
          contactName: editContactName,
          note: editNote,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setTraceId(data?.traceId || res.headers.get("X-Trace-Id"));

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message ?? "更新に失敗しました");
        return;
      }

      setApplication(data);
      // 反映後に編集フォームも同期
      setEditTenantName(data.tenantName);
      setEditPlan(data.plan);
      setEditContactEmail(data.contactEmail);
      setEditContactName(data.contactName ?? "");
      setEditNote(data.note ?? "");

      setStatus("success");
      setMessage("申請内容を更新しました");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました");
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card title="申請内容" className="border border-ink/10 bg-surface/90">
        <dl className="grid gap-3 text-sm text-ink">
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">申請ID</dt>
            <dd className="font-mono text-xs">{application.id}</dd>
          </div>
        </dl>

        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border border-ink/10 bg-surface-raised/60 p-4">
            <p className="text-sm font-semibold text-ink">申請内容の編集</p>
            <p className="mt-1 text-sm text-ink-muted">
              Pending の間のみ編集できます。
            </p>

            <div className="mt-3 grid gap-3">
              <label className="flex flex-col gap-1 text-sm text-ink">
                <span className="font-medium">テナント名</span>
                <input
                  className="h-10 rounded-xl border border-ink/10 bg-surface-raised/80 px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                  value={editTenantName}
                  onChange={(e) => setEditTenantName(e.target.value)}
                  disabled={isBusy || !isPending}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-ink">
                <span className="font-medium">プラン</span>
                <select
                  className="h-10 rounded-xl border border-ink/10 bg-surface-raised/80 px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value as PlanType)}
                  disabled={isBusy || !isPending}
                >
                  <option value="Basic">Basic</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-ink">
                <span className="font-medium">連絡先メール</span>
                <input
                  className="h-10 rounded-xl border border-ink/10 bg-surface-raised/80 px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                  value={editContactEmail}
                  onChange={(e) => setEditContactEmail(e.target.value)}
                  disabled={isBusy || !isPending}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-ink">
                <span className="font-medium">担当者（任意）</span>
                <input
                  className="h-10 rounded-xl border border-ink/10 bg-surface-raised/80 px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                  value={editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
                  disabled={isBusy || !isPending}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-ink">
                <span className="font-medium">備考（任意）</span>
                <textarea
                  className="min-h-[96px] rounded-xl border border-ink/10 bg-surface-raised/80 px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  disabled={isBusy || !isPending}
                />
              </label>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={!isPending || isBusy}
                onClick={saveEdits}
              >
                {isBusy ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="承認/却下"
        className="border border-ink/10 bg-surface/90"
        actions={
          <span className="text-xs text-ink-soft">status: {application.status}</span>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm text-ink">
            <span className="font-medium">コメント（任意）</span>
            <textarea
              className="min-h-[96px] rounded-md border border-surface bg-secondary px-3 py-2 text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary disabled:opacity-60 disabled:cursor-not-allowed"
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="承認/却下理由、次アクションなど"
              disabled={isBusy || !isPending}
            />
          </label>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              className="w-full"
              disabled={!isPending || isBusy}
              onClick={() => submit("approve")}
            >
              {isBusy ? "処理中..." : "承認"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!isPending || isBusy}
              onClick={() => submit("reject")}
            >
              却下
            </Button>
          </div>

          {application.createdTenantId ? (
            <p className="text-xs text-ink-soft">
              作成テナントID: <span className="font-mono">{application.createdTenantId}</span>
            </p>
          ) : null}

          <div className={`rounded-lg border px-4 py-3 text-sm ${statusClass}`}>
            <p>{message ?? (isPending ? "承認/却下を選択してください。" : "処理済みです。")}</p>
            {traceId ? <p className="mt-1 text-xs opacity-90">traceId: {traceId}</p> : null}
          </div>
        </form>
      </Card>
    </section>
  );
}


