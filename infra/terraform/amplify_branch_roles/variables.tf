variable "region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-1"
}

variable "project" {
  type        = string
  description = "Project name prefix used for DynamoDB table name default ({project}-{environment})"
  default     = "aiagent"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g. staging/prod). Default branch_name is this value."
  default     = "staging"
}

variable "name_prefix" {
  type        = string
  description = "Name prefix for IAM role/policy (matches existing resources like ai-agent-*)"
  default     = "ai-agent"
}

variable "app_id" {
  type        = string
  description = "Existing Amplify app id"
  default     = "d3twt10pcsc29v"
}

variable "branch_name" {
  type        = string
  description = "Amplify branch name to manage (default: environment)"
  default     = ""
}

variable "compute_role_name" {
  type        = string
  description = "IAM role name for Amplify SSR compute role (optional override)"
  default     = ""
}

variable "dynamodb_table_name" {
  type        = string
  description = "DynamoDB table name (default: {project}-{environment})"
  default     = ""
}

variable "cognito_user_pool_id" {
  type        = string
  description = "Cognito User Pool ID used by this branch (e.g. ap-northeast-1_xxxxx)"
  # 現状の staging/prod は同じ UserPool を使っている
  default = "ap-northeast-1_zPoeP5qBQ"
}


