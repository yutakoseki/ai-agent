'use client';

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { TenantApplication } from "@shared/tenantApplication";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Status = "idle" | "loading" | "success" | "error";

type Props = {
  initialApplication: TenantApplication;
};

export function TenantApplicationReviewClient({ initialApplication }: Props) {
  const [application, setApplication] = useState(initialApplication);
  const [decisionNote, setDecisionNote] = useState("");
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
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">テナント名</dt>
            <dd className="font-medium">{application.tenantName}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">プラン</dt>
            <dd>{application.plan}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">連絡先</dt>
            <dd>{application.contactEmail}</dd>
          </div>
          {application.contactName ? (
            <div className="grid gap-1">
              <dt className="text-xs text-ink-soft">担当者</dt>
              <dd>{application.contactName}</dd>
            </div>
          ) : null}
          {application.note ? (
            <div className="grid gap-1">
              <dt className="text-xs text-ink-soft">備考</dt>
              <dd className="whitespace-pre-wrap">{application.note}</dd>
            </div>
          ) : null}
        </dl>
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


