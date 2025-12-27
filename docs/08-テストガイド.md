# テストガイド

このドキュメントでは、プロジェクトのテスト戦略、実行方法、テストコードの書き方について説明します。

## テスト戦略

### テストピラミッド

```
      /\
     /E2E\      ← 少数、遅い、高コスト（将来実装）
    /------\
   /統合テスト\   ← 中程度、API全体の動作確認
  /----------\
 / 単体テスト  \  ← 多数、高速、低コスト
/--------------\
```

### テストの種類

#### 1. 単体テスト（Unit Tests）

- **対象**: 個別の関数、クラス、ユーティリティ
- **目的**: ロジックの正確性を検証
- **実行速度**: 高速（数秒）
- **ファイル命名**: `*.test.ts`, `*.test.tsx`

#### 2. 統合テスト（Integration Tests）

- **対象**: API エンドポイント、複数モジュールの連携
- **目的**: 機能全体の動作を検証
- **実行速度**: 中速（数十秒）
- **ファイル命名**: `*.integration.test.ts`

#### 3. E2E テスト（End-to-End Tests）

- **対象**: ユーザーの操作フロー全体
- **目的**: 実際の使用シナリオを検証
- **実行速度**: 低速（数分）
- **ファイル命名**: `*.e2e.test.ts`
- **状態**: 未実装（将来追加予定）

---

## テストコマンド

### 基本コマンド

```bash
# 全ての単体テストを実行
pnpm test

# 単体テストをウォッチモードで実行（開発中）
pnpm test:watch

# 統合テストを実行
pnpm test:integration

# 統合テストをウォッチモードで実行
pnpm test:integration:watch

# 全てのテスト（単体 + 統合）を実行
pnpm test:all

# カバレッジレポート付きでテスト実行
pnpm test:coverage
```

### 特定のテストを実行

```bash
# 特定のファイル名でフィルタ
pnpm test password

# 特定のパスを指定
pnpm test apps/web/lib/auth/password.test.ts

# パターンマッチで複数ファイル
pnpm test auth  # auth関連の全テスト

# 特定のテストケースのみ実行
pnpm test password -t "パスワードをハッシュ化"
```

### ワークスペース単位で実行

```bash
# webアプリのテストのみ実行
pnpm --filter @ai-agent/web test

# 全ワークスペースのテストを実行
pnpm -r test
```

---

## テストファイルの配置

### ディレクトリ構造

```
apps/web/
├── lib/
│   ├── auth/
│   │   ├── password.ts
│   │   ├── password.test.ts          ← 単体テスト
│   │   ├── jwt.ts
│   │   └── jwt.test.ts               ← 単体テスト
│   └── middleware/
│       ├── auth.ts
│       └── auth.test.ts              ← 単体テスト
├── app/
│   └── api/
│       └── auth/
│           └── login/
│               ├── route.ts
│               └── route.integration.test.ts  ← 統合テスト
├── vitest.config.ts                  ← 単体テスト設定
├── vitest.integration.config.ts      ← 統合テスト設定
└── vitest.setup.ts                   ← テスト環境セットアップ
```

### 命名規則

- **単体テスト**: `[ファイル名].test.ts`
- **統合テスト**: `[ファイル名].integration.test.ts`
- **E2E テスト**: `[ファイル名].e2e.test.ts`

---

## 単体テストの書き方

### 基本構造

```typescript
import { describe, it, expect } from "vitest";
import { 関数名 } from "./ファイル名";

describe("機能名", () => {
  describe("関数名", () => {
    it("期待される動作の説明", () => {
      // Arrange: テストデータの準備
      const input = "test";

      // Act: 関数の実行
      const result = 関数名(input);

      // Assert: 結果の検証
      expect(result).toBe("expected");
    });
  });
});
```

### 実例：パスワードユーティリティのテスト

```typescript
// apps/web/lib/auth/password.test.ts
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
  });
});
```

### よく使うアサーション

```typescript
// 等価性
expect(value).toBe(expected); // 厳密等価（===）
expect(value).toEqual(expected); // 深い等価（オブジェクト比較）
expect(value).not.toBe(expected); // 否定

// 真偽値
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeUndefined();
expect(value).toBeNull();

// 数値
expect(value).toBeGreaterThan(10);
expect(value).toBeLessThan(100);
expect(value).toBeGreaterThanOrEqual(10);

// 文字列
expect(string).toContain("substring");
expect(string).toMatch(/regex/);

// 配列
expect(array).toHaveLength(3);
expect(array).toContain(item);

// 例外
expect(() => fn()).toThrow();
expect(() => fn()).toThrow("エラーメッセージ");

// 非同期
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

---

## 統合テストの書き方

### 基本構造

```typescript
import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// モックの設定
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    tenantId: "tenant-1",
    role: "Admin",
    email: "admin@example.com",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  }),
}));

