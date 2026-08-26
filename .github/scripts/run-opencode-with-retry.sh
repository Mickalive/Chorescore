#!/usr/bin/env bash

set -euo pipefail

max_attempts="${OPENCODE_MAX_ATTEMPTS:-3}"
retry_delay="${OPENCODE_RETRY_DELAY_SECONDS:-300}"
attempt_timeout="${OPENCODE_ATTEMPT_TIMEOUT_SECONDS:-2400}"
label="${OPENCODE_RETRY_LABEL:-agent}"

[[ "$max_attempts" =~ ^([1-9]|1[0-2])$ ]]
[[ "$retry_delay" =~ ^[0-9]+$ ]]
[[ "$attempt_timeout" =~ ^[0-9]+$ ]]
(( retry_delay >= 30 && retry_delay <= 900 ))
(( attempt_timeout >= 600 && attempt_timeout <= 7200 ))
(( $# > 0 ))

log_file=$(mktemp "${RUNNER_TEMP:?}/opencode-${label}.XXXXXX.log")
trap 'rm -f "$log_file"' EXIT

validate_director_audit() {
  local file="$1" role="$2" round="$3"
  bash .github/scripts/validate-audit-json.sh "$file" "${CYCLE_KEY:?}" "$role" "$round"
}

if [[ "$label" == director ]]; then
  for role in mobile backend; do
    role_upper=$(tr '[:lower:]' '[:upper:]' <<<"$role")
    if [[ "$role" == mobile ]]; then
      found="${MOBILE_FOUND:-false}"
      repaired_found="${MOBILE_REPAIRED_FOUND:-false}"
    else
      found="${BACKEND_FOUND:-false}"
      repaired_found="${BACKEND_REPAIRED_FOUND:-false}"
    fi
    [[ "$found" == true ]] || continue

    initial="/tmp/chorescore_audit_${role}/reports/audits/CYCLE_${CYCLE_KEY}_${role_upper}.json"
    if ! validate_director_audit "$initial" "$role" 1; then
      echo "CHORESCORE_OPENCODE_FAILURE_KIND=transient label=director reason=audit-evidence-pending" >&2
      echo "::error::Audit structuré $role absent ou invalide; le directeur attend une nouvelle tentative d'audit." >&2
      exit 75
    fi

    decision=$(jq -r '.decision' "$initial")
    if [[ "$decision" != accept ]]; then
      final="/tmp/chorescore_audit_${role}_final/reports/audits/CYCLE_${CYCLE_KEY}_${role_upper}_FINAL.json"
      if [[ "$repaired_found" != true ]] || ! validate_director_audit "$final" "$role" 2; then
        echo "CHORESCORE_OPENCODE_FAILURE_KIND=transient label=director reason=correction-evidence-pending" >&2
        echo "::error::Correction ou second audit $role incomplet; le directeur reste bloqué." >&2
        exit 75
      fi
    fi
  done
fi

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  : > "$log_file"
  echo "OpenCode ${label}: tentative ${attempt}/${max_attempts}."

  set +e
  timeout --signal=TERM --kill-after=30s "$attempt_timeout" "$@" 2>&1 | tee "$log_file"
  command_status=${PIPESTATUS[0]}
  set -e

  if (( command_status == 0 )); then
    exit 0
  fi

  if (( command_status == 124 || command_status == 137 )); then
    echo "OpenCode ${label}: attempt timed out after ${attempt_timeout}s." | tee -a "$log_file" >&2
  fi

  if ! grep -Eqi \
    'network_error|network error|unexpected server error|internal server error|temporarily unavailable|endpoint is unavailable|service unavailable|bad gateway|gateway timeout|too many requests|upstream request failed|provider[^[:cntrl:]]*unavailable|connection (reset|closed|refused)|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timed out|timeout|rate[_ -]?limit|HTTP[^0-9]*(429|500|502|503|504)' \
    "$log_file"; then
    echo "CHORESCORE_OPENCODE_FAILURE_KIND=permanent label=${label} status=${command_status}" >&2
    echo "::error::OpenCode ${label} a échoué pour une cause non transitoire; aucun nouvel essai automatique." >&2
    exit "$command_status"
  fi

  if (( attempt == max_attempts )); then
    echo "CHORESCORE_OPENCODE_FAILURE_KIND=transient label=${label} attempts=${max_attempts}" >&2
    echo "::error::OpenCode ${label} reste indisponible après ${max_attempts} tentatives espacées; un nouveau cycle de récupération reprendra les snapshots conservés." >&2
    exit 75
  fi

  echo "::warning::Panne fournisseur transitoire pour ${label}; nouvelle tentative dans ${retry_delay}s." >&2
  sleep "$retry_delay"
done
