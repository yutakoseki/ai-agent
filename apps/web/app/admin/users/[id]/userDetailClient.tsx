'use client';

import { useMemo, useState } from "react";
import type { UserRole } from "@shared/auth";
import type { User } from "@shared/user";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Status = "idle" | "loading" | "success" | "error";

type Props = {
  initialUser: User;
  session: { userId: string; role: UserRole; tenantId: string };
};

const allRoles: UserRole[] = ["Admin", "Manager", "Member"];

export function UserDetailClient({ initialUser, session }: Props) {
  const [user, setUser] = useState(initialUser);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const [editName, setEditName] = useState(user.name ?? "");
  const [editEmail, setEditEmail] = useState(user.email);
  const [editRole, setEditRole] = useState<UserRole>(user.role);
  const [moveTenantId, setMoveTenantId] = useState("");

  const isBusy = status === "loading";
  const isAdmin = session.role === "Admin";
  const isSelf = session.userId === user.id;

  const canEditRole = isAdmin; // role変更はAdminのみ
  const canEditProfile = isAdmin || isSelf; // name/email は Admin か本人のみ（必要ならManagerも拡張）

  const statusClass = useMemo(() => {
    if (status === "success") return "border-primary/40 bg-primary/10 text-primary";
    if (status === "error") return "border-accent/40 bg-accent/10 text-accent";
    return "border-ink/10 bg-surface-raised/80 text-ink-soft";
  }, [status]);

  const hasChanges =
    editName !== (user.name ?? "") || editEmail !== user.email || editRole !== user.role;

  async function save() {
    setStatus("loading");
    setMessage(null);
    setTraceId(null);

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: canEditProfile ? editName : undefined,
          email: canEditProfile ? editEmail : undefined,
          role: canEditRole ? editRole : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setTraceId(data?.traceId || res.headers.get("X-Trace-Id"));

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message ?? "更新に失敗しました");
        return;
      }

      setUser(data);
      setEditName(data.name ?? "");
      setEditEmail(data.email);
      setEditRole(data.role);
      setStatus("success");
      setMessage("更新しました");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました");
    }
  }

  async function moveTenant() {
    setStatus("loading");
    setMessage(null);
    setTraceId(null);

    try {
      const res = await fetch(`/api/users/${user.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId: moveTenantId }),
      });

      const data = await res.json().catch(() => ({}));
      setTraceId(data?.traceId || res.headers.get("X-Trace-Id"));

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message ?? "テナント移動に失敗しました");
        return;
      }

      setUser(data);
      setEditName(data.name ?? "");
      setEditEmail(data.email);
      setEditRole(data.role);
      setMoveTenantId("");
      setStatus("success");
      setMessage("テナントを移動しました");
    } catch {
      setStatus("error");
      setMessage("通信に失敗しました");
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card title="ユーザー情報" className="border border-ink/10 bg-surface/90">
        <dl className="grid gap-3 text-sm text-ink">
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">ユーザーID</dt>
            <dd className="font-mono text-xs">{user.id}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">テナントID</dt>
            <dd className="font-mono text-xs">{user.tenantId}</dd>
          </div>
        </dl>

        <div className="mt-4 grid gap-3">
          <Input
            label="名前"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            disabled={isBusy || !canEditProfile}
            placeholder="（未設定）"
          />
          <Input
            label="メール"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            disabled={isBusy || !canEditProfile}
          />

          <label className="flex flex-col gap-1 text-sm text-ink">
            <span className="font-medium">役割</span>
            <select
              className="h-10 rounded-md border border-surface bg-secondary px-3 text-ink disabled:opacity-60 disabled:cursor-not-allowed"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              disabled={isBusy || !canEditRole}
            >
              {allRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {!canEditRole ? (
              <span className="text-xs text-ink-soft">役割変更はAdminのみ可能です。</span>
            ) : null}
          </label>
        </div>
      </Card>

      <Card title="操作" className="border border-ink/10 bg-surface/90">
        <div className="space-y-3">
          <Button
            type="button"
            variant="primary"
            className="w-full"
            disabled={!hasChanges || isBusy || (!canEditRole && !canEditProfile)}
            onClick={save}
          >
            {isBusy ? "更新中..." : "更新"}
          </Button>

          <div className={`rounded-lg border px-4 py-3 text-sm ${statusClass}`}>
            <p>{message ?? "変更して「更新」を押してください。"}</p>
            {traceId ? <p className="mt-1 text-xs opacity-90">traceId: {traceId}</p> : null}
          </div>
        </div>
      </Card>

      {isAdmin ? (
        <Card title="テナント移動（Admin）" className="border border-ink/10 bg-surface/90 lg:col-span-2">
          <div className="grid gap-3">
            <p className="text-sm text-ink-muted">
              ユーザーを別テナントに移動します（DB上で作り直し＋旧データ削除）。
            </p>
            <Input
              label="移行先テナントID"
              value={moveTenantId}
              onChange={(e) => setMoveTenantId(e.target.value)}
              disabled={isBusy}
              placeholder="tenant-xxxx"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={isBusy || !moveTenantId.trim() || moveTenantId.trim() === user.tenantId}
                onClick={moveTenant}
              >
                {isBusy ? "移動中..." : "移動"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </section>
  );
}


