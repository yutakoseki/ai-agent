terraform {
  required_version = ">= 1.6.0"

  # local backend なら追加設定なしで plan 可能。
  # 本番運用では S3 backend に切り替え、bucket / dynamodb_table を -backend-config で指定する。
  backend "local" {
    path = "terraform.tfstate"
  }

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

