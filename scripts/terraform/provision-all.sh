#!/usr/bin/env bash
set -euo pipefail

environment="${1:-}"
action="${2:-apply}"

if [[ -z "$environment" ]]; then
  echo "Usage: $0 <environment> [plan|apply] [extra terraform args...]"
  exit 1
fi

case "$action" in
  plan|apply) ;;
  *)
    echo "Unsupported action: $action (use plan or apply)"
    exit 1
    ;;
esac

if [[ -z "${TF_STATE_BUCKET:-}" || -z "${TF_STATE_LOCK_TABLE:-}" ]]; then
  echo "TF_STATE_BUCKET and TF_STATE_LOCK_TABLE must be set."
  exit 1
fi

if [[ "${TF_BOOTSTRAP_STATE:-false}" == "true" ]]; then
  bootstrap_dir="infra/terraform/bootstrap"
  terraform -chdir="${bootstrap_dir}" init -backend=false
  bootstrap_approve=()
  if [[ "${action}" == "apply" && "${TF_AUTO_APPROVE:-}" == "true" ]]; then
    bootstrap_approve+=("-auto-approve")
  fi
  terraform -chdir="${bootstrap_dir}" "${action}" \
    -var "state_bucket_name=${TF_STATE_BUCKET}" \
    -var "lock_table_name=${TF_STATE_LOCK_TABLE}" \
    -var "region=${AWS_REGION:-ap-northeast-1}" \
    -var "project=${TF_PROJECT:-aiagent}" \
    "${bootstrap_approve[@]}"
fi

shift 2 || true

./scripts/terraform/provision.sh dynamodb "${environment}" "${action}" "$@"
./scripts/terraform/provision.sh cognito "${environment}" "${action}" "$@"
./scripts/terraform/provision.sh audit_logs "${environment}" "${action}" "$@"
