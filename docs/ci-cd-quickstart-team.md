# CI/CD クイックスタートガイド（チーム開発版）

このドキュメントでは、チーム開発に最適化したCI/CDセットアップの手順を説明します。

> **注意**: 一人開発の場合は `01-ci-cd-quickstart-solo.md` を参照してください。

## 概要

チーム開発では、以下を厳格に管理します：

- ✅ **自動テスト**: 必須
- ✅ **自動デプロイ**: 必須
- ✅ **レビュー承認**: 必須（2人以上）
- ✅ **厳格な保護ルール**: 必須

**所要時間**: 約1-2時間

---

## ステップ1: GitHub Secrets 設定（5分）

[`github-secrets-checklist.md`](./github-secrets-checklist.md) を参照

---

## ステップ2: ブランチ保護ルール設定（チーム開発版）

### `prod` ブランチ（本番環境）

```
Branch name pattern: prod

☑ Require a pull request before merging
  ☑ Require approvals: 2  ← 2人の承認必須
  ☑ Dismiss stale pull request approvals when new commits are pushed
  ☑ Require review from Code Owners

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  Status checks:
    - lint
    - unit-test
    - integration-test
    - build
    - e2e-test

☑ Require conversation resolution before merging

☑ Require linear history

☑ Require signed commits（推奨）

☑ Do not allow bypassing the above settings
```

### `staging` ブランチ（ステージング環境）

```
Branch name pattern: staging

☑ Require a pull request before merging
  ☑ Require approvals: 1  ← 1人の承認必須
  ☑ Dismiss stale pull request approvals when new commits are pushed

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  Status checks:
    - lint
    - unit-test
    - integration-test
    - build
    - e2e-test

☑ Require conversation resolution before merging
```

### `develop` ブランチ（開発環境）

```
Branch name pattern: develop

☑ Require a pull request before merging
  ☑ Require approvals: 1

☑ Require status checks to pass before merging
  Status checks:
    - lint
    - unit-test
    - integration-test
    - build
```

---

## ステップ3: CODEOWNERS 設定

`.github/CODEOWNERS` を編集：

```bash
# デフォルト: コアチーム
* @your-org/core-team

# 認証・セキュリティ関連
/apps/web/lib/auth/ @your-org/security-team
/apps/web/lib/middleware/ @your-org/security-team

# インフラ・デプロイ関連
/infra/ @your-org/devops-team
/.github/workflows/ @your-org/devops-team
```

---

## チーム開発のフロー

### 機能開発

```bash
# 1. feature ブランチ作成
git checkout develop
git checkout -b feature/new-feature

# 2. 開発
# コーディング...

# 3. コミット
git add .
git commit -m "feat: 新機能を追加"
git push origin feature/new-feature

# 4. PR作成
# GitHub で PR 作成（develop へ）

# 5. 自動テスト実行
# GitHub Actions が自動実行

# 6. レビュー依頼
# チームメンバーにレビュー依頼

# 7. レビュー・承認
# レビュアーA: コメント・承認
# レビュアーB: 承認（prodの場合）

# 8. マージ
# 全ての承認とテストが通ったらマージ
```

### レビューのポイント

- コードの品質
- テストの網羅性
- セキュリティ
- パフォーマンス
- ドキュメント

---

## 完了チェックリスト

### GitHub 設定
- [ ] GitHub Secrets 設定完了
- [ ] ブランチ作成完了（prod, staging, develop）
- [ ] ブランチ保護ルール設定完了（承認2人/1人）
- [ ] CODEOWNERS 設定完了
- [ ] チームメンバー追加完了
- [ ] Status checks 追加完了

### Amplify 設定
- [ ] Amplify アプリ作成完了
- [ ] 全ブランチ接続完了
- [ ] 環境変数設定完了
- [ ] GitHub Secrets に URL 追加完了

### チーム設定
- [ ] チームメンバーの権限設定
- [ ] レビュープロセスの共有
- [ ] 緊急時の対応手順の共有

---

## 参考ドキュメント

- `docs/branching-strategy.md` - ブランチ戦略詳細
- `docs/testing-guide.md` - テストガイド
- `docs/setup-ci-cd.md` - CI/CD詳細リファレンス
