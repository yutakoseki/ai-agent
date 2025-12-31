// テナント申請（承認/却下）APIの統合テスト

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Session } from "@shared/auth";
import { getSession } from "@/lib/auth/session";
import { POST as Create } from "../route";
import { PATCH } from "./route";

vi.mock("@/lib/auth/session");
const mockGetSession = vi.mocked(getSession);

const adminSession: Session = {
  userId: "user-1",
  tenantId: "tenant-1",
  role: "Admin",
  email: "admin@example.com",
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
};

const headers = {
  "Content-Type": "application/json",
  Origin: "http://localhost:3000",
};

describe("PATCH /api/tenant-applications/:id", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(adminSession);
  });

  it("Admin権限で申請を承認できる（承認するとテナントが作成される）", async () => {
    // 申請を作成
    const createRequest = new NextRequest(
      "http://localhost:3000/api/tenant-applications",
      {
        method: "POST",
        body: JSON.stringify({
          tenantName: "承認テナント",
          plan: "Pro",
          contactEmail: "approve@example.com",
        }),
        headers,
      }
    );
    const createResponse = await Create(createRequest);
    const created = await createResponse.json();
    expect(createResponse.status).toBe(201);

    // 承認
    const id = created.id as string;
    const patchRequest = new NextRequest(
      `http://localhost:3000/api/tenant-applications/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ decision: "approve" }),
        headers,
      }
    );
    const response = await PATCH(patchRequest, { params: Promise.resolve({ id }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("Approved");
    expect(data.createdTenantId).toBeDefined();
  });

  it("Admin権限で申請を却下できる", async () => {
    const createRequest = new NextRequest(
      "http://localhost:3000/api/tenant-applications",
      {
        method: "POST",
        body: JSON.stringify({
          tenantName: "却下テナント",
          plan: "Basic",
          contactEmail: "reject@example.com",
        }),
        headers,
      }
    );
    const createResponse = await Create(createRequest);
    const created = await createResponse.json();
    expect(createResponse.status).toBe(201);

    const id = created.id as string;
    const patchRequest = new NextRequest(
      `http://localhost:3000/api/tenant-applications/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ decision: "reject", decisionNote: "要件不足" }),
        headers,
      }
    );
    const response = await PATCH(patchRequest, { params: Promise.resolve({ id }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("Rejected");
    expect(data.decisionNote).toBe("要件不足");
  });
});


