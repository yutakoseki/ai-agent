output "app_id" {
  value       = aws_amplify_app.main.id
  description = "Amplify App ID"
}

output "app_arn" {
  value       = aws_amplify_app.main.arn
  description = "Amplify App ARN"
}

output "default_domain" {
  value       = aws_amplify_app.main.default_domain
  description = "Amplify default domain"
}

output "service_role_arn" {
  value       = aws_iam_role.amplify_service.arn
  description = "Amplify service role ARN"
}

output "service_role_name" {
  value       = aws_iam_role.amplify_service.name
  description = "Amplify service role name"
}

output "branch_name" {
  value       = var.create_branch ? aws_amplify_branch.main[0].branch_name : null
  description = "Amplify branch name"
}
