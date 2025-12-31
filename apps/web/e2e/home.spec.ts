import { test, expect } from "@playwright/test";

test("トップページにアクセスできる", async ({ page }) => {
  await page.goto("/");
  // 未ログイン時はログイン画面へリダイレクトされる
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/AI Agent Platform/i);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(/サインイン/);
});
