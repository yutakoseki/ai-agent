// JWT ユーティリティの単体テスト

import { describe, it, expect, beforeEach } from "vitest";
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./jwt";
import type { Session } from "@shared/auth";

describe("JWT utilities", () => {
  let mockSession: Session;

  beforeEach(() => {
    mockSession = {
      userId: "user-123",
      tenantId: "tenant-456",
      role: "Admin",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  });

  describe("createAccessToken", () => {
    it("アクセストークンを生成できる", async () => {
      const token = await createAccessToken(mockSession);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT形式
    });
  });

  describe("verifyAccessToken", () => {
    it("有効なトークンを検証できる", async () => {
      const token = await createAccessToken(mockSession);
      const session = await verifyAccessToken(token);

      expect(session).not.toBeNull();
      expect(session?.userId).toBe(mockSession.userId);
      expect(session?.tenantId).toBe(mockSession.tenantId);
      expect(session?.role).toBe(mockSession.role);
      expect(session?.email).toBe(mockSession.email);
    });

    it("無効なトークンはnullを返す", async () => {
      const session = await verifyAccessToken("invalid-token");

      expect(session).toBeNull();
    });

    it("改ざんされたトークンはnullを返す", async () => {
      const token = await createAccessToken(mockSession);
      const tamperedToken = token.slice(0, -5) + "xxxxx";

      const session = await verifyAccessToken(tamperedToken);
      expect(session).toBeNull();
    });
  });

  describe("createRefreshToken", () => {
    it("リフレッシュトークンを生成できる", async () => {
      const token = await createRefreshToken("user-123");

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });
  });

  describe("verifyRefreshToken", () => {
    it("有効なリフレッシュトークンを検証できる", async () => {
      const userId = "user-123";
      const token = await createRefreshToken(userId);
      const verifiedUserId = await verifyRefreshToken(token);

      expect(verifiedUserId).toBe(userId);
    });

    it("無効なリフレッシュトークンはnullを返す", async () => {
      const userId = await verifyRefreshToken("invalid-token");

      expect(userId).toBeNull();
    });
  });
});
