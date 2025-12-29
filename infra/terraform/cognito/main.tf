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

variable "cognito_allow_admin_create_user_only" {
  type        = bool
  description = "Allow admin-only user creation"
  default     = true
}

variable "cognito_mfa_configuration" {
  type        = string
  description = "MFA configuration (OFF/ON/OPTIONAL)"
  default     = "OPTIONAL"
}

variable "cognito_client_generate_secret" {
  type        = bool
  description = "Generate secret for app client"
  default     = false
}

variable "cognito_explicit_auth_flows" {
  type        = list(string)
  description = "Allowed explicit auth flows"
  default = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

variable "cognito_access_token_minutes" {
  type        = number
  description = "Access token validity in minutes"
  default     = 15
}

variable "cognito_id_token_minutes" {
  type        = number
  description = "ID token validity in minutes"
  default     = 15
}

variable "cognito_refresh_token_days" {
  type        = number
  description = "Refresh token validity in days"
  default     = 30
}

locals {
  user_pool_name = "${var.project}-${var.environment}-users"
  client_name    = "${var.project}-${var.environment}-app-client"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_cognito_user_pool" "main" {
  name                     = local.user_pool_name
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = var.cognito_mfa_configuration

  admin_create_user_config {
    allow_admin_create_user_only = var.cognito_allow_admin_create_user_only
  }

  dynamic "software_token_mfa_configuration" {
    for_each = var.cognito_mfa_configuration == "OFF" ? [] : [1]
    content {
      enabled = true
    }
  }

  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = local.tags
}

resource "aws_cognito_user_pool_client" "app" {
  name                         = local.client_name
  user_pool_id                 = aws_cognito_user_pool.main.id
  generate_secret              = var.cognito_client_generate_secret
  explicit_auth_flows          = var.cognito_explicit_auth_flows
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation      = true
  supported_identity_providers = ["COGNITO"]

  access_token_validity  = var.cognito_access_token_minutes
  id_token_validity      = var.cognito_id_token_minutes
  refresh_token_validity = var.cognito_refresh_token_days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

}

output "user_pool_id" {
  value       = aws_cognito_user_pool.main.id
  description = "Cognito User Pool ID"
}

output "user_pool_arn" {
  value       = aws_cognito_user_pool.main.arn
  description = "Cognito User Pool ARN"
}

output "app_client_id" {
  value       = aws_cognito_user_pool_client.app.id
  description = "Cognito App Client ID"
}

output "app_client_secret" {
  value       = aws_cognito_user_pool_client.app.client_secret
  description = "Cognito App Client Secret"
  sensitive   = true
}
