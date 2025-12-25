// ユーザー詳細取得・更新API

import { NextRequest, NextResponse } from "next/server";
import type { UpdateUserRequest } from "@shared/user";
import { AppError } from "@shared/error";
import { requireAuth, requireRole, requireTenant } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";

// TODO: DB接続後に実装
const MOCK_USER = {
  id: "user-1",
  tenantId: "tenant-1",
  email: "admin@example.com",
  role: "Admin" as const,
  name: "管理者",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ユーザー詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;

    // TODO: DBからユーザー取得
    // const user = await db.user.findUnique({ where: { id } });
    const user = id === MOCK_USER.id ? MOCK_USER : null;

    if (!user) {
      throw new AppError("NOT_FOUND", "ユーザーが見つかりません");
    }

    // テナント分離チェック
    const tenantError = requireTenant(
      context.session,
      user.tenantId,
      context.traceId
    );
    if (tenantError) return tenantError;

    return NextResponse.json(user, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId);
  }
}

// ユーザー更新（Admin/Manager専用、または本人）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;
    const body: UpdateUserRequest = await request.json();

    // TODO: DBからユーザー取得
    const user = id === MOCK_USER.id ? MOCK_USER : null;

    if (!user) {
      throw new AppError("NOT_FOUND", "ユーザーが見つかりません");
    }

    // テナント分離チェック
    const tenantError = requireTenant(
      context.session,
      user.tenantId,
      context.traceId
    );
    if (tenantError) return tenantError;

    // 権限チェック
    const isSelf = context.session.userId === id;
    const isAdminOrManager = ["Admin", "Manager"].includes(
      context.session.role
    );

    if (!isSelf && !isAdminOrManager) {
      throw new AppError("FORBIDDEN", "他のユーザーを更新する権限がありません");
    }

    // 役割変更は Admin/Manager のみ
    if (body.role && !isAdminOrManager) {
      throw new AppError("FORBIDDEN", "役割を変更する権限がありません");
    }

    // Managerは自分より上位の役割に変更できない
    if (body.role === "Admin" && context.session.role === "Manager") {
      throw new AppError("FORBIDDEN", "Admin役割に変更する権限がありません");
    }

    // TODO: DBでユーザー更新
    // const updatedUser = await db.user.update({
    //   where: { id },
    //   data: body
    // });

    const updatedUser = {
      ...user,
      ...body,
      updatedAt: new Date(),
    };

    return NextResponse.json(updatedUser, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId);
  }
}

// ユーザー削除（Admin/Manager専用）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;

    // Admin/Manager権限チェック
    const roleError = requireRole(
      context.session,
      ["Admin", "Manager"],
      context.traceId
    );
    if (roleError) return roleError;

    // TODO: DBからユーザー取得
    const user = id === MOCK_USER.id ? MOCK_USER : null;

    if (!user) {
      throw new AppError("NOT_FOUND", "ユーザーが見つかりません");
    }

    // テナント分離チェック
    const tenantError = requireTenant(
      context.session,
      user.tenantId,
      context.traceId
    );
    if (tenantError) return tenantError;

    // 自分自身は削除できない
    if (context.session.userId === id) {
      throw new AppError("BAD_REQUEST", "自分自身を削除することはできません");
    }

    // TODO: DBでユーザー削除（論理削除推奨）
    // await db.user.delete({ where: { id } });

    return NextResponse.json(
      { message: "ユーザーを削除しました" },
      { headers: { "X-Trace-Id": context.traceId } }
    );
  } catch (error) {
    return handleError(error, context.traceId);
  }
}
