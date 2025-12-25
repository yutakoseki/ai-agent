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

### 2. スクリプトを用意（例: apps/web）

`apps/web/package.json` に未定義なら追加:

```json
"scripts": {
  "type-check": "tsc --noEmit"
}
```

### 3. フック設定例（軽量推奨）

- `.husky/pre-commit` の内容を下記に変更

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm --filter @ai-agent/web lint
pnpm --filter @ai-agent/web type-check
```

- 任意で `.husky/pre-push`（重い場合は省略可）:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm --filter @ai-agent/web test
```

- pre-pushには実行権限が必要

```bash
chmod +x .husky/pre-push
```

### 4. 運用メモ

- ビルドなど重いチェックはCIに任せ、ローカルは lint/型 + 軽めのテストにとどめる。
- フレークや緊急時は `git commit --no-verify` でバイパス可。
- 導入後は `.husky/` と scripts の変更をコミットして共有する。
