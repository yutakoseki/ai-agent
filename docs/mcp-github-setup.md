# GitHub MCP サーバー設定手順

GitHub 経由でリポジトリのリソースを参照する MCP サーバーのセットアップ手順です。

## 事前準備
- GitHub Personal Access Token（`repo` 読み取り権限以上）  
  - 例: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- 対象リポジトリの `owner/name`（複数可）

## 手順
1) 設定ディレクトリを作成  
   ```bash
   mkdir -p ~/.config/mcp/servers
   ```

2) 設定ファイルを作成（例）  
   ```bash
   cat <<'EOF' > ~/.config/mcp/servers/github.json
   {
     "name": "github",
     "transport": {
       "type": "github",
       "options": {
         "token": "ghp_your_token_here",
         "repositories": ["owner/repo1", "owner/repo2"]
       }
     }
   }
   EOF
   ```

3) CLI/エージェントを再起動して設定を読み込む。

## 動作確認
- 利用可能なリソース一覧を取得して、GitHub リポジトリが列挙されることを確認する。  
  例: `list_mcp_resources` を実行し、`github` サーバーのリソースが表示されることを確認。

## ポイント
- トークンは平文保存になるため、権限は必要最小限にする。
- リポジトリを追加する場合は `repositories` に追記し、再起動する。
- Token 失効や権限不足の場合はリソース列挙/参照が失敗するので、トークンの再発行を行う。
