// 認証ミドルウェア

import { NextRequest, NextResponse } from "next/server";
import type { Session, UserRole } from "@types/auth";
import { AppError } from "@types/error";
import { getSession } from "../auth/session";
import { randomUUID } from "crypto";

export interface AuthContext {
  session: Session;
  traceId: string;
}

export async function requireAuth(
  request: NextRequest
): Promise<{ context: AuthContext; response?: NextResponse }> {
  const traceId = randomUUID();

  const session = await getSession();

  if (!session) {
    return {
      context: { session: null as any, traceId },
      response: NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "認証が必要です",
          traceId,
        },
        { status: 401 }
      ),
    };
  }

  // セッション有効期限チェック
  if (session.expiresAt < new Date()) {
    return {
      context: { session: null as any, traceId },
      response: NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "セッションの有効期限が切れています",
          traceId,
        },
        { status: 401 }
      ),
    };
  }

  return {
    context: { session, traceId },
  };
}

export function requireRole(
  session: Session,
  allowedRoles: UserRole[],
  traceId: string
): NextResponse | null {
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json(
      {
        code: "FORBIDDEN",
        message: "この操作を実行する権限がありません",
        details: {
          required: allowedRoles,
          actual: session.role,
        },
        traceId,
      },
      { status: 403 }
    );
  }

  return null;
}

export function requireTenant(
  session: Session,
  tenantId: string,
  traceId: string
): NextResponse | null {
  if (session.tenantId !== tenantId) {
    return NextResponse.json(
      {
        code: "TENANT_MISMATCH",
        message: "テナントが一致しません",
        traceId,
      },
      { status: 403 }
    );
  }

  return null;
}
