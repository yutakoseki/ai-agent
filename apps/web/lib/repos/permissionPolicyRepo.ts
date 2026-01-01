import type {
  PermissionKey,
  PermissionPolicy,
  PermissionPolicyResponse,
  PermissionScope,
} from "@shared/permissions";
import type { UserRole } from "@shared/auth";
import { getItem, putItem, updateItem } from "@db/tenant-client";

type PermissionPolicyItem = {
  PK: `TENANT#${string}`;
  SK: "POLICY#PERMISSIONS";
  version: number;
  policy: PermissionPolicy;
  updatedAt: string;
  updatedByUserId: string;
};

const SK = "POLICY#PERMISSIONS" as const;
const VERSION = 1;

const managedRoles: Array<Exclude<UserRole, "Admin">> = ["Manager", "Member"];

const knownKeys: PermissionKey[] = [
  "tenant.list",
  "tenant.create",
  "tenant.read",
  "tenant.update",
  "tenant.delete",
  "tenantApplication.view",
  "tenantApplication.review",
  "tenantApplication.edit",
];

function buildDefaultPolicy(): PermissionPolicy {
  return {
    Manager: {
      "tenant.list": "none",
      "tenant.create": "none",
      "tenant.read": "own",
      "tenant.update": "none",
      "tenant.delete": "none",
      "tenantApplication.view": "none",
      "tenantApplication.review": "none",
      "tenantApplication.edit": "none",
    },
    Member: {
      "tenant.list": "none",
      "tenant.create": "none",
      "tenant.read": "own",
      "tenant.update": "none",
      "tenant.delete": "none",
      "tenantApplication.view": "none",
      "tenantApplication.review": "none",
      "tenantApplication.edit": "none",
    },
  };
}

function isScope(v: unknown): v is PermissionScope {
  return v === "none" || v === "own" || v === "global";
}

function sanitizePolicy(policy: PermissionPolicy): PermissionPolicy {
  const base = buildDefaultPolicy();
  const out: PermissionPolicy = { Manager: {}, Member: {} };

  for (const role of managedRoles) {
    const src = policy?.[role] ?? {};
    for (const key of knownKeys) {
      const value = (src as any)[key];
      if (isScope(value)) {
        (out[role] as any)[key] = value;
      } else {
        (out[role] as any)[key] = (base[role] as any)[key];
      }
    }
  }

  // ガード: Manager/Member に global を許さない（横断権限化を防ぐ）
  for (const role of managedRoles) {
    for (const key of knownKeys) {
      if ((out[role] as any)[key] === "global") {
        (out[role] as any)[key] = "own";
      }
    }
  }

  // ガード: own が意味を持たない権限は own を none に丸める
  const ownNotSupported: PermissionKey[] = [
    "tenant.create",
    "tenant.update",
    "tenant.delete",
    "tenantApplication.view",
    "tenantApplication.review",
    "tenantApplication.edit",
  ];
  for (const role of managedRoles) {
    for (const key of ownNotSupported) {
      if ((out[role] as any)[key] === "own") {
        (out[role] as any)[key] = "none";
      }
    }
  }

  return out;
}

export async function getPermissionPolicy(
  tenantId: string
): Promise<PermissionPolicyResponse> {
  const item = await getItem<PermissionPolicyItem>(tenantId, SK);
  const base = buildDefaultPolicy();

  if (!item) {
    return {
      tenantId,
      policy: base,
      version: VERSION,
    };
  }

  return {
    tenantId,
    policy: sanitizePolicy(item.policy ?? base),
    updatedAt: item.updatedAt,
    updatedByUserId: item.updatedByUserId,
    version: item.version ?? VERSION,
  };
}

export async function setPermissionPolicy(params: {
  tenantId: string;
  actorUserId: string;
  policy: PermissionPolicy;
}): Promise<PermissionPolicyResponse> {
  const now = new Date().toISOString();
  const policy = sanitizePolicy(params.policy);

  // まずは「未作成なら作成」を試し、既にあれば update で上書きする
  try {
    await putItem(params.tenantId, SK, {
      version: VERSION,
      policy,
      updatedAt: now,
      updatedByUserId: params.actorUserId,
    });
  } catch (e: any) {
    // ConditionalCheckFailedException など（既に存在）
    await updateItem(
      params.tenantId,
      SK,
      "SET #version = :version, #policy = :policy, updatedAt = :updatedAt, updatedByUserId = :updatedByUserId",
      {
        ":version": VERSION,
        ":policy": policy,
        ":updatedAt": now,
        ":updatedByUserId": params.actorUserId,
      },
      { "#policy": "policy", "#version": "version" }
    );
  }

  return {
    tenantId: params.tenantId,
    policy,
    updatedAt: now,
    updatedByUserId: params.actorUserId,
    version: VERSION,
  };
}


