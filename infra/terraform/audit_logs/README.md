# audit_logs

監査ログ用のS3バケットを管理します。

- バケット名: `<project>-<environment>-audit-logs`
- バージョニング有効、SSE（AES256）、パブリックブロック
- ライフサイクル: 30日→Glacier Instant Retrieval, 365日→Glacier Deep Archive, 2555日(7年)で削除
- `force_destroy` はデフォルト false（dev でのみ true を推奨）



