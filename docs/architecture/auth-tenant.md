# 認証 / RBAC / テナント分離（初期設計案）

## 境界と終端
- 認証とテナント判定は BFF (apps/web Route Handler) で終端。AgentCore にはテナントスコープ済みリクエスト/ジョブのみ渡す。
- 全ての API は `tenant_id` を必須とし、RLS を使うDBは必ずセッションレベルで `tenant_id` をセット。

## 認証
- IdP: OIDC/SAML を想定。最小構成では Email+Pass + MFA を暫定で可。
- セッション管理: Cookie ベースを優先（Secure/HttpOnly/SameSite=Lax/Strict）。トークン保存を localStorage に置かない。
- ローテーション: リフレッシュトークン/セッションIDのローテーションをログイン/権限昇格時に実施。

## CSRF 対策（BFF + HttpOnly Cookie）
- SameSite=Lax の Cookie を前提にし、状態変更系（POST/PUT/PATCH/DELETE）は Origin/Referer を検証する。
- GET で状態変更しない（CSRFで悪用されるため）。
- 同一ドメイン運用のため、CSRF トークンは当面不要とする。
- 例外（別ドメイン運用や iframe 埋め込みなど）が発生した場合は CSRF トークンを追加する。

## RBAC
- 役割: Admin / Manager / Member（最小）。write系エージェントは Admin/Manager のみ実行可、承認ゲートでの承認者も役割で制御。
- ポリシー: ルート/ハンドラごとに required roles を定義し、ミドルウェアで強制。
- エンタイトルメント: tenant × agent で利用可否・回数上限を持ち、ミドルウェアでチェックしたうえで実行許可。

## テナント分離
- DB: Postgres + RLSを前提。全テーブルに `tenant_id`、接続時に `SET app.tenant_id = ...` 相当を必須化。
- ストレージ/キャッシュ/キュー: キー/プレフィックス/トピック名に `tenant_id` を含め、ACLで分離。
- ベクトルストア: インデックス/ネームスペースをテナント単位で分ける。

## BFF ミドルウェア（Next.js Route Handler）
- 認証検証 → テナント解決 → エンタイトルメント/RBACチェック → ログ用トレースID付与 → ハンドラ実行。
- 失敗時は分類したエラー（認証不足/権限不足/テナント不一致/レート上限超過など）を返却。

## AgentCore 側の二重チェック
- 受信したジョブ/APIについて `tenant_id` の存在と許可された agent/スコープかを再検証。
- 同期APIにはタイムアウトと rate limit を設定し、非同期キューは冪等性キーを必須。

## 監査とログ
- 誰が/どのテナントで/どのエージェントを/どの入力で/どの結果になったかを記録。PIIはマスキングまたはハッシュ。
- 承認ゲートの承認者・時刻・差分を記録。

## レート/クォータ
- tenant × agent で回数上限、プラン(Basic/Pro)で月次Quotaを設定。実行前に残量をチェックし、枯渇時はガイドメッセージを返す。

## マイグレーション方針
- RLS有効化を前提にスキーマを初期作成し、既存テーブルは `tenant_id` 追加後にポリシーを適用。
- 既存データのテナント値が不明な場合は一括割当手順を用意し、ゼロダウンで切替。
