terraform {
  required_version = ">= 1.6.0"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

data "aws_caller_identity" "current" {}

locals {
  # 既存運用: 1つの Amplify app に複数ブランチ（develop/staging/prod 等）
  # このモジュールは「既存ブランチへ compute role を設定する」ことに特化する。
  branch_name = var.branch_name != "" ? var.branch_name : var.environment
  role_name   = var.compute_role_name != "" ? var.compute_role_name : "${var.name_prefix}-amplify-ssr-compute-${local.branch_name}"
  table_name  = var.dynamodb_table_name != "" ? var.dynamodb_table_name : "${var.project}-${var.environment}"
  user_pool_id = var.cognito_user_pool_id
}

data "aws_dynamodb_table" "main" {
  name = local.table_name
}

data "aws_cognito_user_pool" "main" {
  user_pool_id = local.user_pool_id
}

data "aws_iam_policy_document" "assume_by_amplify" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["amplify.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "compute" {
  name               = local.role_name
  assume_role_policy = data.aws_iam_policy_document.assume_by_amplify.json
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

data "aws_iam_policy_document" "compute_base" {
  statement {
    sid    = "DynamoDBTenantTable"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:DescribeTable",
    ]
    resources = [
      data.aws_dynamodb_table.main.arn,
      "${data.aws_dynamodb_table.main.arn}/index/*",
    ]
  }

  statement {
    sid    = "CognitoUserPool"
    effect = "Allow"
    actions = [
      "cognito-idp:InitiateAuth",
      "cognito-idp:AdminInitiateAuth",
      "cognito-idp:AdminGetUser",
      # 運用上、管理系APIもSSR側で実行するため許可（develop の compute policy と同等）
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminSetUserPassword",
      "cognito-idp:AdminDeleteUser",
    ]
    resources = [data.aws_cognito_user_pool.main.arn]
  }
}

locals {
  dynamodb_kms_key_arn = try(data.aws_dynamodb_table.main.server_side_encryption[0].kms_key_arn, null)
}

data "aws_iam_policy_document" "compute_kms" {
  count = local.dynamodb_kms_key_arn != null ? 1 : 0

  statement {
    sid    = "KmsForDynamoDbSse"
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:Encrypt",
      "kms:GenerateDataKey",
      "kms:GenerateDataKeyWithoutPlaintext",
      "kms:DescribeKey",
    ]
    resources = [local.dynamodb_kms_key_arn]
  }
}

data "aws_iam_policy_document" "compute" {
  source_policy_documents = compact([
    data.aws_iam_policy_document.compute_base.json,
    local.dynamodb_kms_key_arn != null ? data.aws_iam_policy_document.compute_kms[0].json : null,
  ])
}

resource "aws_iam_policy" "compute" {
  name        = "${local.role_name}"
  description = "Amplify SSR compute role policy for ${local.branch_name}"
  policy      = data.aws_iam_policy_document.compute.json
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "compute" {
  role       = aws_iam_role.compute.name
  policy_arn = aws_iam_policy.compute.arn
}

#
# Amplify branch の compute role 設定について:
# 現行の Terraform AWS Provider の `aws_amplify_branch` は `compute_role_arn` に未対応のため、
# `aws amplify update-branch --compute-role-arn ...` を Terraform から実行する。
#
# NOTE: apply 実行環境に AWS CLI v2 が必要。
resource "null_resource" "set_compute_role" {
  triggers = {
    app_id         = var.app_id
    branch_name    = local.branch_name
    compute_role   = aws_iam_role.compute.arn
    region         = var.region
    cognito_pool   = data.aws_cognito_user_pool.main.arn
    dynamodb_table = data.aws_dynamodb_table.main.arn
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-lc"]
    command     = "aws amplify update-branch --app-id '${var.app_id}' --branch-name '${local.branch_name}' --compute-role-arn '${aws_iam_role.compute.arn}' --region '${var.region}'"
  }
}


