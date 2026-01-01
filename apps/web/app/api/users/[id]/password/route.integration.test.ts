import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import type { Session } from "@shared/auth";
import { getSession } from "@/lib/auth/session";
import { setCognitoUserPassword } from "@/lib/auth/cognito";
import { findUserByUserId, updateUserPasswordHash } from "@/lib/repos/userRepo";
import { sendPasswordResetByAdminEmail } from "@/lib/notifications/passwordChangeEmails";

vi.mock("@/lib/auth/session");
vi.mock("@/lib/auth/cognito");
vi.mock("@/lib/repos/userRepo");
vi.mock("@/lib/notifications/passwordChangeEmails");

const mockGetSession = vi.mocked(getSession);
const mockSetCognitoUserPassword = vi.mocked(setCognitoUserPassword);
const mockFindUserByUserId = vi.mocked(findUserByUserId);
const mockUpdateUserPasswordHash = vi.mocked(updateUserPasswordHash);
const mockSendPasswordResetByAdminEmail = vi.mocked(sendPasswordResetByAdminEmail);

const adminSession: Session = {
  userId: "admin-1",
  tenantId: "tenant-admin",
  role: "Admin",
  email: "admin@example.com",
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
  "Content-Type": "application/json",
  Origin: "http://localhost:3000",
};

describe("POST /api/users/:id/password", () => {
  beforeEach(() => {
    mockSetCognitoUserPassword.mockResolvedValue();
    mockUpdateUserPasswordHash.mockResolvedValue();
    mockFindUserByUserId.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-a",
      email: "u@example.com",
      role: "Member",
      name: "U",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("Adminはユーザーのパスワードを再設定できる", async () => {
    mockGetSession.mockResolvedValue(adminSession);

    const request = new NextRequest("http://localhost:3000/api/users/user-1/password", {
      method: "POST",
      headers,
      body: JSON.stringify({ newPassword: "NewPass1234", confirmPassword: "NewPass1234" }),
    });

    const res = await POST(request, { params: Promise.resolve({ id: "user-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("再設定");
    expect(mockSetCognitoUserPassword).toHaveBeenCalledWith("u@example.com", "NewPass1234");
    expect(mockUpdateUserPasswordHash).toHaveBeenCalled();
    expect(mockSendPasswordResetByAdminEmail).toHaveBeenCalled();
  });

  it("Admin以外は403", async () => {
    mockGetSession.mockResolvedValue(memberSession);

    const request = new NextRequest("http://localhost:3000/api/users/user-1/password", {
      method: "POST",
      headers,
      body: JSON.stringify({ newPassword: "NewPass1234", confirmPassword: "NewPass1234" }),
    });

    const res = await POST(request, { params: Promise.resolve({ id: "user-1" }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe("FORBIDDEN");
  });
});


