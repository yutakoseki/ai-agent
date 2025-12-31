// テナント申請（オンボーディング）関連の型定義

import type { PlanType } from "./tenant";

export type TenantApplicationStatus = "Pending" | "Approved" | "Rejected";

export interface TenantApplication {
  id: string;
  tenantName: string;
  plan: PlanType;
  contactEmail: string;
  contactName?: string;
  note?: string;
  status: TenantApplicationStatus;
  decisionNote?: string;
  decidedAt?: Date;
  decidedByUserId?: string;
  createdTenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantApplicationRequest {
  tenantName: string;
  plan: PlanType;
  contactEmail: string;
  contactName?: string;
  note?: string;
}

export interface TenantApplicationListResponse {
  applications: TenantApplication[];
  total: number;
}

export type ReviewTenantApplicationDecision = "approve" | "reject";

export interface ReviewTenantApplicationRequest {
  decision: ReviewTenantApplicationDecision;
  decisionNote?: string;
}


