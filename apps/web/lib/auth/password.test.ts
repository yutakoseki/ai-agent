// パスワードユーティリティの単体テスト

import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "./password";

describe("password utilities", () => {
  describe("hashPassword", () => {
    it("パスワードをハッシュ化できる", async () => {
      const password = "Test1234";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it("同じパスワードでも異なるハッシュが生成される", async () => {
      const password = "Test1234";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("正しいパスワードで検証成功", async () => {
      const password = "Test1234";
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it("間違ったパスワードで検証失敗", async () => {
      const password = "Test1234";
      const hash = await hashPassword(password);

      const result = await verifyPassword("WrongPassword", hash);
      expect(result).toBe(false);
    });
  });

  describe("validatePasswordStrength", () => {
    it("強力なパスワードは検証成功", () => {
      const result = validatePasswordStrength("Test1234");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("短すぎるパスワードは検証失敗", () => {
      const result = validatePasswordStrength("Test12");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "パスワードは8文字以上である必要があります"
      );
    });

    it("大文字がないパスワードは検証失敗", () => {
      const result = validatePasswordStrength("test1234");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "パスワードには大文字を含める必要があります"
      );
    });

    it("小文字がないパスワードは検証失敗", () => {
      const result = validatePasswordStrength("TEST1234");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "パスワードには小文字を含める必要があります"
      );
    });

    it("数字がないパスワードは検証失敗", () => {
      const result = validatePasswordStrength("TestTest");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "パスワードには数字を含める必要があります"
      );
    });

    it("複数の要件を満たさない場合、全てのエラーを返す", () => {
      const result = validatePasswordStrength("test");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
