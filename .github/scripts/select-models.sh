#!/usr/bin/env bash
set -euo pipefail

probe_root="${1:?probe root required}"
out="${RUNNER_TEMP:?}/model-selection"
mkdir -p "$out"
selection="$out/selection.json"

mapfile -t probe_files < <(find "$probe_root" -type f -name probe.json -print | sort)
(( ${#probe_files[@]} > 0 ))

healthy=()
responsive=()
for file in "${probe_files[@]}"; do
  if jq -e '.healthy==true' "$file" >/dev/null; then
    model=$(jq -r '.model' "$file")
    elapsed=$(jq -r '.elapsedSeconds // 9999' "$file")
    healthy+=("$model")
    if [[ "$elapsed" =~ ^[0-9]+$ ]] && (( elapsed <= 30 )); then
      responsive+=("$model")
    fi
  fi
done

healthy_count=${#healthy[@]}
responsive_count=${#responsive[@]}
if (( healthy_count == 0 )); then
  jq -n --slurpfile probes <(jq -s '.' "${probe_files[@]}") \
    '{schemaVersion:1,healthyCount:0,responsiveCount:0,selected:null,probes:$probes[0]}' > "$selection"
  echo "::error::No free OpenCode model passed the real tool-call probe." >&2
  cat "$selection"
  exit 75
fi

contains() {
  local needle="$1"; shift
  local item
  for item in "$@"; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

is_healthy() { contains "$1" "${healthy[@]}"; }
is_responsive() { contains "$1" "${responsive[@]}"; }

coding_pref=(
  mimo-v2.5-free
  hy3-free
  big-pickle
  muse-spark-1.2-contributor-free
  nemotron-3-ultra-free
  nemotron-3.5-lightning-free
  deepseek-v4-flash-free
  north-mini-code-free
  laguna-s-2.1-free
  ling-3.0-flash-free
  ling-3.0-tiny-free
  x-preview-f-free
)

review_pref=(
  mimo-v2.5-free
  hy3-free
  muse-spark-1.2-contributor-free
  big-pickle
  nemotron-3-ultra-free
  nemotron-3.5-lightning-free
  laguna-s-2.1-free
  deepseek-v4-flash-free
  north-mini-code-free
  ling-3.0-flash-free
  ling-3.0-tiny-free
  x-preview-f-free
)

pick_from_tier() {
  local tier="$1" pref_name="$2"; shift 2
  local -n pref="$pref_name"
  local candidate excluded bad
  for candidate in "${pref[@]}"; do
    if [[ "$tier" == responsive ]]; then
      is_responsive "$candidate" || continue
    else
      is_healthy "$candidate" || continue
    fi
    bad=false
    for excluded in "$@"; do
      [[ -n "$excluded" && "$candidate" == "$excluded" ]] && bad=true
    done
    [[ "$bad" == false ]] && { printf '%s\n' "$candidate"; return 0; }
  done
  return 1
}

pick() {
  local pref_name="$1"; shift
  pick_from_tier responsive "$pref_name" "$@" && return 0
  pick_from_tier healthy "$pref_name" "$@" && return 0
  pick_from_tier responsive "$pref_name" && return 0
  pick_from_tier healthy "$pref_name" && return 0
  return 1
}

mobile=$(pick coding_pref)
backend=$(pick coding_pref "$mobile")
mobile_audit=$(pick review_pref "$mobile")
backend_audit=$(pick review_pref "$backend" "$mobile_audit")
director=$(pick review_pref)

jq -n \
  --arg mobile "$mobile" \
  --arg backend "$backend" \
  --arg mobileAudit "$mobile_audit" \
  --arg backendAudit "$backend_audit" \
  --arg director "$director" \
  --argjson healthyCount "$healthy_count" \
  --argjson responsiveCount "$responsive_count" \
  --slurpfile probes <(jq -s '.' "${probe_files[@]}") \
  '{schemaVersion:1,healthyCount:$healthyCount,responsiveCount:$responsiveCount,responsiveThresholdSeconds:30,selected:{mobile:$mobile,backend:$backend,mobileAudit:$mobileAudit,backendAudit:$backendAudit,director:$director},probes:$probes[0]}' \
  > "$selection"

echo "healthy_count=$healthy_count" >> "${GITHUB_OUTPUT:?}"
echo "mobile_model=opencode/$mobile" >> "$GITHUB_OUTPUT"
echo "backend_model=opencode/$backend" >> "$GITHUB_OUTPUT"
echo "mobile_audit_model=opencode/$mobile_audit" >> "$GITHUB_OUTPUT"
echo "backend_audit_model=opencode/$backend_audit" >> "$GITHUB_OUTPUT"
echo "director_model=opencode/$director" >> "$GITHUB_OUTPUT"

cat "$selection"
