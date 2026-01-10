# DynamoDB マルチテーブル移行設計

## 目的

現状の DynamoDB は「シングルテーブル + GSI1/GSI2」に集約されており、PK/SK の読み解きが難しい。  
本設計では **機能互換を維持したまま**、ドメインごとにテーブルを分割（マルチテーブル）し、段階的に移行できるようにする。

## 互換性方針（切替でロールバック可能）

- **常に multi**: `DYNAMODB_TABLE_NAME` をプレフィックスとして、用途別のテーブル（`<base>-<suffix>`）を参照する
- **旧 single は移行後に削除**: 既存の単一テーブル（`<base>`）はバックフィル完了後に Terraform で destroy する

環境変数:

- `DYNAMODB_TABLE_NAME`: ベース名（例: `aiagent-dev`）

## テーブル一覧（suffix / 主キー / GSI）

共通:

- 主キー: `PK`（HASH）, `SK`（RANGE）
- GSI名: `GSI1`, `GSI2`（既存と同名）

| テーブル(suffix) | 主な格納物 | 主キー | GSI |
|---|---|---|---|
| `tenants` | Tenant | `PK=TENANT#<id>`, `SK=TENANT#<id>` | GSI1（一覧用: `GSI1PK="TENANT"`, `GSI1SK=<createdAt>`） |
| `users` | User | `PK=TENANT#<tenantId>`, `SK=USER#<userId>` | GSI1（全テナント横断一覧: `GSI1PK="USER"`）, GSI2（userId→tenant 逆引き: `GSI2PK=USER#<id>`, `GSI2SK=TENANT#<tenantId>`） |
| `tenant_applications` | TenantApplication | `PK=TENANT#system`, `SK=TENANT_APPLICATION#<id>` | GSI1（一覧: `GSI1PK="TENANT_APPLICATION"`, `GSI1SK=<createdAt>`） |
| `permission_policies` | 権限ポリシー | `PK=TENANT#<tenantId>`, `SK=POLICY#PERMISSIONS` | なし |
| `user_preferences` | ユーザー設定 | `PK=TENANT#<tenantId>`, `SK=USER_PREFS#USER#<userId>` | なし |
| `email_accounts` | EmailAccount | `PK=TENANT#<tenantId>`, `SK=EMAIL_ACCOUNT#<id>` | GSI1（email+provider検索）, GSI2（userId配下一覧） |
| `email_messages` | EmailMessage | `PK=TENANT#<tenantId>`, `SK=EMAIL_MESSAGE#<id>` | GSI2（taskId→紐づくメール一覧） |
| `tasks` | Task | `PK=TENANT#<tenantId>`, `SK=TASK#<id>` | GSI1（tenant+status一覧）, GSI2（userId配下一覧） |
| `user_email_subscriptions` | UserEmailAccountSubscription | `PK=TENANT#<tenantId>`, `SK=USER_EMAIL_SUB#...` | GSI2（userId配下一覧） |
| `push_subscriptions` | PushSubscription | `PK=TENANT#<tenantId>`, `SK=PUSH_SUB#<id>` | GSI2（userId配下一覧） |
| `announcements` | AnnouncementBoard | `PK=TENANT#<tenantId>`, `SK=ANNOUNCEMENTS#BOARD` | なし |
| `notices` | Notice | `PK=GLOBAL`, `SK=NOTICE#<id>` | なし |

## 移行手順（推奨）

### 1) 新テーブル作成（Terraform）

`infra/terraform/dynamodb/main.tf` で `enable_multi_tables=true` の場合、既存テーブルを残したまま新テーブル群を追加作成する。

### 2) バックフィル（single → multi）

バックフィル用スクリプト:

- `packages/db-dynamo/scripts/migrate-single-to-multi.mjs`

これは single テーブルを `Scan` し、PK/SK ルールで宛先テーブルへ `BatchWrite` する（再実行可能）。

### 3) 切替（アプリ参照先を multi に）

このリポのアプリは常にマルチテーブルを参照するため、バックフィルが完了したらそのままデプロイする。

### 4) 旧 single テーブル削除

バックフィル完了・動作確認が取れたら、Terraform で旧 single テーブルを destroy する。

## 書き込み競合について

バックフィル中にアプリが single 側へ書き込みを続けると、multi 側に差分が残る可能性がある。  
対策は運用要件に合わせて以下から選ぶ:

- **簡易（推奨）**: 切替直前に短時間メンテナンス（書き込み停止）→バックフィル再実行→切替
- **厳密（将来対応）**: DynamoDB Streams + Lambda で single→multi のCDC（またはアプリの dual-write モード追加）


