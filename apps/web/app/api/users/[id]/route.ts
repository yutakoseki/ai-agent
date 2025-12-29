// ユーザー詳細取得・更新API

import { NextRequest, NextResponse } from "next/server";
import type { UpdateUserRequest } from "@shared/user";
import { AppError } from "@shared/error";
import { requireAuth, requireRole, requireTenant } from "@/lib/middleware/auth";
import { handleError } from "@/lib/middleware/error";
import { requireCsrf } from "@/lib/middleware/csrf";
import { findUser, updateUser } from "@/lib/repos/userRepo";

// ユーザー詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, response } = await requireAuth(request);
  if (response) return response;

  try {
    const { id } = await params;

    const user = await findUser(context.session.tenantId, id);

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
    return handleError(error, context.traceId, "GET /api/users/:id");
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
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const { id } = await params;
    const body: UpdateUserRequest = await request.json();

    const user = await findUser(context.session.tenantId, id);

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
    const isAdmin = context.session.role === "Admin";
    const isAdminOrManager = ["Admin", "Manager"].includes(
      context.session.role
    );

    if (!isSelf && !isAdminOrManager) {
      throw new AppError("FORBIDDEN", "他のユーザーを更新する権限がありません");
    }

    // 役割変更は Admin のみ
    if (body.role !== undefined) {
      if (!isAdmin) {
        throw new AppError("FORBIDDEN", "役割を変更できるのは管理者のみです");
      }
      if (isSelf) {
        throw new AppError("FORBIDDEN", "自分自身の役割は変更できません");
      }
      if (!["Manager", "Member"].includes(body.role)) {
        throw new AppError(
          "BAD_REQUEST",
          "設定できる役割は Manager または Member のみです"
        );
      }
      if (user.role === "Admin") {
        throw new AppError("FORBIDDEN", "Admin の役割はここでは変更できません");
      }
    }

    const updatedUser = await updateUser(context.session.tenantId, id, {
      email: body.email,
      name: body.name,
      role: body.role,
    });

    return NextResponse.json(updatedUser, {
      headers: { "X-Trace-Id": context.traceId },
    });
  } catch (error) {
    return handleError(error, context.traceId, "PATCH /api/users/:id");
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
    const csrfError = requireCsrf(request, context.traceId);
    if (csrfError) return csrfError;

    const { id } = await params;

    // Admin/Manager権限チェック
    const roleError = requireRole(
      context.session,
      ["Admin", "Manager"],
      context.traceId
    );
    if (roleError) return roleError;

    const user = await findUser(context.session.tenantId, id);

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
    return handleError(error, context.traceId, "DELETE /api/users/:id");
  }
}
