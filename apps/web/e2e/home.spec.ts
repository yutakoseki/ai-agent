import { test, expect } from "@playwright/test";

test("トップページにアクセスできる", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AI Agent Platform/i);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /AI Agent Platform/i
  );
  await expect(page.getByText("初期セットアップ中です。")).toBeVisible();
});
