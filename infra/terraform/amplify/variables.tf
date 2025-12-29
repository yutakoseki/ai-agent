variable "project" {
  type        = string
  description = "Project name prefix for resources"
  default     = "aiagent"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g. dev/staging/prod)"
  default     = "dev"
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-1"
}

variable "app_name" {
  type        = string
  description = "Amplify app name (default: {project}-{environment}-app)"
  default     = ""
}

variable "service_role_name" {
  type        = string
  description = "IAM role name for Amplify service role"
  default     = ""
}

variable "repository" {
  type        = string
  description = "Repository URL for the Amplify app"
}

variable "oauth_token" {
  type        = string
  description = "OAuth token for repository provider"
  sensitive   = true
}

variable "platform" {
  type        = string
  description = "Amplify platform"
  default     = "WEB_COMPUTE"
}

variable "environment_variables" {
  type        = map(string)
  description = "Environment variables set on Amplify app"
  default     = {}
}

variable "branch_environment_variables" {
  type        = map(string)
  description = "Environment variables set on Amplify branch"
  default     = {}
}

variable "branch_name" {
  type        = string
  description = "Amplify branch name"
  default     = ""
}

variable "branch_stage" {
  type        = string
  description = "Amplify branch stage (DEVELOPMENT/BETA/PRODUCTION)"
  default     = ""
}

variable "enable_auto_build" {
  type        = bool
  description = "Enable auto build on push"
  default     = true
}

variable "create_branch" {
  type        = bool
  description = "Create an Amplify branch resource"
  default     = true
}

variable "dynamodb_policy_arn" {
  type        = string
  description = "Attach existing DynamoDB policy to Amplify role"
  default     = ""
}

variable "cognito_user_pool_arn" {
  type        = string
  description = "Cognito User Pool ARN for policy scoping"
  default     = ""
}
