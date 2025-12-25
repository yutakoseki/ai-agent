// テスト環境のセットアップ

import { beforeAll, afterAll, afterEach } from "vitest";

// 環境変数のモック設定
beforeAll(() => {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long-for-testing";
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
  process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  process.env.SESSION_COOKIE_NAME = "session";
  process.env.SESSION_COOKIE_SECURE = "false";
  process.env.PASSWORD_RESET_EXPIRES_IN = "1h";
  process.env.PASSWORD_RESET_SECRET =
    "test-password-reset-secret-min-32-characters-long";
});

afterEach(() => {
  // 各テスト後のクリーンアップ
});

afterAll(() => {
  // 全テスト終了後のクリーンアップ
});
