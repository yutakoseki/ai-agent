// ユーザー管理APIの統合テスト

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

// セッション取得のモック
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    tenantId: "tenant-1",
    role: "Admin",
    email: "admin@example.com",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  }),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}));

describe("GET /api/users", () => {
  it("認証済みユーザーはユーザー一覧を取得できる", async () => {
    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.total).toBeDefined();
  });

  it("トレースIDがレスポンスヘッダーに含まれる", async () => {
    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "GET",
    });

    const response = await GET(request);
    const traceId = response.headers.get("X-Trace-Id");

    expect(traceId).toBeDefined();
  });
});

describe("POST /api/users", () => {
  it("Admin権限でユーザーを作成できる", async () => {
    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "newuser@example.com",
        password: "NewUser1234",
        role: "Member",
        name: "新しいユーザー",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.email).toBe("newuser@example.com");
    expect(data.role).toBe("Member");
    expect(data.name).toBe("新しいユーザー");
    expect(data.tenantId).toBe("tenant-1");
  });

  it("必須項目が不足している場合はエラー", async () => {
    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "newuser@example.com",
        // password と role が不足
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });

  it("弱いパスワードは拒否される", async () => {
    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "newuser@example.com",
        password: "weak",
        role: "Member",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
    expect(data.message).toContain("パスワード");
  });
});

describe("POST /api/users - Manager権限", () => {
  beforeEach(() => {
    // Managerセッションに変更
    vi.mocked(require("@/lib/auth/session").getSession).mockResolvedValue({
      userId: "user-2",
      tenantId: "tenant-1",
      role: "Manager",
      email: "manager@example.com",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
  });

  it("ManagerはMemberを作成できる", async () => {
    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "member@example.com",
        password: "Member1234",
        role: "Member",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it("ManagerはAdminを作成できない", async () => {
    const request = new NextRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "Admin1234",
        role: "Admin",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe("FORBIDDEN");
  });
});
