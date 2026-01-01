// ログアウトAPIの統合テスト

import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

describe("POST /api/auth/logout", () => {
  it("ログアウト成功", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("ログアウトしました");

    // Cookieがクリアされているか確認
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("session=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("トレースIDがレスポンスヘッダーに含まれる", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
      },
    });

    const response = await POST(request);
    const traceId = response.headers.get("X-Trace-Id");

    expect(traceId).toBeDefined();
  });
});
