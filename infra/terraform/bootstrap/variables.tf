variable "region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-1"
}

variable "project" {
  type        = string
  description = "Project name for tagging"
  default     = "aiagent"
}

variable "state_bucket_name" {
  type        = string
  description = "S3 bucket name for Terraform state"
}

variable "lock_table_name" {
  type        = string
  description = "DynamoDB table name for Terraform state lock"
}

variable "force_destroy" {
  type        = bool
  description = "Allow destroying the state bucket (use with caution)"
  default     = false
}
