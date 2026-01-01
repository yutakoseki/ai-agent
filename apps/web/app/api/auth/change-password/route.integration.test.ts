// パスワード変更APIの統合テスト

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@shared/error";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  loginWithCognito,
  setCognitoUserPassword,
  verifyCognitoIdToken,
} from "@/lib/auth/cognito";
import { findUserByUserId, updateUserPasswordHash } from "@/lib/repos/userRepo";
import { sendPasswordChangedEmail } from "@/lib/notifications/passwordChangeEmails";

vi.mock("@/lib/auth/session");
vi.mock("@/lib/auth/cognito");
vi.mock("@/lib/repos/userRepo");
vi.mock("@/lib/notifications/passwordChangeEmails");

const mockGetSession = vi.mocked(getSession);
const mockLoginWithCognito = vi.mocked(loginWithCognito);
const mockVerifyCognitoIdToken = vi.mocked(verifyCognitoIdToken);
const mockSetCognitoUserPassword = vi.mocked(setCognitoUserPassword);
const mockFindUserByUserId = vi.mocked(findUserByUserId);
const mockUpdateUserPasswordHash = vi.mocked(updateUserPasswordHash);
const mockSendPasswordChangedEmail = vi.mocked(sendPasswordChangedEmail);

const headers = {
  "Content-Type": "application/json",
  Origin: "http://localhost:3000",
};

describe("POST /api/auth/change-password", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(null);
    mockLoginWithCognito.mockResolvedValue({
      idToken: "id-token",
      refreshToken: "refresh-token",
    });
    mockVerifyCognitoIdToken.mockResolvedValue({
      sub: "user-1",
      token_use: "id",
    });
    mockFindUserByUserId.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      email: "user@example.com",
      role: "Member",
      name: "User",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSetCognitoUserPassword.mockResolvedValue();
    mockUpdateUserPasswordHash.mockResolvedValue();
  });

  it("ログインなしでも現在PW確認でパスワード変更できる", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "user@example.com",
          currentPassword: "Current1234",
          newPassword: "NewPass1234",
          confirmPassword: "NewPass1234",
        }),
      }
    );

    const res = await POST(request);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("パスワードを変更しました");
    expect(mockSetCognitoUserPassword).toHaveBeenCalledWith(
      "user@example.com",
      "NewPass1234"
    );
    expect(mockUpdateUserPasswordHash).toHaveBeenCalled();
    expect(mockSendPasswordChangedEmail).toHaveBeenCalled();
  });

  it("必須項目不足は400", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "",
          currentPassword: "Current1234",
          newPassword: "NewPass1234",
          confirmPassword: "NewPass1234",
        }),
      }
    );

    const res = await POST(request);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });

  it("新しいパスワード不一致は400", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "user@example.com",
          currentPassword: "Current1234",
          newPassword: "NewPass1234",
          confirmPassword: "Mismatch1234",
        }),
      }
    );

    const res = await POST(request);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });

  it("現在パスワードが違う場合は401", async () => {
    mockLoginWithCognito.mockRejectedValue(
      new AppError("UNAUTHORIZED", "メールアドレスまたはパスワードが正しくありません")
    );

    const request = new NextRequest(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "user@example.com",
          currentPassword: "WrongPassword",
          newPassword: "NewPass1234",
          confirmPassword: "NewPass1234",
        }),
      }
    );

    const res = await POST(request);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });
});


