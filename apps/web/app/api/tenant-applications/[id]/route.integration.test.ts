// テナント申請（承認/却下）APIの統合テスト

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Session } from "@shared/auth";
import { getSession } from "@/lib/auth/session";
import { createCognitoUser, deleteCognitoUser } from "@/lib/auth/cognito";
import { POST as Create } from "../route";
import { PATCH, PUT } from "./route";

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

const headers = {
  "Content-Type": "application/json",
  Origin: "http://localhost:3000",
};

describe("PATCH /api/tenant-applications/:id", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(adminSession);
    const subPrefix = Date.now().toString(36);
    let subCounter = 0;
    mockCreateCognitoUser.mockImplementation(async () => ({
      sub: `cognito-${subPrefix}-${++subCounter}`,
    }));
    mockDeleteCognitoUser.mockResolvedValue();
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
        body: JSON.stringify({ decision: "approve", decisionNote: "承認します" }),
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

  it("却下理由が無い場合はエラー", async () => {
    const createRequest = new NextRequest(
      "http://localhost:3000/api/tenant-applications",
      {
        method: "POST",
        body: JSON.stringify({
          tenantName: "却下テナント2",
          plan: "Basic",
          contactEmail: "reject2@example.com",
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
        body: JSON.stringify({ decision: "reject", decisionNote: "" }),
        headers,
      }
    );
    const response = await PATCH(patchRequest, { params: Promise.resolve({ id }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });
});

describe("PUT /api/tenant-applications/:id", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(adminSession);
  });

  it("Admin権限で申請内容を更新できる（Pendingのみ）", async () => {
    const createRequest = new NextRequest(
      "http://localhost:3000/api/tenant-applications",
      {
        method: "POST",
        body: JSON.stringify({
          tenantName: "編集前テナント",
          plan: "Basic",
          contactEmail: "edit@example.com",
          contactName: "編集前",
          note: "編集前メモ",
        }),
        headers,
      }
    );
    const createResponse = await Create(createRequest);
    const created = await createResponse.json();
    expect(createResponse.status).toBe(201);

    const id = created.id as string;
    const putRequest = new NextRequest(
      `http://localhost:3000/api/tenant-applications/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          tenantName: "編集後テナント",
          plan: "Pro",
          contactEmail: "edit2@example.com",
          contactName: "編集後",
          note: "編集後メモ",
        }),
        headers,
      }
    );
    const response = await PUT(putRequest, { params: Promise.resolve({ id }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tenantName).toBe("編集後テナント");
    expect(data.plan).toBe("Pro");
    expect(data.contactEmail).toBe("edit2@example.com");
    expect(data.contactName).toBe("編集後");
    expect(data.note).toBe("編集後メモ");
  });

  it("処理済みの申請は編集できない", async () => {
    const createRequest = new NextRequest(
      "http://localhost:3000/api/tenant-applications",
      {
        method: "POST",
        body: JSON.stringify({
          tenantName: "編集不可テナント",
          plan: "Pro",
          contactEmail: "locked@example.com",
        }),
        headers,
      }
    );
    const createResponse = await Create(createRequest);
    const created = await createResponse.json();
    expect(createResponse.status).toBe(201);
    const id = created.id as string;

    // 承認して処理済みにする（Cognitoはモック済み）
    const patchRequest = new NextRequest(
      `http://localhost:3000/api/tenant-applications/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ decision: "approve", decisionNote: "承認" }),
        headers,
      }
    );
    const patchResponse = await PATCH(patchRequest, { params: Promise.resolve({ id }) });
    expect(patchResponse.status).toBe(200);

    const putRequest = new NextRequest(
      `http://localhost:3000/api/tenant-applications/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({ tenantName: "変更" }),
        headers,
      }
    );
    const response = await PUT(putRequest, { params: Promise.resolve({ id }) });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });
});


