// ログインAPIの統合テスト

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@shared/error";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { loginWithCognito, verifyCognitoIdToken } from "@/lib/auth/cognito";
import { findUserByUserId } from "@/lib/repos/userRepo";

vi.mock("@/lib/auth/cognito");
vi.mock("@/lib/repos/userRepo");

const mockLoginWithCognito = vi.mocked(loginWithCognito);
const mockVerifyCognitoIdToken = vi.mocked(verifyCognitoIdToken);
const mockFindUserByUserId = vi.mocked(findUserByUserId);

const headers = {
  "Content-Type": "application/json",
  Origin: "http://localhost:3000",
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
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
      email: "admin@example.com",
      role: "Admin",
      name: "管理者",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("正しい認証情報でログイン成功", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "Test1234",
      }),
      headers,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("admin@example.com");
    expect(data.user.role).toBe("Admin");
    expect(data.token).toBeDefined();
    expect(data.token.accessToken).toBeDefined();
    expect(data.token.refreshToken).toBeDefined();

    // Cookieが設定されているか確認
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("session=");
  });

  it("間違ったパスワードでログイン失敗", async () => {
    mockLoginWithCognito.mockRejectedValue(
      new AppError(
        "UNAUTHORIZED",
        "メールアドレスまたはパスワードが正しくありません"
      )
    );

    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "WrongPassword",
      }),
      headers,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
    expect(data.message).toContain(
      "メールアドレスまたはパスワードが正しくありません"
    );
  });

  it("存在しないメールアドレスでログイン失敗", async () => {
    mockLoginWithCognito.mockRejectedValue(
      new AppError(
        "UNAUTHORIZED",
        "メールアドレスまたはパスワードが正しくありません"
      )
    );

    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "nonexistent@example.com",
        password: "Test1234",
      }),
      headers,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("メールアドレスが空の場合はエラー", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "",
        password: "Test1234",
      }),
      headers,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });

  it("パスワードが空の場合はエラー", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "",
      }),
      headers,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });

  it("トレースIDがレスポンスヘッダーに含まれる", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "Test1234",
      }),
      headers,
    });

    const response = await POST(request);
    const traceId = response.headers.get("X-Trace-Id");

    expect(traceId).toBeDefined();
    expect(traceId?.length).toBeGreaterThan(0);
  });
});
