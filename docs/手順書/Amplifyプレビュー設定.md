# Amplify プレビュー（ブランチURL / PRプレビュー）設定手順

このリポジトリの E2E（Playwright）は **PR時に staging URL を叩くのではなく、Amplify の「プレビューURL」** を叩く前提に変更しました。

## 1. どの「プレビュー」を使うか

- **ブランチURL（推奨 / 現実的）**: Amplify にブランチを接続すると、各ブランチが `https://<branch>.<appId>.amplifyapp.com` のようなURLで参照できます。
  - 例: `develop.<appId>.amplifyapp.com`
  - PRのHEADブランチ（例: `feature/foo`）をAmplify側でビルド/デプロイできれば、GitHub ActionsのE2EがそのURLに対して実行できます。
- **PRプレビュー（Pull Request Previews）**: PR作成ごとに一時的なプレビューを作る機能です。
  - ただし Amplify Hosting の制約により、**public repo + WEB_COMPUTE/SSR + IAMロール必須**の構成では有効化できない場合があります（下記参照）。

公式: `https://docs.aws.amazon.com/amplify/latest/userguide/pr-previews.html`

## 2. GitHub Actions 側の必須設定（共通）

GitHub リポジトリに以下の Secret を追加します。

- **`AMPLIFY_APP_ID`**: Amplify の appId（例: `d3twt10pcsc29v`）

これにより、PR時に以下の形式で URL を組み立ててE2Eを実行します。

- `https://<head-branch>.<AMPLIFY_APP_ID>.amplifyapp.com`

> NOTE: ブランチ名に `/` が含まれる場合、GitHub Actions側で `/` を `-` に置換してURLを組み立てています。
> Amplify側のサブドメイン表記とズレる場合は、運用に合わせてワークフローの変換ルールを調整してください。

## 3. Amplify 側：ブランチURL（プレビュー）を使えるようにする

### 3-1. ブランチを手動で接続（最小）

Amplify Console で対象アプリを開き、Hosting からブランチを追加してビルド/デプロイできる状態にします。

- **固定ブランチ（最終的に必要）**: `develop`, `staging`, `prod`
  - 一度 Amplify に接続してデプロイできれば、以後はそのブランチへの push をトリガに自動でビルド/デプロイされます。
- **PRのHEADブランチ（例）**: `feature/foo`
  - PR時E2Eの実行先は `https://<head-branch>.<appId>.amplifyapp.com` なので、E2Eを回したいブランチは Amplify 側でデプロイされている必要があります。

### 3-2. 自動でブランチを作る（おすすめ）

頻繁に PR を作る場合は、Amplify の **Auto branch creation**（自動ブランチ作成 / 自動検出）を使うと運用が楽です。

#### 自動検出（Auto branch creation）とは？

GitHub に新しいブランチが作成されたときに、Amplify がそれを自動で見つけて **「ブランチ接続 → ビルド → デプロイ」** まで行う機能です。

- 自動検出が **ON** でも、**既に接続済みのブランチ（例: `staging`, `prod`）が外れるわけではありません**。
- 逆に、パターンを広くしすぎると「意図しないブランチまで勝手にビルド/デプロイ」されるので注意してください。

#### 推奨設定（安全）

固定ブランチ（`develop`, `staging`, `prod`）は **手動で一度だけ接続**しておき、増えるブランチだけ自動検出で拾うのが王道です。

- **自動検出パターン例**: `feature/*`（必要に応じて `fix/*`, `hotfix/*` なども追加）
- **避ける（非推奨）**: `*` や `*/*` のような広すぎるパターン（全ブランチが自動デプロイされがち）

> NOTE:
>
> - PR #7 のように PR の HEAD が `develop` の場合、`develop` が Amplify に接続されていないと E2E が「未デプロイURL」として失敗します。
> - `staging`/`prod` を「最終的に Amplify でデプロイする」場合でも、自動検出に入れる必要はなく、**手動で接続済み**であれば問題ありません。

（画面の項目名は Amplify Console の UI 更新で多少変わりますが、概ね「Branch / Auto branch creation / patterns」周辺です）

## 4. Amplify 側：PRプレビューを使う場合（任意）

PRプレビューは Amplify Console の **Hosting → Previews** から有効化できます。

### 注意（重要）

Amplify の公式ドキュメント上、**public リポジトリ**の場合は、IAM service role が必要なアプリ（例: backend/WEB_COMPUTE/SSR）では PRプレビューを有効化できない制約があります。

もし PRプレビューが有効化できない場合は、上記の **ブランチURL（プレビュー）** 方式で運用してください。

## 5. 動作確認の目安

PRを作成/更新したら、以下が満たされる必要があります。

- Amplify側で **PRのHEADブランチがデプロイされている**
- `https://<head-branch>.<appId>.amplifyapp.com` が 200 を返し、Amplifyデフォルトページではない
- GitHub Actions の `E2E Tests` がそのURLを使って通る
