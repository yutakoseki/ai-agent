# Husky 導入手順（ローカルフックで lint/型崩れを早期検知）

## 概要

develop などへの直接 push を許容する場合でも、ローカルで lint/型チェックを回して CI 落ちを減らすための手順です。重いビルドやE2EはCIに任せ、フックは軽めにします。

## 手順

### 1. Husky を導入（ルートで実行）

```bash
pnpm dlx husky-init --pnpm
# 生成された .husky と package.json / pnpm-lock.yaml をコミット対象に
git add .husky package.json pnpm-lock.yaml
```

### 2. core.hooksPath の確認（必須）

```bash
git config core.hooksPath .husky
```

設定されていない場合は上記を実行しておく（1回のみ）。

### 3. 依存インストール（必須）

```bash
pnpm install
```

### 4. スクリプトを用意（例: apps/web）

`apps/web/package.json` に未定義なら追加:

```json
"scripts": {
  "type-check": "tsc --noEmit"
}
```

### 5. フック設定（本リポの運用方針）

- `.husky/pre-commit` の内容を下記に変更

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm --filter @ai-agent/web lint
pnpm --filter @ai-agent/web type-check
```

- `.husky/pre-push` はユニット/統合/ビルドを実行（develop ではこれが唯一のチェックになる想定）:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm --filter @ai-agent/web test
pnpm --filter @ai-agent/web test:integration
pnpm --filter @ai-agent/web build
```

- pre-pushには実行権限が必要

```bash
chmod +x .husky/pre-push
```

### 6. ビルド時の環境変数

Next.js build が走るため、ローカルでも `config/env.example` を参考に必要な環境変数を設定しておく（例: `.env`）。設定されていないと pre-push の build で失敗する。

### 7. 運用メモ

- develop ではローカル hook が唯一のチェックになるため、`--no-verify` は原則使わない運用を想定（緊急時のみ）。
- pnpm 未インストールや hooksPath 未設定だとフックが動かないので、各端末で 1〜3 を必ず実施する。
- 導入後は `.husky/` と scripts の変更をコミットして共有する。
