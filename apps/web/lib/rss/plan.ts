import type { PlanType } from "@shared/tenant";

export type RssPlan = "Free" | "Pro" | "Business";

export type RssPlanLimits = {
  maxSources: number;
  maxSummariesPerDay: number;
};

const RSS_PLAN_LIMITS: Record<RssPlan, RssPlanLimits> = {
  Free: { maxSources: 2, maxSummariesPerDay: 3 },
  Pro: { maxSources: 10, maxSummariesPerDay: 15 },
  Business: { maxSources: 30, maxSummariesPerDay: 50 },
};

export function mapTenantPlanToRssPlan(plan: PlanType): RssPlan {
  if (plan === "Enterprise") return "Business";
  if (plan === "Pro") return "Pro";
  return "Free";
}

export function getRssPlanLimits(plan: PlanType): RssPlanLimits {
  return RSS_PLAN_LIMITS[mapTenantPlanToRssPlan(plan)];
}
