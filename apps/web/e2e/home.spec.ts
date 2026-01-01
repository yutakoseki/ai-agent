import { test, expect } from "@playwright/test";

test("トップページにアクセスできる", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  // baseURL未設定/サーバー未起動などで遷移に失敗すると response が null になることがある
  expect(response, "BASE_URL が正しく設定されておらずページにアクセスできません。").not.toBeNull();
  expect(
    response!.ok(),
    `ページにアクセスできませんでした: ${response!.status()} ${response!.statusText()}`
  ).toBeTruthy();
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
  const appTitleText = page.getByText(/AI Agent Platform/i);
  const loginHeading = page.getByRole("heading", { name: /サインイン/ });
  const homeHeading = page.getByRole("heading", { name: /^ホーム$/ });

  if (currentUrl.includes("/login")) {
    // ログイン画面
    await expect(appTitleText).toBeVisible({ timeout: 15000 });
    await expect(loginHeading).toBeVisible({ timeout: 15000 });
  } else {
    // / にいるが「ログイン済みホーム」か「初期セットアップ/Welcome」かは環境差があるため両方許容
    try {
      await expect(homeHeading).toBeVisible({ timeout: 5000 });
    } catch {
      await expect(appTitleText).toBeVisible({ timeout: 15000 });
    }
  }
});
