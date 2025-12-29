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

locals {
  app_name = var.app_name != "" ? var.app_name : "${var.project}-${var.environment}-app"
  service_role_name =
    var.service_role_name != "" ? var.service_role_name : "${var.project}-${var.environment}-amplify-service"
  branch_name = var.branch_name != "" ? var.branch_name : var.environment
  branch_stage = var.branch_stage != ""
    ? var.branch_stage
    : (var.environment == "prod" ? "PRODUCTION" : var.environment == "staging" ? "BETA" : "DEVELOPMENT")
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
  app_env = merge(
    {
      AMPLIFY_REGION = var.region
    },
    var.environment_variables
  )
  branch_env = merge(
    {
      AMPLIFY_BRANCH = local.branch_name
    },
    var.branch_environment_variables
  )
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

resource "aws_iam_role" "amplify_service" {
  name               = local.service_role_name
  assume_role_policy = data.aws_iam_policy_document.assume_by_amplify.json
  tags               = local.tags
}

data "aws_iam_policy_document" "cognito_admin" {
  statement {
    effect = "Allow"
    actions = [
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminDeleteUser",
      "cognito-idp:AdminInitiateAuth",
      "cognito-idp:AdminSetUserPassword",
      "cognito-idp:InitiateAuth"
    ]
    resources = var.cognito_user_pool_arn != "" ? [var.cognito_user_pool_arn] : ["*"]
  }
}

resource "aws_iam_policy" "cognito_admin" {
  name        = "${var.project}-${var.environment}-amplify-cognito"
  description = "Cognito admin actions for Amplify app"
  policy      = data.aws_iam_policy_document.cognito_admin.json
  tags        = local.tags
}

resource "aws_iam_role_policy_attachment" "cognito_admin" {
  role       = aws_iam_role.amplify_service.name
  policy_arn = aws_iam_policy.cognito_admin.arn
}

resource "aws_iam_role_policy_attachment" "dynamodb" {
  count      = var.dynamodb_policy_arn != "" ? 1 : 0
  role       = aws_iam_role.amplify_service.name
  policy_arn = var.dynamodb_policy_arn
}

resource "aws_amplify_app" "main" {
  name                = local.app_name
  repository          = var.repository
  oauth_token         = var.oauth_token
  platform            = var.platform
  iam_service_role_arn = aws_iam_role.amplify_service.arn
  environment_variables = local.app_env
  tags                = local.tags
}

resource "aws_amplify_branch" "main" {
  count                 = var.create_branch ? 1 : 0
  app_id                = aws_amplify_app.main.id
  branch_name           = local.branch_name
  stage                 = local.branch_stage
  enable_auto_build     = var.enable_auto_build
  environment_variables = local.branch_env
}
