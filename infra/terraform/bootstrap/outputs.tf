output "state_bucket_name" {
  value       = aws_s3_bucket.state.bucket
  description = "Terraform state bucket name"
}

output "lock_table_name" {
  value       = aws_dynamodb_table.lock.name
  description = "Terraform state lock table name"
}
