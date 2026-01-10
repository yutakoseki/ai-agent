import { randomUUID } from "crypto";
import type {
  CreateTenantApplicationRequest,
  ReviewTenantApplicationDecision,
  TenantApplication,
  TenantApplicationStatus,
  UpdateTenantApplicationRequest,
} from "@shared/tenantApplication";
import { AppError } from "@shared/error";
import { getItem, putItem, queryGSI1, updateItem } from "@db/tables/tenant-applications";
import type { TenantApplicationItem } from "@db/types";

const SYSTEM_TENANT_ID = "system";
const SK_PREFIX = "TENANT_APPLICATION#";
const GSI1PK = "TENANT_APPLICATION";

export async function createTenantApplication(
  input: CreateTenantApplicationRequest
): Promise<TenantApplication> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const sk = `${SK_PREFIX}${id}`;

  await putItem(SYSTEM_TENANT_ID, sk, {
    tenantName: input.tenantName,
    plan: input.plan,
    contactEmail: input.contactEmail,
    contactName: input.contactName,
    note: input.note,
    status: "Pending" satisfies TenantApplicationStatus,
    createdAt: now,
    updatedAt: now,
    GSI1PK,
    GSI1SK: now,
  });

  return {
    id,
    tenantName: input.tenantName,
    plan: input.plan,
    contactEmail: input.contactEmail,
    contactName: input.contactName,
    note: input.note,
    status: "Pending",
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

export async function listTenantApplications(): Promise<TenantApplication[]> {
  const items = await queryGSI1<TenantApplicationItem>(GSI1PK);
  // 新しい順（GSI1SK=createdAt想定）
  items.sort((a, b) => (a.GSI1SK < b.GSI1SK ? 1 : a.GSI1SK > b.GSI1SK ? -1 : 0));
  return items.map(mapTenantApplication);
}

export async function findTenantApplicationById(
  id: string
): Promise<TenantApplication | null> {
  const item = await getItem<TenantApplicationItem>(SYSTEM_TENANT_ID, `${SK_PREFIX}${id}`);
  if (!item) return null;
  return mapTenantApplication(item);
}

export async function reviewTenantApplication(options: {
  id: string;
  decision: ReviewTenantApplicationDecision;
  decidedByUserId: string;
  decisionNote?: string;
  createdTenantId?: string;
}): Promise<TenantApplication> {
  const current = await getItem<TenantApplicationItem>(
    SYSTEM_TENANT_ID,
    `${SK_PREFIX}${options.id}`
  );
  if (!current) {
    throw new AppError("NOT_FOUND", "テナント申請が見つかりません");
  }
  if (current.status !== "Pending") {
    throw new AppError("BAD_REQUEST", "この申請は既に処理済みです");
  }

  const decidedAt = new Date().toISOString();
  const updatedAt = decidedAt;
  const status: TenantApplicationStatus =
    options.decision === "approve" ? "Approved" : "Rejected";

  const sets: string[] = [
    "#status = :status",
    "decidedAt = :decidedAt",
    "decidedByUserId = :decidedByUserId",
    "updatedAt = :updatedAt",
  ];
  const values: Record<string, unknown> = {
    ":status": status,
    ":decidedAt": decidedAt,
    ":decidedByUserId": options.decidedByUserId,
    ":updatedAt": updatedAt,
  };
  const names: Record<string, string> = {
    "#status": "status",
  };

  if (options.decisionNote !== undefined) {
    sets.push("decisionNote = :decisionNote");
    values[":decisionNote"] = options.decisionNote;
  }

  if (options.createdTenantId !== undefined) {
    sets.push("createdTenantId = :createdTenantId");
    values[":createdTenantId"] = options.createdTenantId;
  }

  await updateItem(
    SYSTEM_TENANT_ID,
    `${SK_PREFIX}${options.id}`,
    `SET ${sets.join(", ")}`,
    values,
    names
  );

  const updated = await getItem<TenantApplicationItem>(
    SYSTEM_TENANT_ID,
    `${SK_PREFIX}${options.id}`
  );
  if (!updated) {
    throw new AppError("INTERNAL_ERROR", "更新に失敗しました");
  }
  return mapTenantApplication(updated);
}

export async function updateTenantApplication(options: {
  id: string;
  input: UpdateTenantApplicationRequest;
}): Promise<TenantApplication> {
  const current = await getItem<TenantApplicationItem>(
    SYSTEM_TENANT_ID,
    `${SK_PREFIX}${options.id}`
  );
  if (!current) {
    throw new AppError("NOT_FOUND", "テナント申請が見つかりません");
  }
  if (current.status !== "Pending") {
    throw new AppError("BAD_REQUEST", "処理済みの申請は編集できません");
  }

  const sets: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  if (options.input.tenantName !== undefined) {
    sets.push("tenantName = :tenantName");
    values[":tenantName"] = options.input.tenantName;
  }

  if (options.input.plan !== undefined) {
    sets.push("#plan = :plan");
    values[":plan"] = options.input.plan;
    names["#plan"] = "plan";
  }

  if (options.input.contactEmail !== undefined) {
    sets.push("contactEmail = :contactEmail");
    values[":contactEmail"] = options.input.contactEmail;
  }

  if (options.input.contactName !== undefined) {
    sets.push("contactName = :contactName");
    values[":contactName"] = options.input.contactName;
  }

  if (options.input.note !== undefined) {
    sets.push("#note = :note");
    values[":note"] = options.input.note;
    names["#note"] = "note";
  }

  const now = new Date().toISOString();
  sets.push("updatedAt = :updatedAt");
  values[":updatedAt"] = now;

  if (sets.length === 1) {
    // updatedAt 以外に変更が無い
    return mapTenantApplication(current);
  }

  await updateItem(
    SYSTEM_TENANT_ID,
    `${SK_PREFIX}${options.id}`,
    `SET ${sets.join(", ")}`,
    values,
    Object.keys(names).length > 0 ? names : undefined
  );

  const updated = await getItem<TenantApplicationItem>(
    SYSTEM_TENANT_ID,
    `${SK_PREFIX}${options.id}`
  );
  if (!updated) {
    throw new AppError("INTERNAL_ERROR", "更新に失敗しました");
  }
  return mapTenantApplication(updated);
}

function mapTenantApplication(item: TenantApplicationItem): TenantApplication {
  return {
    id: item.SK.replace(SK_PREFIX, ""),
    tenantName: item.tenantName,
    plan: item.plan,
    contactEmail: item.contactEmail,
    contactName: item.contactName,
    note: item.note,
    status: item.status,
    decisionNote: item.decisionNote,
    decidedAt: item.decidedAt ? new Date(item.decidedAt) : undefined,
    decidedByUserId: item.decidedByUserId,
    createdTenantId: item.createdTenantId,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}


