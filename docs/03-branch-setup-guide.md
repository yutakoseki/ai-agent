# ブランチセットアップガイド

このドキュメントでは、開発に必要なブランチの作成と保護ルールの設定手順を説明します。

## ステップ1: 必要なブランチを作成

現在のブランチ構成を確認して、必要なブランチを作成します。

### 1.1 現在のブランチを確認

```bash
# 現在のブランチを確認
git branch -a

# リモートブランチも含めて確認
git branch -r
```

### 1.2 必要なブランチ

以下の3つのブランチが必要です：

1. **`prod`** - 本番環境
2. **`staging`** - ステージング環境
3. **`develop`** - 開発環境

### 1.3 ブランチ作成手順

#### 現在 `prod` ブランチにいる場合

```bash
# 現在の状態を確認
git status

# 全ての変更をコミット
git add .
git commit -m "chore: 初期セットアップ完了"

# developブランチを作成
git checkout -b develop
git push origin develop

# stagingブランチを作成
git checkout -b staging
git push origin staging

# prodブランチを作成
git checkout - b prod
git push origin prod
```

#### 現在別のブランチにいる場合

```bash
# mainブランチに移動（なければ作成）
git checkout -b prod
git push origin prod

# 上記の手順を実行
```

---

## ステップ2: ブランチ保護ルールの設定

GitHub上でブランチを保護します。

### 2.1 GitHub リポジトリにアクセス

1. GitHub リポジトリを開く
2. **Settings** タブをクリック
3. 左メニューから **Branches** をクリック

### 2.2 `prod` ブランチの保護設定

1. **Add branch protection rule** をクリック
2. 以下の設定を行う：

```
Branch name pattern: prod

☑ Require a pull request before merging
  ☑ Require approvals: 2
  ☑ Dismiss stale pull request approvals when new commits are pushed
  ☑ Require review from Code Owners

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  
  Status checks that are required:
  （以下は後でPRを作成した後に選択可能になります）
  - lint
  - unit-test
  - integration-test
  - build
  - e2e-test

☑ Require conversation resolution before merging

☑ Require linear history

☐ Require signed commits（オプション）

☐ Do not allow bypassing the above settings
  （開発初期は柔軟性のためオフ推奨）
```

3. **Create** をクリック

### 2.3 `staging` ブランチの保護設定

1. **Add branch protection rule** をクリック
2. 以下の設定を行う：

```
Branch name pattern: staging

☑ Require a pull request before merging
  ☑ Require approvals: 1
  ☑ Dismiss stale pull request approvals when new commits are pushed

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  
  Status checks that are required:
  - lint
  - unit-test
  - integration-test
  - build
  - e2e-test

☑ Require conversation resolution before merging
```

3. **Create** をクリック

### 2.4 `develop` ブランチの保護設定

1. **Add branch protection rule** をクリック
2. 以下の設定を行う：

```
Branch name pattern: develop

☑ Require a pull request before merging
  ☑ Require approvals: 1

☑ Require status checks to pass before merging
  
  Status checks that are required:
  - lint
  - unit-test
  - integration-test
  - build
```

3. **Create** をクリック

---

## ステップ3: CODEOWNERS の更新

`.github/CODEOWNERS` ファイルを実際のGitHubユーザー名に更新します。

### 3.1 現在の設定を確認

```bash
cat .github/CODEOWNERS
```

### 3.2 ユーザー名を更新

`.github/CODEOWNERS` を編集：

```bash
# 例：@your-org/core-team を実際のユーザー名に変更

# 変更前
* @your-org/core-team

# 変更後（個人の場合）
* @your-github-username

# 変更後（チームの場合）
* @your-org/team-name @user1 @user2
```

### 3.3 一人で開発する場合のシンプルな設定

```bash
# デフォルト: 全てのファイル
* @your-github-username

# 認証・セキュリティ関連（重要なファイル）
/apps/web/lib/auth/ @your-github-username
/apps/web/lib/middleware/ @your-github-username

# インフラ・デプロイ関連
/infra/ @your-github-username
/.github/workflows/ @your-github-username
```

### 3.4 変更をコミット

```bash
git add .github/CODEOWNERS
git commit -m "chore: CODEOWNERSを実際のユーザー名に更新"
git push origin prod
```

---

## ステップ4: 動作確認用のテストPR作成

### 4.1 テスト用ブランチを作成

```bash
# developブランチから作業ブランチを作成
git checkout develop
git pull origin develop

# テスト用ブランチ作成
git checkout -b feature/test-ci-setup

# 簡単な変更を加える（例：READMEに一行追加）
echo "" >> README.md
echo "## CI/CD Setup Complete" >> README.md

git add README.md
git commit -m "test: CI/CDセットアップの動作確認"
git push origin feature/test-ci-setup
```

### 4.2 PRを作成

1. GitHub リポジトリにアクセス
2. **Pull requests** タブをクリック
3. **New pull request** をクリック
4. base: `develop` ← compare: `feature/test-ci-setup` を選択
5. **Create pull request** をクリック

### 4.3 GitHub Actions の実行を確認

PR作成後、以下が自動実行されます：

- ✅ Lint and Format Check
- ✅ Unit Tests
- ✅ Integration Tests
- ✅ Build Check

**Actions** タブで実行状況を確認できます。

### 4.4 初回実行時の注意

初回は Status checks が設定されていないため、以下の手順で追加：

1. PRページで **Merge pull request** ボタンの近くを確認
2. 実行された checks が表示される
3. GitHub Settings → Branches → 該当ブランチの保護ルール編集
4. "Status checks that are required" に表示されたチェック項目を追加

---

## トラブルシューティング

### ブランチ保護ルールが設定できない

**原因**: リポジトリの権限が不足している

**解決策**:
- リポジトリのオーナーまたは管理者権限が必要
- 個人リポジトリの場合は問題なし

### Status checks が表示されない

**原因**: まだGitHub Actionsが一度も実行されていない

**解決策**:
1. 先にテストPRを作成
2. GitHub Actionsが実行される
3. その後、ブランチ保護ルールで選択可能になる

### GitHub Actions が失敗する

**原因**: Secrets が設定されていない

**解決策**:
1. `docs/github-secrets-checklist.md` を確認
2. 必要なSecretsを設定
3. PRを再実行（Re-run jobs）

---

## チェックリスト

### ブランチ作成
- [ ] `prod` ブランチ作成・プッシュ
- [ ] `staging` ブランチ作成・プッシュ
- [ ] `develop` ブランチ作成・プッシュ

### ブランチ保護ルール
- [ ] `prod` の保護ルール設定
- [ ] `staging` の保護ルール設定
- [ ] `develop` の保護ルール設定

### CODEOWNERS
- [ ] `.github/CODEOWNERS` を実際のユーザー名に更新
- [ ] 変更をコミット・プッシュ

### 動作確認
- [ ] テスト用ブランチ作成
- [ ] テストPR作成
- [ ] GitHub Actions の実行確認
- [ ] Status checks をブランチ保護ルールに追加

---

## 次のステップ

ブランチセットアップ完了後：
1. Amplify アプリの作成
2. 環境変数の設定
3. 自動デプロイの確認