describe("POST /api/endpoint", () => {
  it("正常系のテスト", async () => {
    const request = new NextRequest("http://localhost:3000/api/endpoint", {
      method: "POST",
      body: JSON.stringify({ data: "value" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ expected: "result" });
  });

  it("異常系のテスト", async () => {
    const request = new NextRequest("http://localhost:3000/api/endpoint", {
      method: "POST",
      body: JSON.stringify({ invalid: "data" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("BAD_REQUEST");
  });
});
```

### 実例：ログイン API の統合テスト

```typescript
// apps/web/app/api/auth/login/route.integration.test.ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

describe("POST /api/auth/login", () => {
  it("正しい認証情報でログイン成功", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "Test1234",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("admin@example.com");
    expect(data.token.accessToken).toBeDefined();

    // Cookieが設定されているか確認
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("session=");
  });

  it("間違ったパスワードでログイン失敗", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@example.com",
        password: "WrongPassword",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });
});
```

---

## 開発フロー

### 1. 機能開発中

```bash
# 開発中のファイルのテストをウォッチモードで実行
pnpm test:watch

# または特定のファイルのみウォッチ
pnpm test password --watch
```

ファイルを保存するたびに自動的にテストが実行されます。

### 2. コミット前

```bash
# 影響範囲のテストを実行
pnpm test auth

# または全テスト実行
pnpm test:all
```

### 3. プルリクエスト前

```bash
# 全テスト + カバレッジ確認
pnpm test:coverage
```

カバレッジレポートは `coverage/` ディレクトリに生成されます。

### 4. CI/CD

CI では以下のコマンドが自動実行されます：

```bash
pnpm test:all
```

---

## テスト環境の設定

### vitest.config.ts（単体テスト）

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["**/*.integration.test.ts", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "**/*.config.ts",
        "**/*.test.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      "@types": resolve(__dirname, "../../packages/types/src"),
      "@config": resolve(__dirname, "../../packages/config/src"),
    },
  },
});
```

### vitest.integration.config.ts（統合テスト）

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      "@types": resolve(__dirname, "../../packages/types/src"),
      "@config": resolve(__dirname, "../../packages/config/src"),
    },
  },
});
```

### vitest.setup.ts（環境セットアップ）

```typescript
import { beforeAll, afterAll, afterEach } from "vitest";

// 環境変数のモック設定
beforeAll(() => {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long-for-testing";
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
  process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  process.env.SESSION_COOKIE_NAME = "session";
  process.env.SESSION_COOKIE_SECURE = "false";
});

afterEach(() => {
  // 各テスト後のクリーンアップ
});

afterAll(() => {
  // 全テスト終了後のクリーンアップ
});
```

---

## ベストプラクティス

### 1. テストは独立させる

```typescript
// ❌ 悪い例：テスト間で状態を共有
let sharedState = {};

it("テスト1", () => {
  sharedState.value = "test";
});

it("テスト2", () => {
  expect(sharedState.value).toBe("test"); // テスト1に依存
});

// ✅ 良い例：各テストで状態を初期化
it("テスト1", () => {
  const state = { value: "test" };
  expect(state.value).toBe("test");
});

it("テスト2", () => {
  const state = { value: "test" };
  expect(state.value).toBe("test");
});
```

### 2. テスト名は明確に

```typescript
// ❌ 悪い例
it('works', () => { ... });

// ✅ 良い例
it('正しいパスワードで検証成功', () => { ... });
it('間違ったパスワードで検証失敗', () => { ... });
```

### 3. AAA パターンを使う

```typescript
it("テストケース", () => {
  // Arrange: テストデータの準備
  const input = "test";
  const expected = "result";

  // Act: 関数の実行
  const result = someFunction(input);

  // Assert: 結果の検証
  expect(result).toBe(expected);
});
```

### 4. エッジケースをテストする

```typescript
describe('validatePasswordStrength', () => {
  it('正常系：強力なパスワード', () => { ... });
  it('異常系：短すぎるパスワード', () => { ... });
  it('異常系：大文字がない', () => { ... });
  it('異常系：小文字がない', () => { ... });
  it('異常系：数字がない', () => { ... });
  it('境界値：最小文字数', () => { ... });
  it('境界値：空文字列', () => { ... });
});
```

### 5. モックは最小限に

```typescript
// ❌ 悪い例：過度なモック
vi.mock("./everything");

// ✅ 良い例：必要な部分のみモック
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue(mockSession),
}));
```

---

## トラブルシューティング

### テストが失敗する

1. **エラーメッセージを確認**

   ```bash
   pnpm test -- --reporter=verbose
   ```

2. **特定のテストのみ実行**

   ```bash
   pnpm test password -t "パスワードをハッシュ化"
   ```

3. **デバッグモードで実行**
   ```bash
   pnpm test --inspect-brk
   ```

### モックが動作しない

1. **モックの順序を確認**（import より前に vi.mock を配置）
2. **モックのパスを確認**（エイリアスが正しいか）
3. **モックのリセット**
   ```typescript
   afterEach(() => {
     vi.clearAllMocks();
   });
   ```

### カバレッジが低い

```bash
# カバレッジレポートを確認
pnpm test:coverage

# HTMLレポートを開く
open coverage/index.html
```

---

## 現在のテスト状況

### 実装済み

- ✅ 単体テスト：25 個（全てパス）

  - パスワードユーティリティ：10 個
  - JWT ユーティリティ：7 個
  - エラーハンドリング：8 個

- ✅ 統合テスト：21 個（13 個パス、8 個モック問題）
  - ログイン API：6 個
  - ログアウト API：2 個
  - テナント管理 API：6 個
  - ユーザー管理 API：7 個

### 今後追加予定

- [ ] E2E テスト（Playwright）
- [ ] パフォーマンステスト
- [ ] セキュリティテスト
- [ ] 負荷テスト

---

## 参考リンク

- [Vitest 公式ドキュメント](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Next.js Testing](https://nextjs.org/docs/testing)
