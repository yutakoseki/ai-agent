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

variable "region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-1"
}

variable "project" {
  type        = string
  description = "Project name prefix for resources"
  default     = "aiagent"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g. dev/stg/prod)"
  default     = "dev"
}

variable "dynamodb_billing_mode" {
  type        = string
  description = "Billing mode for DynamoDB (PAY_PER_REQUEST or PROVISIONED)"
  default     = "PAY_PER_REQUEST"
}

variable "dynamodb_read_capacity" {
  type        = number
  description = "Read capacity when using PROVISIONED"
  default     = 5
}

variable "dynamodb_write_capacity" {
  type        = number
  description = "Write capacity when using PROVISIONED"
  default     = 5
}

variable "amplify_role_name" {
  type        = string
  description = "Amplify (Gen2) execution role name to attach DynamoDB policy"
  default     = ""
}

locals {
  table_name = "${var.project}-${var.environment}"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_kms_key" "dynamodb" {
  description             = "KMS key for DynamoDB table ${local.table_name}"
  enable_key_rotation     = true
  deletion_window_in_days = 7
  tags                    = local.tags
}

resource "aws_dynamodb_table" "main" {
  name         = local.table_name
  billing_mode = var.dynamodb_billing_mode
  read_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
    read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }

  tags = local.tags
}

data "aws_iam_policy_document" "dynamodb_access" {
  statement {
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
      "dynamodb:DescribeTable"
    ]
    resources = [
      aws_dynamodb_table.main.arn,
      "${aws_dynamodb_table.main.arn}/index/*"
    ]
  }

  # DynamoDB SSE に CMK を使っている場合、呼び出し元プリンシパルに KMS 権限が必要になる。
  # Amplify(Web Compute) の SSR 実行ロールが `kms:Decrypt` を持たないと、API が 500 で落ちる。
  statement {
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:Encrypt",
      "kms:GenerateDataKey",
      "kms:GenerateDataKeyWithoutPlaintext",
      "kms:DescribeKey"
    ]
    resources = [aws_kms_key.dynamodb.arn]
  }
}

resource "aws_iam_policy" "dynamodb_access" {
  name        = "${local.table_name}-dynamodb-access"
  description = "Minimal access to DynamoDB table ${local.table_name}"
  policy      = data.aws_iam_policy_document.dynamodb_access.json
  tags        = local.tags
}

data "aws_iam_policy_document" "assume_by_amplify" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["amplify.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "amplify_execution" {
  count              = var.amplify_role_name == "" ? 1 : 0
  name               = "${local.table_name}-amplify-exec"
  assume_role_policy = data.aws_iam_policy_document.assume_by_amplify.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "amplify_dynamodb" {
  count      = var.amplify_role_name == "" ? 1 : 0
  role       = aws_iam_role.amplify_execution[0].name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

resource "aws_iam_role_policy_attachment" "existing_amplify_dynamodb" {
  count      = var.amplify_role_name != "" ? 1 : 0
  role       = var.amplify_role_name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.main.name
}

output "dynamodb_kms_key_arn" {
  value = aws_kms_key.dynamodb.arn
}

output "amplify_role_name" {
  value = var.amplify_role_name != "" ? var.amplify_role_name : aws_iam_role.amplify_execution[0].name
}

output "dynamodb_policy_arn" {
  value       = aws_iam_policy.dynamodb_access.arn
  description = "DynamoDB access policy ARN"
}

output "table_name" {
  value       = aws_dynamodb_table.main.name
  description = "DynamoDB table name"
}
