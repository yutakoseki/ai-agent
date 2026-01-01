import { test, expect } from "@playwright/test";

test("トップページにアクセスできる", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  // 環境によっては未ログイン時に /login へリダイレクトされることがあるため、
  // 「/loginに飛ぶケース」と「そのままトップページを表示するケース」の両方を許容する。
  try {
    // リダイレクトする場合は、ここでURLが変わる
    await page.waitForURL(/\/login/, { timeout: 2000 });
  } catch {
    // no-op
  }

  const currentUrl = page.url();
  const appTitleHeading = page.getByRole("heading", {
    name: /AI Agent Platform/i,
  });

  if (currentUrl.includes("/login")) {
    await expect(appTitleHeading).toBeVisible();
    await expect(page.getByRole("heading", { name: /サインイン/ })).toBeVisible();
  } else {
    // トップページが表示される場合の最低限のスモークチェック
    await expect(appTitleHeading).toBeVisible();
  }
});
