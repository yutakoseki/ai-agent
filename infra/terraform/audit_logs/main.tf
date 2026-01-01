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

variable "force_destroy" {
  type        = bool
  description = "Whether to allow force destroy the bucket (for dev)"
  default     = false
}

locals {
  bucket_name = "${var.project}-${var.environment}-audit-logs"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"
    Purpose     = "AuditLogs"
  }
}

resource "aws_s3_bucket" "audit_logs" {
  bucket        = local.bucket_name
  force_destroy = var.force_destroy
  tags          = local.tags
}

resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket                  = aws_s3_bucket.audit_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    id     = "transition-current-versions"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER_IR"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 2555 # 7 years
    }
  }

  rule {
    id     = "transition-noncurrent-versions"
    status = "Enabled"

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER_IR"
    }

    noncurrent_version_transition {
      noncurrent_days = 365
      storage_class   = "DEEP_ARCHIVE"
    }

    noncurrent_version_expiration {
      noncurrent_days = 2555
    }
  }
}

output "audit_logs_bucket_name" {
  value       = aws_s3_bucket.audit_logs.bucket
  description = "Audit logs bucket name"
}

output "audit_logs_bucket_arn" {
  value       = aws_s3_bucket.audit_logs.arn
  description = "Audit logs bucket ARN"
}


