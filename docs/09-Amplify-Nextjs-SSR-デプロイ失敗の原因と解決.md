# Amplify + Next.js(SSR) + pnpmモノレポで「ビルドは通るのにデプロイ失敗」した原因と解決

このドキュメントは、`apps/web`（Next.js 14 / App Router）を **AWS Amplify Hosting（Compute / SSR）**へデプロイする際に、ビルド後工程で何度も失敗した原因と、最終的に安定して成功した構成をまとめたものです。

---

## 背景（何が起きていたか）

CIログでは `next build` 自体は成功するものの、Amplify の **デプロイ（Compute bundle生成）工程**で以下のようなエラーが連鎖的に発生していました。

- **`The 'node_modules' folder is missing the 'next' dependency`**
- **`Can't find required-server-files.json in build output directory`**
- **`Server trace files are not found ...`**
- **`Build output not found in .../amplify-compute-bundle-output/compute/default/.next/server`**

どれも根っこは同じで、Amplify 側が「Next.js SSRアプリの成果物はこうあるはず」という前提で行う検知/バンドルに対し、**成果物のルート（baseDirectory）や依存の配置がズレていた**ことが原因でした。

---

## 失敗していた原因（要点）

### 1) 成果物ルート（artifacts.baseDirectory）を `.next` 以外にしていた

Amplify の Web Compute のバンドラは、Next.js SSRの成果物を **`.next/server` を基点**として組み立てます。

そのため、`artifacts.baseDirectory` を `.next/standalone` などに変えると、

- Amplify が期待する `.next/server` が見つからない
- `amplify-compute-bundle-output/.../.next/server` が作れない

という形で失敗します。

→ **最終的な解決は、成果物ルートを `.next` に戻すこと**でした（後述）。

### 2) pnpm モノレポで `node_modules/next` の検知が崩れていた

pnpm のデフォルト構成だと依存がシンボリックリンク中心になり、Amplify のランタイム/検知が `next` を見つけられないケースがありました。

AWS公式でも、pnpmモノレポの場合はリポジトリルートに `.npmrc` を置き **`node-linker=hoisted`** を設定するように案内されています：

- `https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html`

### 3) tracing（outputFileTracing）の参照がモノレポ外側を向いていた

Next.js の `output: "standalone"` は outputFileTracing（依存追跡）に基づいて必要ファイルを集めますが、モノレポ構成だと tracing の root がリポジトリルートになりがちで、パス参照が複雑になります。

この状態で Amplify が成果物を解析すると `Server trace files are not found` 系に発展することがありました。

最終的には `apps/web/next.config.js` に `experimental.outputFileTracingRoot` を設定して、tracing の root をアプリ自身に寄せました。

---

## うまくいった最終構成（結論）

### 1) `amplify.yml`（成功した要点）

- **`artifacts.baseDirectory: .next`** に固定（重要）
- `amplifyHosting.config.SSR: true` を明示

```1:25:amplify.yml
version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - corepack enable
            - pnpm install
        build:
          commands:
            - pnpm build
      artifacts:
        # Amplify の Web Compute バンドラは `.next/server` を基点に bundle を作るため、成果物ルートは `.next` に揃える
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
    amplifyHosting:
      config:
        SSR: true
```

### 2) `apps/web/next.config.js`（成功した要点）

- `output: "standalone"` を維持（SSR運用のため）
- `experimental.outputFileTracingRoot` を **apps/web のディレクトリ**に設定

```1:19:apps/web/next.config.js
/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  trailingSlash: true,
  experimental: {
    // monorepo ルートではなくアプリ自身を tracing root にする
    outputFileTracingRoot: __dirname,
  },
};

export default nextConfig;
```

### 3) リポジトリルート `.npmrc`（成功した要点）

AWS公式の pnpm モノレポ要件に合わせて、`node-linker=hoisted` を設定します：

- `https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html`

```1:1:.npmrc
node-linker=hoisted
```

---

## これからどうしたらいいか（運用ルール / 再発防止）

### 重要ルール

- **artifacts のルートは `.next` から動かさない**（Compute bundle生成が崩れる）
- **pnpmモノレポは `.npmrc`（`node-linker=hoisted`）を必ずリポジトリルートに置く**
- **手作業で `.next/standalone` を成果物にしようとしない**（Amplify の検知前提とズレやすい）

### デプロイ前チェック（最低限）

- **Amplify 側のモノレポ設定**
  - Amplify コンソールのアプリ設定で「Monorepo」扱いになっていること
  - `AMPLIFY_MONOREPO_APP_ROOT` が `apps/web` と一致していること（AWS公式：`https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html`）
- **成果物の確認**
  - `.next/server` が存在すること
  - `.next/required-server-files.json` が存在すること（Next.js standalone で生成）

### ログで見るべきポイント（原因特定の早道）

- `required-server-files.json` が無い → `next.config` の `output: "standalone"` や成果物ルートが崩れている
- `node_modules missing next` → pnpm の nodeLinker / node_modules 構造が原因（`.npmrc` を確認）
- `amplify-compute-bundle-output/.../.next/server` が無い → artifacts の baseDirectory が `.next` になっていない可能性が高い

---

## 参考リンク

- pnpmモノレポの要件（`.npmrc node-linker=hoisted`）：`https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html`
- Next.js Compute アプリの確認手順（standalone実行や static/public の扱いの概念）：`https://docs.aws.amazon.com/amplify/latest/userguide/troubleshooting-SSR.html`
- Amplify の Next.js サポート概要：`https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html`


