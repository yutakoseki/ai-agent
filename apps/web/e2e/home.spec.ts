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

  // BASE_URL が誤って AWS Amplify のデフォルトページを指していると、
  // アプリの要素が一切存在せずにテストが失敗するため、早期に分かりやすく落とす。
  const amplifyDefaultText = page.getByText(
    /Your app will appear here once you complete your first deployment\./i
  );
  try {
    if (await amplifyDefaultText.isVisible({ timeout: 2000 })) {
      throw new Error(
        "BASE_URL が AWS Amplify のデフォルトページを指しています（デプロイ未完了/URL設定ミスの可能性）。STAGING_URL/PROD_URL を確認してください。"
      );
    }
  } catch {
    // no-op
  }

  // 環境によっては未ログイン時に /login へリダイレクトされることがあるため、
  // 「/loginに飛ぶケース」と「そのままトップページを表示するケース」の両方を許容する。
  try {
    // リダイレクトする場合は、ここでURLが変わる
    await page.waitForURL(/\/login/, { timeout: 5000 });
  } catch {
    // no-op
  }

  const currentUrl = page.url();
  const appTitleText = page.getByText(/AI Agent Platform/i);
  const loginHeading = page.getByRole("heading", { name: /サインイン/ });
  const homeHeading = page.getByRole("heading", { name: /^ホーム$/ });
  const homeNavLink = page.getByRole("link", { name: /^ホーム$/ });

  if (currentUrl.includes("/login")) {
    // ログイン画面
    await expect(appTitleText).toBeVisible({ timeout: 15000 });
    await expect(loginHeading).toBeVisible({ timeout: 15000 });
  } else {
    // ログイン済みホーム（サイドバー/見出しのどちらかが出ればOK）
    await expect(homeHeading.or(homeNavLink)).toBeVisible({ timeout: 20000 });
  }
});
