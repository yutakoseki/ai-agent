## 4. Slack 通知の設定（オプション）

### 4.1 Incoming Webhook の作成

1. Slack ワークスペース → **Apps** → **Incoming Webhooks**
2. **Add to Slack** をクリック
3. 通知先チャンネルを選択
4. Webhook URL をコピー

### 4.2 GitHub Secrets に追加

```bash
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 4.3 通知内容のカスタマイズ

`.github/workflows/deploy-notification.yml` を編集して、通知内容を調整できます。

---

## 5. Codecov の設定（オプション）

### 5.1 アカウント作成とリポジトリ登録

1. [Codecov](https://codecov.io/) に GitHub アカウントでサインイン
2. 「Add new repository」で当該リポジトリを選択

### 5.2 アップロードトークン取得

1. Codecov → 対象リポジトリ → **Settings** → **General**
2. **Repository Upload Token** をコピー

### 5.3 GitHub Actions Secret 登録

1. GitHub → Settings → Secrets and variables → Actions
2. `CODECOV_TOKEN` を作成し、上記トークンを貼り付け

### 5.4 カバレッジレポートの出力（Vitest）

1. 依存関係: `@vitest/coverage-v8` を追加済み（なければ `pnpm add -D @vitest/coverage-v8 --filter @ai-agent/web`）
2. カバレッジ実行（ワークスペースルートで実行可）:
   ```bash
   pnpm --filter @ai-agent/web test:coverage
   ```
3. 出力ファイル: `apps/web/coverage/coverage-final.json` が生成されることを確認

### 5.5 GitHub Actions への組み込み

- `/.github/workflows/pr-test.yml` の Codecov ステップをトークン付きで設定（ファイルパスは上記出力先に合わせる）
- `token: ${{ secrets.CODECOV_TOKEN }}`も追加する

```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v3
  if: always()
  with:
    files: ./apps/web/coverage/coverage-final.json
    flags: unittests
    name: codecov-umbrella
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 5.6 動作確認

- PR を作成し CI が走るブランチ（例: develop / staging / prod）で実行
- Codecov ダッシュボードや PR コメントにカバレッジが反映されることを確認

### 5.4 カバレッジバッジの追加

`README.md` に追加：

```markdown
[![codecov](https://codecov.io/gh/your-org/your-repo/branch/prod/graph/badge.svg)](https://codecov.io/gh/your-org/your-repo)
```

例 README.md

```markdown
# カバレッジ

## 開発

[![codecov](https://codecov.io/gh/yutakoseki/ai-agent/branch/develop/graph/badge.svg)](https://codecov.io/gh/yutakoseki/ai-agent)

## ステージング

[![codecov](https://codecov.io/gh/yutakoseki/ai-agent/branch/staging/graph/badge.svg)](https://codecov.io/gh/yutakoseki/ai-agent)

## 本番

[![codecov](https://codecov.io/gh/yutakoseki/ai-agent/branch/prod/graph/badge.svg)](https://codecov.io/gh/yutakoseki/ai-agent)
```

---

## 6. トラブルシューティング

### GitHub Actions が失敗する

#### Lint エラー

```bash
# ローカルで確認
pnpm lint

# 自動修正
pnpm lint --fix
```

#### テスト失敗

```bash
# ローカルでテスト実行
pnpm test

# 特定のテストのみ
pnpm test password
```

#### ビルド失敗

```bash
# ローカルでビルド
pnpm --filter @ai-agent/web build

# 環境変数を確認
cat .env.local
```

### Amplify デプロイが失敗する

1. Amplify Console → ビルドログを確認
2. 環境変数が正しく設定されているか確認
3. `amplify.yml` の設定を確認

### E2E テストが失敗する

1. デプロイが完了しているか確認（60秒待機している）
2. テスト対象のURLが正しいか確認
3. Playwright のスクリーンショットを確認

---

## 7. 定期メンテナンス

### 依存関係の更新

```bash
# 依存関係の確認
pnpm outdated

# 更新
pnpm update

# セキュリティ脆弱性のチェック
pnpm audit
```

### GitHub Actions の更新

定期的に `.github/workflows/*.yml` のアクションバージョンを更新：

```yaml
# 古い
- uses: actions/checkout@v3

# 新しい
- uses: actions/checkout@v4
```

### Amplify の設定確認

- ビルド時間の最適化
- キャッシュの有効活用
- 環境変数の見直し

---

## 8. チェックリスト

### 初期セットアップ

- [ ] GitHub リポジトリ作成
- [ ] ブランチ保護ルール設定（prod, staging, develop）
- [ ] GitHub Secrets 設定
- [ ] CODEOWNERS 設定
- [ ] Amplify アプリ作成
- [ ] Amplify 環境変数設定
- [ ] Amplify 自動デプロイ設定
- [ ] Slack Webhook 設定（オプション）
- [ ] Codecov 設定（オプション）

### 動作確認

- [ ] feature → develop のPRでテスト実行
- [ ] develop → staging のPRでE2Eテスト実行
- [ ] staging → prod のPRでE2Eテスト実行
- [ ] develop へのマージでデプロイ通知
- [ ] staging へのマージでデプロイ通知
- [ ] prod へのマージでデプロイ通知

### 定期メンテナンス

- [ ] 月次：依存関係の更新
- [ ] 月次：セキュリティ脆弱性のチェック
- [ ] 四半期：GitHub Actions のバージョン更新
- [ ] 四半期：Amplify 設定の見直し

---

## 参考リンク

- [GitHub Actions ドキュメント](https://docs.github.com/en/actions)
- [AWS Amplify ドキュメント](https://docs.aws.amazon.com/amplify/)
- [Codecov ドキュメント](https://docs.codecov.com/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
