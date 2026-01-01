// テナント申請APIの統合テスト

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";
import type { Session } from "@shared/auth";
import { getSession } from "@/lib/auth/session";

// セッション取得をオートモック（GETのみで使用）
vi.mock("@/lib/auth/session");
const mockGetSession = vi.mocked(getSession);

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

describe("POST /api/tenant-applications", () => {
  it("テナント申請を作成できる", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/tenant-applications",
      {
        method: "POST",
        body: JSON.stringify({
          tenantName: "申請テナント",
          plan: "Pro",
          contactEmail: "contact@example.com",
          contactName: "山田 太郎",
          note: "テスト申請",
        }),
        headers,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.tenantName).toBe("申請テナント");
    expect(data.plan).toBe("Pro");
    expect(data.status).toBe("Pending");
  });

  it("必須項目が不足している場合はエラー", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/tenant-applications",
      {
        method: "POST",
        body: JSON.stringify({
          tenantName: "申請テナント",
          // plan, contactEmail が不足
        }),
        headers,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });
});

describe("GET /api/tenant-applications", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(adminSession);
  });

  it("Admin権限で申請一覧を取得できる", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/tenant-applications",
      {
        method: "GET",
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.applications)).toBe(true);
    expect(typeof data.total).toBe("number");
  });

  it("Manager権限では申請一覧を取得できない", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    const request = new NextRequest(
      "http://localhost:3000/api/tenant-applications",
      {
        method: "GET",
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe("FORBIDDEN");
  });
});


