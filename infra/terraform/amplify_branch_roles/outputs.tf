output "branch_name" {
  value       = local.branch_name
  description = "Managed Amplify branch name"
}

output "compute_role_name" {
  value       = aws_iam_role.compute.name
  description = "Amplify SSR compute role name"
}

output "compute_role_arn" {
  value       = aws_iam_role.compute.arn
  description = "Amplify SSR compute role ARN"
}

output "compute_policy_arn" {
  value       = aws_iam_policy.compute.arn
  description = "IAM policy ARN attached to compute role"
}


