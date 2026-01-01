/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useMemo, useState } from "react";
import type {
  PermissionKey,
  PermissionPolicy,
  PermissionPolicyResponse,
  PermissionScope,
} from "@shared/permissions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Row = {
  key: PermissionKey;
  label: string;
  note?: string;
  managerEditable?: boolean;
  memberEditable?: boolean;
};

const rows: Row[] = [
  {
    key: "tenant.list",
    label: "テナント一覧の閲覧",
    note: "GET /api/tenants",
    managerEditable: true,
    memberEditable: true,
  },
  {
    key: "tenant.read",
    label: "テナント詳細の閲覧",
    note: "GET /api/tenants/:id",
    managerEditable: true,
    memberEditable: true,
  },
  {
    key: "tenant.create",
    label: "テナント作成",
    note: "POST /api/tenants",
    managerEditable: false,
    memberEditable: false,
  },
  {
    key: "tenant.update",
    label: "テナント更新",
    note: "PATCH /api/tenants/:id",
    managerEditable: false,
    memberEditable: false,
  },
  {
    key: "tenant.delete",
    label: "テナント削除（無効化）",
    note: "DELETE /api/tenants/:id",
    managerEditable: false,
    memberEditable: false,
  },
  {
    key: "tenantApplication.view",
    label: "テナント申請一覧の閲覧",
    note: "/admin/tenant-applications",
    managerEditable: false,
    memberEditable: false,
  },
  {
    key: "tenantApplication.review",
    label: "テナント申請の承認/却下",
    note: "PATCH /api/tenant-applications/:id",
    managerEditable: false,
    memberEditable: false,
  },
  {
    key: "tenantApplication.edit",
    label: "テナント申請内容の編集（Pendingのみ）",
    note: "PUT /api/tenant-applications/:id",
    managerEditable: false,
    memberEditable: false,
  },
];

type Props = {
  canEdit: boolean;
};

function scopeToMark(
  scope: PermissionScope,
  { ownIsCircle }: { ownIsCircle: boolean }
): { text: string; className: string; help?: string } {
  if (scope === "global") return { text: "○", className: "text-primary" };
  if (scope === "own")
    return ownIsCircle
      ? { text: "○", className: "text-primary", help: "自テナントのみ" }
      : { text: "△", className: "text-ink", help: "自テナントのみ" };
  return { text: "—", className: "text-ink-soft" };
}

function getScope(
  policy: PermissionPolicy | null,
  role: "Manager" | "Member",
  key: PermissionKey
): PermissionScope {
  const v = policy?.[role]?.[key];
  if (v === "none" || v === "own" || v === "global") return v;
  // API側でデフォルトは補完されるので、UI側は none に倒す（ロード中など）
  return "none";
}

export function TenantPermissionsMatrix({ canEdit }: Props) {
  const [data, setData] = useState<PermissionPolicyResponse | null>(null);
  const [draft, setDraft] = useState<PermissionPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/permission-policy", {
          method: "GET",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message ?? "権限ポリシーの取得に失敗しました");
        if (!mounted) return;
        setData(json);
        setDraft(json.policy);
      } catch (e) {
        if (!mounted) return;
        console.error(e);
        setError("権限ポリシーの取得に失敗しました");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const hasChanges = useMemo(() => {
    if (!data || !draft) return false;
    return JSON.stringify(data.policy) !== JSON.stringify(draft);
  }, [data, draft]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/permission-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ policy: draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "保存に失敗しました");
        return;
      }
      setData(json);
      setDraft(json.policy);
      setMessage("権限を保存しました（APIに即時反映されます）");
    } catch (e) {
      console.error(e);
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  const current = draft ?? data?.policy ?? null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-ink">テナント管理の権限</h2>
        <p className="text-sm text-ink-muted">
          ○:可能 / △:自テナントのみ / —:不可。Adminは常に○です（ロックアウト防止）。
        </p>
      </div>

      <Card className="overflow-hidden border border-ink/10 bg-surface/90 shadow-panel" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-secondary/40 text-sm font-medium text-ink-soft">
                <th className="px-4 py-3 text-left">機能</th>
                <th className="px-4 py-3 text-left">備考</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-center">Manager</th>
                <th className="px-4 py-3 text-center">Member</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((row) => {
                const admin = scopeToMark("global", { ownIsCircle: false });
                const managerScope = getScope(current, "Manager", row.key);
                const memberScope = getScope(current, "Member", row.key);
                const manager = scopeToMark(managerScope, { ownIsCircle: row.key === "tenant.list" });
                const member = scopeToMark(memberScope, { ownIsCircle: row.key === "tenant.list" });
                return (
                  <tr key={row.key} className="text-sm text-ink">
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                      {row.note ?? "—"}
                    </td>
                    <td className={`px-4 py-3 text-center font-semibold ${admin.className}`}>
                      <span aria-label="Admin: ○">○</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canEdit && row.managerEditable ? (
                        <select
                          className="rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm"
                          value={managerScope}
                          disabled={busy}
                          onChange={(e) => {
                            const next = e.target.value as PermissionScope;
                            setDraft((prev) => ({
                              ...(prev ?? { Manager: {}, Member: {} }),
                              Manager: { ...(prev?.Manager ?? {}), [row.key]: next },
                            }));
                          }}
                        >
                          <option value="none">—</option>
                          <option value="own">○（自テナント）</option>
                        </select>
                      ) : (
                        <span className={`font-semibold ${manager.className}`} title={manager.help}>
                          {manager.text}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canEdit && row.memberEditable ? (
                        <select
                          className="rounded-lg border border-ink/15 bg-surface-raised/80 px-3 py-2 text-sm"
                          value={memberScope}
                          disabled={busy}
                          onChange={(e) => {
                            const next = e.target.value as PermissionScope;
                            setDraft((prev) => ({
                              ...(prev ?? { Manager: {}, Member: {} }),
                              Member: { ...(prev?.Member ?? {}), [row.key]: next },
                            }));
                          }}
                        >
                          <option value="none">—</option>
                          <option value="own">○（自テナント）</option>
                        </select>
                      ) : (
                        <span className={`font-semibold ${member.className}`} title={member.help}>
                          {member.text}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-ink-soft">
            {data?.updatedAt ? (
              <span>最終更新: {new Date(data.updatedAt).toLocaleString()}</span>
            ) : (
              <span>最終更新: 未設定（デフォルト）</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !hasChanges || !draft}
              onClick={() => {
                if (!data) return;
                setDraft(data.policy);
                setMessage(null);
                setError(null);
              }}
            >
              破棄
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={busy || !hasChanges || !draft}
              onClick={save}
            >
              {busy ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="min-h-[28px] text-sm">
        {message ? <p className="text-primary">{message}</p> : null}
        {error ? <p className="text-accent">{error}</p> : null}
      </div>
    </section>
  );
}


