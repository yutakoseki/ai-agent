// テナント管理APIの統合テスト

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";
import type { Session } from "@shared/auth";
import { getSession } from "@/lib/auth/session";
import { createCognitoUser, deleteCognitoUser } from "@/lib/auth/cognito";

// セッション取得をオートモック
vi.mock("@/lib/auth/session");
const mockGetSession = vi.mocked(getSession);
vi.mock("@/lib/auth/cognito");
const mockCreateCognitoUser = vi.mocked(createCognitoUser);
const mockDeleteCognitoUser = vi.mocked(deleteCognitoUser);

const adminSession: Session = {
  userId: "user-1",
  tenantId: "tenant-1",
  role: "Admin",
  email: "admin@example.com",
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
};

const managerSession: Session = {
  userId: "user-2",
  tenantId: "tenant-1",
  role: "Manager",
  email: "manager@example.com",
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
};

const headers = {
  "Content-Type": "application/json",
  Origin: "http://localhost:3000",
};

// デフォルトはAdminセッション
mockGetSession.mockResolvedValue(adminSession);
const subPrefix = Date.now().toString(36);
let subCounter = 0;
mockCreateCognitoUser.mockImplementation(async () => ({
  sub: `cognito-${subPrefix}-${++subCounter}`,
}));
mockDeleteCognitoUser.mockResolvedValue();

describe("GET /api/tenants", () => {
  it("Admin権限でテナント一覧を取得できる", async () => {
    const request = new NextRequest("http://localhost:3000/api/tenants", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tenants).toBeDefined();
    expect(Array.isArray(data.tenants)).toBe(true);
    expect(data.total).toBeDefined();
    expect(data.page).toBeDefined();
    expect(data.pageSize).toBeDefined();
  });

  it("トレースIDがレスポンスヘッダーに含まれる", async () => {
    const request = new NextRequest("http://localhost:3000/api/tenants", {
      method: "GET",
    });

    const response = await GET(request);
    const traceId = response.headers.get("X-Trace-Id");

    expect(traceId).toBeDefined();
  });
});

describe("GET /api/tenants - 権限チェック", () => {
  beforeEach(() => {
    // Manager権限に変更
    mockGetSession.mockResolvedValue(managerSession);
  });

  it("Manager権限ではテナント一覧を取得できない", async () => {
    const request = new NextRequest("http://localhost:3000/api/tenants", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe("FORBIDDEN");
  });
});

describe("POST /api/tenants", () => {
  beforeEach(() => {
    // Admin権限に戻す
    mockGetSession.mockResolvedValue(adminSession);
  });

  it("Admin権限でテナントを作成できる", async () => {
    const request = new NextRequest("http://localhost:3000/api/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "新しいテナント",
        plan: "Pro",
        adminEmail: "newadmin@example.com",
        adminPassword: "NewAdmin1234",
      }),
      headers,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe("新しいテナント");
    expect(data.plan).toBe("Pro");
    expect(data.enabled).toBe(true);
    expect(data.id).toBeDefined();
  });

  it("必須項目が不足している場合はエラー", async () => {
    const request = new NextRequest("http://localhost:3000/api/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "新しいテナント",
        // plan, adminEmail, adminPassword が不足
      }),
      headers,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });

  it("Manager権限ではテナントを作成できない", async () => {
    // Manager権限に変更
    mockGetSession.mockResolvedValue(managerSession);

    const request = new NextRequest("http://localhost:3000/api/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "新しいテナント",
        plan: "Pro",
        adminEmail: "newadmin@example.com",
        adminPassword: "NewAdmin1234",
      }),
      headers,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe("FORBIDDEN");
  });
});
