import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "./route";
import { NextRequest } from "next/server";
import type { Session } from "@shared/auth";
import { AppError } from "@shared/error";
import { getSession } from "@/lib/auth/session";
import { deleteCognitoUser } from "@/lib/auth/cognito";
import { deleteUser, findUser, findUserByUserId } from "@/lib/repos/userRepo";

vi.mock("@/lib/auth/session");
const mockGetSession = vi.mocked(getSession);

vi.mock("@/lib/auth/cognito");
const mockDeleteCognitoUser = vi.mocked(deleteCognitoUser);

vi.mock("@/lib/repos/userRepo");
const mockDeleteUser = vi.mocked(deleteUser);
const mockFindUser = vi.mocked(findUser);
const mockFindUserByUserId = vi.mocked(findUserByUserId);

const adminSession: Session = {
  userId: "admin-1",
  tenantId: "tenant-admin",
  role: "Admin",
  email: "admin@example.com",
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
};

const managerSession: Session = {
  userId: "manager-1",
  tenantId: "tenant-a",
  role: "Manager",
  email: "manager@example.com",
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
};

const memberSession: Session = {
  userId: "member-1",
  tenantId: "tenant-a",
  role: "Member",
  email: "member@example.com",
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
};

const headers = {
  Origin: "http://localhost:3000",
};

describe("DELETE /api/users/:id", () => {
  // 各テストの呼び出し回数が混ざらないようにリセット
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Adminは（別テナント含め）ユーザーを削除できる", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUserByUserId.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-x",
      email: "u@example.com",
      role: "Member",
      name: "U",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDeleteCognitoUser.mockResolvedValue();
    mockDeleteUser.mockResolvedValue();

    const request = new NextRequest("http://localhost:3000/api/users/user-1", {
      method: "DELETE",
      headers,
    });

    const res = await DELETE(request, { params: Promise.resolve({ id: "user-1" }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.message).toBe("ユーザーを削除しました");
    expect(mockDeleteUser).toHaveBeenCalledWith("tenant-x", "user-1");
    expect(mockDeleteCognitoUser).toHaveBeenCalledWith("u@example.com");
  });

  it("Managerは自テナントのユーザーを削除できる", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUser.mockResolvedValue({
      id: "user-2",
      tenantId: "tenant-a",
      email: "u2@example.com",
      role: "Member",
      name: "U2",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDeleteCognitoUser.mockResolvedValue();
    mockDeleteUser.mockResolvedValue();

    const request = new NextRequest("http://localhost:3000/api/users/user-2", {
      method: "DELETE",
      headers,
    });

    const res = await DELETE(request, { params: Promise.resolve({ id: "user-2" }) });
    expect(res.status).toBe(200);
    expect(mockDeleteUser).toHaveBeenCalledWith("tenant-a", "user-2");
  });

  it("Memberは削除できない（403）", async () => {
    mockGetSession.mockResolvedValue(memberSession);

    const request = new NextRequest("http://localhost:3000/api/users/user-3", {
      method: "DELETE",
      headers,
    });

    const res = await DELETE(request, { params: Promise.resolve({ id: "user-3" }) });
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.code).toBe("FORBIDDEN");
  });

  it("自分自身は削除できない（400）", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUserByUserId.mockResolvedValue({
      id: "admin-1",
      tenantId: "tenant-admin",
      email: "admin@example.com",
      role: "Admin",
      name: "Admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest("http://localhost:3000/api/users/admin-1", {
      method: "DELETE",
      headers,
    });

    const res = await DELETE(request, { params: Promise.resolve({ id: "admin-1" }) });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });

  it("Cognito削除に失敗したらDBは削除しない（500）", async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUserByUserId.mockResolvedValue({
      id: "user-4",
      tenantId: "tenant-y",
      email: "u4@example.com",
      role: "Member",
      name: "U4",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDeleteCognitoUser.mockRejectedValue(new AppError("INTERNAL_ERROR", "boom"));

    const request = new NextRequest("http://localhost:3000/api/users/user-4", {
      method: "DELETE",
      headers,
    });

    const res = await DELETE(request, { params: Promise.resolve({ id: "user-4" }) });
    expect(res.status).toBe(500);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});


