#!/usr/bin/env bash
set -euo pipefail

module="${1:-}"
environment="${2:-}"
action="${3:-apply}"

if [[ -z "$module" || -z "$environment" ]]; then
  echo "Usage: $0 <dynamodb|cognito|amplify|audit_logs> <environment> [plan|apply] [extra terraform args...]"
  exit 1
fi

case "$module" in
  dynamodb|cognito|amplify|audit_logs) ;;
  *)
    echo "Unsupported module: $module"
    exit 1
    ;;
esac

case "$action" in
  plan|apply) ;;
  *)
    echo "Unsupported action: $action (use plan or apply)"
    exit 1
    ;;
esac

tf_project="${TF_PROJECT:-aiagent}"
aws_region="${AWS_REGION:-ap-northeast-1}"
tf_state_bucket="${TF_STATE_BUCKET:-}"
tf_state_lock_table="${TF_STATE_LOCK_TABLE:-}"

if [[ -z "$tf_state_bucket" || -z "$tf_state_lock_table" ]]; then
  echo "TF_STATE_BUCKET and TF_STATE_LOCK_TABLE must be set."
  exit 1
fi

module_dir="infra/terraform/${module}"

terraform -chdir="${module_dir}" init \
  -backend-config="bucket=${tf_state_bucket}" \
  -backend-config="region=${aws_region}" \
  -backend-config="dynamodb_table=${tf_state_lock_table}" \
  -backend-config="encrypt=true" \
  -backend-config="key=terraform.tfstate" \
  -backend-config="workspace_key_prefix=${tf_project}/${module}"

if ! terraform -chdir="${module_dir}" workspace select "${environment}"; then
  terraform -chdir="${module_dir}" workspace new "${environment}"
fi

shift 3 || true

auto_approve=()
if [[ "${action}" == "apply" && "${TF_AUTO_APPROVE:-}" == "true" ]]; then
  auto_approve+=("-auto-approve")
fi

terraform -chdir="${module_dir}" "${action}" \
  -var "project=${tf_project}" \
  -var "environment=${environment}" \
  "${auto_approve[@]}" \
  "$@"
