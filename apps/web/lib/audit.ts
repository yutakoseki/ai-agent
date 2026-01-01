import { logger } from "@/lib/logger";

export type AuditResult = "success" | "failure";

export interface AuditLogEntry {
  action: string;
  result: AuditResult;
  actorUserId?: string;
  tenantId?: string;
  traceId?: string;
  target?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string | null;
  reason?: string;
  message?: string;
}

/**
 * 監査用の構造化ログ出力。永続化ストア差し替えを前提に、まずはロガーへ集約。
 */
export function writeAuditLog(entry: AuditLogEntry): void {
  logger.info("audit", {
    action: entry.action,
    result: entry.result,
    actorUserId: entry.actorUserId,
    tenantId: entry.tenantId,
    target: entry.target,
    metadata: entry.metadata,
    ip: entry.ip,
    userAgent: entry.userAgent,
    traceId: entry.traceId,
    reason: entry.reason,
    message: entry.message,
  });
}


