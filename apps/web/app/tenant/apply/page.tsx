'use client';

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Status = "idle" | "loading" | "success" | "error";

type PlanType = "Basic" | "Pro" | "Enterprise";

export default function TenantApplyPage() {
  const [tenantName, setTenantName] = useState("");
  const [plan, setPlan] = useState<PlanType>("Pro");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const isBusy = status === "loading";
  const isDisabled = isBusy || !tenantName || !plan || !contactEmail;

  const statusClass = useMemo(() => {
    if (status === "success") {
      return "border-primary/40 bg-primary/10 text-primary";
    }
    if (status === "error") {
      return "border-accent/40 bg-accent/10 text-accent";
    }
    return "border-ink/10 bg-surface-raised/80 text-ink-soft";
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);
    setTraceId(null);

    try {
      const response = await fetch("/api/tenant-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName,
          plan,
          contactEmail,
          contactName: contactName || undefined,
          note: note || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const responseTraceId = response.headers.get("X-Trace-Id");
      setTraceId(data?.traceId || responseTraceId);

      if (!response.ok) {
        setStatus("error");
        setMessage(data?.message || "申請に失敗しました。入力内容を確認してください。");
        return;
      }

      setStatus("success");
      setMessage("申請を受け付けました。審査後に管理者が承認します。");
      setTenantName("");
      setContactEmail("");
      setContactName("");
      setNote("");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました。ネットワークを確認してください。");
    }
  }

  return (
    <main className="mx-auto max-w-screen-md px-4 py-10 text-ink">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
          Tenant Onboarding
        </p>
        <h1 className="text-2xl font-semibold">テナント申請</h1>
        <p className="text-sm text-ink-muted">
          新規テナントの作成依頼を送信します。管理者が承認後、利用を開始できます。
        </p>
      </header>

      <Card title="申請フォーム" className="border border-ink/10 bg-surface/90">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="テナント名（必須）"
            name="tenantName"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            placeholder="例: 株式会社サンプル"
            disabled={isBusy}
          />

          <label className="flex flex-col gap-1 text-sm text-ink">
            <span className="font-medium">プラン（必須）</span>
            <select
              className="h-10 rounded-md border border-surface bg-secondary px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary disabled:opacity-60 disabled:cursor-not-allowed"
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanType)}
              disabled={isBusy}
            >
              <option value="Basic">Basic</option>
              <option value="Pro">Pro</option>
              <option value="Enterprise">Enterprise</option>
            </select>
          </label>

          <Input
            label="連絡用メールアドレス（必須）"
            name="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="example@company.com"
            disabled={isBusy}
          />

          <Input
            label="担当者名（任意）"
            name="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="例: 山田 太郎"
            disabled={isBusy}
          />

          <label className="flex flex-col gap-1 text-sm text-ink">
            <span className="font-medium">備考（任意）</span>
            <textarea
              className="min-h-[96px] rounded-md border border-surface bg-secondary px-3 py-2 text-ink placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary disabled:opacity-60 disabled:cursor-not-allowed"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="利用目的、希望開始時期など"
              disabled={isBusy}
            />
          </label>

          <div className="flex items-center justify-end gap-3">
            <Button type="submit" disabled={isDisabled}>
              {isBusy ? "送信中..." : "申請を送信"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-4 min-h-[40px]">
        {message ? (
          <div className={`rounded-lg border px-4 py-3 text-sm ${statusClass}`}>
            <p>{message}</p>
            {traceId ? (
              <p className="mt-1 text-xs opacity-90">traceId: {traceId}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}


