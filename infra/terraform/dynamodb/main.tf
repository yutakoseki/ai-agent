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

variable "enable_multi_tables" {
  type        = bool
  description = "Create additional DynamoDB tables for multi-table migration (keeps existing single table)."
  default     = true
}

variable "keep_legacy_single_table" {
  type        = bool
  description = "Keep legacy single DynamoDB table (<base>) during migration. Set false after backfill to destroy it."
  default     = true
}

variable "amplify_role_name" {
  type        = string
  description = "Amplify (Gen2) execution role name to attach DynamoDB policy"
  default     = ""
}

locals {
  table_name = "${var.project}-${var.environment}"
  multi_table_names = {
    tenants                  = "${local.table_name}-tenants"
    users                    = "${local.table_name}-users"
    tenant_applications      = "${local.table_name}-tenant_applications"
    permission_policies      = "${local.table_name}-permission_policies"
    user_preferences         = "${local.table_name}-user_preferences"
    email_accounts           = "${local.table_name}-email_accounts"
    email_messages           = "${local.table_name}-email_messages"
    tasks                    = "${local.table_name}-tasks"
    user_email_subscriptions = "${local.table_name}-user_email_subscriptions"
    push_subscriptions       = "${local.table_name}-push_subscriptions"
    announcements            = "${local.table_name}-announcements"
    notices                  = "${local.table_name}-notices"
    rss_sources              = "${local.table_name}-rss_sources"
    rss_items                = "${local.table_name}-rss_items"
    rss_drafts               = "${local.table_name}-rss_drafts"
    rss_usage                = "${local.table_name}-rss_usage"
  }
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

moved {
  from = aws_dynamodb_table.main
  to   = aws_dynamodb_table.legacy["single"]
}

resource "aws_dynamodb_table" "legacy" {
  for_each       = var.keep_legacy_single_table ? { single = local.table_name } : {}
  name           = each.value
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
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

#
# Multi-table (migration target)
#

resource "aws_dynamodb_table" "tenants" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.tenants
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "tenants" })
}

resource "aws_dynamodb_table" "users" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.users
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "users" })
}

resource "aws_dynamodb_table" "tenant_applications" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.tenant_applications
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "tenant_applications" })
}

resource "aws_dynamodb_table" "permission_policies" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.permission_policies
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "permission_policies" })
}

resource "aws_dynamodb_table" "user_preferences" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.user_preferences
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "user_preferences" })
}

resource "aws_dynamodb_table" "email_accounts" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.email_accounts
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "email_accounts" })
}

resource "aws_dynamodb_table" "email_messages" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.email_messages
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    name = "GSI2PK"
    type = "S"
  }
  attribute {
    name = "GSI2SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "email_messages" })
}

resource "aws_dynamodb_table" "tasks" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.tasks
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "tasks" })
}

resource "aws_dynamodb_table" "user_email_subscriptions" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.user_email_subscriptions
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    name = "GSI2PK"
    type = "S"
  }
  attribute {
    name = "GSI2SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "user_email_subscriptions" })
}

resource "aws_dynamodb_table" "push_subscriptions" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.push_subscriptions
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    name = "GSI2PK"
    type = "S"
  }
  attribute {
    name = "GSI2SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "push_subscriptions" })
}

resource "aws_dynamodb_table" "announcements" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.announcements
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "announcements" })
}

resource "aws_dynamodb_table" "notices" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.notices
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "notices" })
}

resource "aws_dynamodb_table" "rss_sources" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.rss_sources
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "rss_sources" })
}

resource "aws_dynamodb_table" "rss_items" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.rss_items
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "rss_items" })
}

resource "aws_dynamodb_table" "rss_drafts" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.rss_drafts
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "rss_drafts" })
}

resource "aws_dynamodb_table" "rss_usage" {
  count          = var.enable_multi_tables ? 1 : 0
  name           = local.multi_table_names.rss_usage
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  hash_key  = "PK"
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
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  tags = merge(local.tags, { TableRole = "rss_usage" })
}

locals {
  legacy_table_arns = var.keep_legacy_single_table ? [aws_dynamodb_table.legacy["single"].arn] : []
  dynamodb_table_arns = concat(
    local.legacy_table_arns,
    var.enable_multi_tables ? [
      aws_dynamodb_table.tenants[0].arn,
      aws_dynamodb_table.users[0].arn,
      aws_dynamodb_table.tenant_applications[0].arn,
      aws_dynamodb_table.permission_policies[0].arn,
      aws_dynamodb_table.user_preferences[0].arn,
      aws_dynamodb_table.email_accounts[0].arn,
      aws_dynamodb_table.email_messages[0].arn,
      aws_dynamodb_table.tasks[0].arn,
      aws_dynamodb_table.user_email_subscriptions[0].arn,
      aws_dynamodb_table.push_subscriptions[0].arn,
      aws_dynamodb_table.announcements[0].arn,
      aws_dynamodb_table.notices[0].arn,
      aws_dynamodb_table.rss_sources[0].arn,
      aws_dynamodb_table.rss_items[0].arn,
      aws_dynamodb_table.rss_drafts[0].arn,
      aws_dynamodb_table.rss_usage[0].arn,
    ] : []
  )
  dynamodb_resource_arns = concat(
    local.dynamodb_table_arns,
    [for arn in local.dynamodb_table_arns : "${arn}/index/*"]
  )
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
    resources = local.dynamodb_resource_arns
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
    effect  = "Allow"
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
  value       = local.table_name
  description = "Base name prefix for DynamoDB multi tables (e.g. aiagent-dev)."
}

output "dynamodb_legacy_single_table_name" {
  value       = var.keep_legacy_single_table ? aws_dynamodb_table.legacy["single"].name : null
  description = "Legacy single table name (<base>). Null when destroyed."
}

output "dynamodb_multi_table_names" {
  value = var.enable_multi_tables ? {
    tenants                  = aws_dynamodb_table.tenants[0].name
    users                    = aws_dynamodb_table.users[0].name
    tenant_applications      = aws_dynamodb_table.tenant_applications[0].name
    permission_policies      = aws_dynamodb_table.permission_policies[0].name
    user_preferences         = aws_dynamodb_table.user_preferences[0].name
    email_accounts           = aws_dynamodb_table.email_accounts[0].name
    email_messages           = aws_dynamodb_table.email_messages[0].name
    tasks                    = aws_dynamodb_table.tasks[0].name
    user_email_subscriptions = aws_dynamodb_table.user_email_subscriptions[0].name
    push_subscriptions       = aws_dynamodb_table.push_subscriptions[0].name
    announcements            = aws_dynamodb_table.announcements[0].name
    notices                  = aws_dynamodb_table.notices[0].name
  } : {}
  description = "Multi-table names for migration target"
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
  value       = local.table_name
  description = "Base name prefix for DynamoDB multi tables (backward compatible output)."
}
