terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    # TODO: state 用のバケットと DynamoDB ロックテーブルを環境別に指定する
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

