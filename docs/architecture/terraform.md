# Terraform 雛形方針（Amplify Gen2 前提）

## 目的
- Amplify Gen2 と周辺リソースを IaC 化し、環境差分をコードで管理。
- 環境別 state 分離と plan/apply のレビュープロセスを徹底。

## 構成の例
- `providers.tf`: AWS provider, region, backend(S3/Dynamo等)設定
- `amplify/` : Amplify Gen2 アプリと環境変数/シークレット設定
- `network/`: VPC/サブネット/SG（必要な場合）
- `data/`: DB、ストレージ、キュー(Rabbit/SQS等)
- `iam/`: IAMロール/ポリシー（最小権限）

## 運用ルール
- `workspace` や backend を用いて dev/stg/prd の state を分離。
- `terraform plan` は PR コメントに出力し、 `apply` は承認後に限定実行。
- シークレット/環境変数は Terraform の変数や秘密管理を用い、平文をコミットしない。

## Amplify Gen2 での留意点
- Next.js 用のビルド設定と環境変数を IaC 側で管理。
- ビルド成果物キャッシュが必要な場合は Amplify 設定と合わせて検討。
- デプロイトリガーは prod マージ後に設定し、手動トリガーも用意すると障害時に便利。

