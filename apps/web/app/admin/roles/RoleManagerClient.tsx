'use client';

import { useMemo, useState } from "react";
import type { UserRole } from "@shared/auth";
import type { User } from "@shared/user";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Props = {
  initialUsers: User[];
  selfId: string;
};

const editableRoles: UserRole[] = ["Manager", "Member"];

export function RoleManagerClient({ initialUsers, selfId }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [pendingRole, setPendingRole] = useState<Record<string, UserRole>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      users.map((user) => {
        const role = pendingRole[user.id] ?? user.role;
        const editable =
          editableRoles.includes(user.role) && editableRoles.includes(role);
        const isSelf = user.id === selfId;
        const disabled = !editable || isSelf;
        return { ...user, isSelf, role, disabled };
      }),
    [users, pendingRole, selfId]
  );

  async function updateRole(userId: string, nextRole: UserRole) {
    setBusyId(userId);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: nextRole }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message ?? "更新に失敗しました");
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: nextRole, updatedAt: new Date() } : u
        )
      );
      setPendingRole((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      setMessage("役割を更新しました");
    } catch (e) {
      console.error(e);
      setError("通信に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">権限管理</h2>
          <p className="text-sm text-ink-muted">
            Admin 専用。Manager / Member の役割を確認・変更できます。
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border border-ink/10 bg-surface/90 shadow-panel">
        <div className="divide-y divide-ink/10">
          <div className="grid grid-cols-[1.4fr_1.4fr_1fr_0.8fr] items-center bg-secondary/40 px-4 py-3 text-sm font-medium text-ink-soft">
            <span>名前</span>
            <span>メール</span>
            <span>役割</span>
            <span className="text-right">操作</span>
          </div>

          {rows.map((user) => (
            <div
              key={user.id}
              className="grid grid-cols-[1.4fr_1.4fr_1fr_0.8fr] items-center px-4 py-3 text-sm text-ink"
            >
              <div className="truncate">{user.name ?? "（未設定）"}</div>
              <div className="truncate text-ink-soft">{user.email}</div>

              <div className="flex items-center gap-2">
                <select
                  className="w-full rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-ink/5"
                  value={user.role}
                  onChange={(event) =>
                    setPendingRole((prev) => ({
                      ...prev,
                      [user.id]: event.target.value as UserRole,
                    }))
                  }
                  disabled={user.disabled || busyId === user.id}
                >
                  <option value={user.role}>{user.role}</option>
                  {editableRoles
                    .filter((r) => r !== user.role)
                    .map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                </select>
                {user.isSelf ? (
                  <span className="text-xs text-ink-soft">自分</span>
                ) : null}
                {user.role === "Admin" ? (
                  <span className="text-xs text-ink-soft">Admin固定</span>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={
                    user.disabled ||
                    busyId === user.id ||
                    (pendingRole[user.id] ?? user.role) === user.role
                  }
                  onClick={() =>
                    updateRole(user.id, pendingRole[user.id] ?? user.role)
                  }
                >
                  {busyId === user.id ? "更新中..." : "更新"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="min-h-[28px] text-sm">
        {message ? <p className="text-primary">{message}</p> : null}
        {error ? <p className="text-accent">{error}</p> : null}
      </div>
    </section>
  );
}

