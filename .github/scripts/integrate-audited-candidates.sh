#!/usr/bin/env bash
set -euo pipefail

: "${CYCLE_KEY:?CYCLE_KEY is required}"
recovery_cycle="${RECOVERY_CYCLE_KEY:-none}"
output_json="${TRUSTED_INTEGRATION_JSON:-${RUNNER_TEMP:?}/chorescore-trusted-integration.json}"
base_sha=$(git rev-parse HEAD)
entries='[]'

flag() {
  local name="$1"
  [[ "${!name:-false}" == true ]]
}

accepted_pair() {
  local cycle="$1" role="$2" original="$3" initial_dir="$4" repaired="$5" final_dir="$6"
  local original_flag="$7" initial_flag="$8" repaired_flag="$9" final_flag="${10}"
  local upper initial final decision
  upper=$(tr '[:lower:]' '[:upper:]' <<<"$role")
  initial="$initial_dir/reports/audits/CYCLE_${cycle}_${upper}.json"
  final="$final_dir/reports/audits/CYCLE_${cycle}_${upper}_FINAL.json"

  flag "$original_flag" && flag "$initial_flag" || return 1
  bash .github/scripts/validate-audit-json.sh "$initial" "$cycle" "$role" 1 || return 1
  decision=$(jq -r '.decision' "$initial")
  if [[ "$decision" == accept ]]; then
    printf '%s\t%s\t%s\t%s\n' "$original" "$initial" 1 "$cycle"
    return 0
  fi

  flag "$repaired_flag" && flag "$final_flag" || return 1
  bash .github/scripts/validate-audit-json.sh "$final" "$cycle" "$role" 2 || return 1
  [[ "$(jq -r '.decision' "$final")" == accept ]] || return 1
  printf '%s\t%s\t%s\t%s\n' "$repaired" "$final" 2 "$cycle"
}

select_pair() {
  local role="$1" result=""
  local upper
  upper=$(tr '[:lower:]' '[:upper:]' <<<"$role")

  result=$(accepted_pair "$CYCLE_KEY" "$role" \
    "/tmp/chorescore_${role}" "/tmp/chorescore_audit_${role}" \
    "/tmp/chorescore_${role}_repaired" "/tmp/chorescore_audit_${role}_final" \
    "${upper}_FOUND" "${upper}_AUDIT_FOUND" "${upper}_REPAIRED_FOUND" "${upper}_FINAL_AUDIT_FOUND" || true)
  if [[ -n "$result" ]]; then
    printf '%s\n' "$result"
    return 0
  fi

  [[ "$recovery_cycle" != none ]] || return 1
  accepted_pair "$recovery_cycle" "$role" \
    "/tmp/chorescore_recovery_${role}" "/tmp/chorescore_recovery_audit_${role}" \
    "/tmp/chorescore_recovery_${role}_repaired" "/tmp/chorescore_recovery_audit_${role}_final" \
    "RECOVERY_${upper}_FOUND" "RECOVERY_${upper}_AUDIT_FOUND" \
    "RECOVERY_${upper}_REPAIRED_FOUND" "RECOVERY_${upper}_FINAL_AUDIT_FOUND"
}

apply_role() {
  local role="$1" selected candidate_dir audit_file round source_cycle candidate_sha merge_base patch
  local paths=()
  selected=$(select_pair "$role" || true)
  if [[ -z "$selected" ]]; then
    entries=$(jq -c --arg role "$role" '. + [{role:$role, integrated:false, reason:"no-accepted-pair"}]' <<<"$entries")
    return 0
  fi

  IFS=$'\t' read -r candidate_dir audit_file round source_cycle <<<"$selected"
  candidate_sha=$(git -C "$candidate_dir" rev-parse HEAD)
  merge_base=$(git merge-base "$base_sha" "$candidate_sha")
  test -n "$merge_base"

  if [[ "$role" == mobile ]]; then
    paths=(app src tests)
  else
    paths=(functions/src functions/test docs/security firestore.rules firestore.indexes.json storage.rules firebase.json)
  fi

  while IFS= read -r changed; do
    [[ -z "$changed" ]] && continue
    if [[ "$role" == mobile ]]; then
      case "$changed" in app/*|src/*|tests/*) ;; *) echo "::error::Candidat mobile hors périmètre: $changed"; exit 1 ;; esac
    else
      case "$changed" in functions/src/*|functions/test/*|docs/security/*|firestore.rules|firestore.indexes.json|storage.rules|firebase.json) ;;
        *) echo "::error::Candidat backend hors périmètre: $changed"; exit 1 ;;
      esac
    fi
  done < <(git diff --name-only "$merge_base" "$candidate_sha")

  patch=$(mktemp)
  git diff --binary --full-index "$merge_base" "$candidate_sha" -- "${paths[@]}" >"$patch"
  if test -s "$patch"; then
    if ! git apply --3way --index "$patch"; then
      rm -f "$patch"
      echo "::error::Le delta audité $role ne s'applique pas proprement à l'état accepté." >&2
      exit 1
    fi
  fi
  rm -f "$patch"

  entries=$(jq -c \
    --arg role "$role" --arg sourceCycle "$source_cycle" --arg candidateSha "$candidate_sha" \
    --arg audit "$audit_file" --argjson round "$round" \
    '. + [{role:$role, integrated:true, sourceCycle:$sourceCycle, candidateSha:$candidateSha, audit:$audit, round:$round}]' \
    <<<"$entries")
}

apply_role mobile
apply_role backend

unexpected=0
while IFS= read -r path; do
  case "$path" in
    app/*|src/*|tests/*|functions/src/*|functions/test/*|docs/security/*|firestore.rules|firestore.indexes.json|storage.rules|firebase.json) ;;
    *) unexpected=1; echo "::error::Intégration de confiance hors périmètre: $path" ;;
  esac
done < <(git diff --cached --name-only)
test "$unexpected" -eq 0

mkdir -p "$(dirname "$output_json")"
jq -n --arg baseSha "$base_sha" --arg cycle "$CYCLE_KEY" --arg recovery "$recovery_cycle" \
  --argjson selections "$entries" \
  '{schemaVersion:1, cycle:$cycle, baseSha:$baseSha, recoveryCycle:$recovery, selections:$selections}' >"$output_json"
jq -e '.selections | type == "array" and length == 2' "$output_json" >/dev/null
