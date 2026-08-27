#!/usr/bin/env bash
set -euo pipefail

probe_root="${1:?probe root required}"
out="${RUNNER_TEMP:?}/model-selection"
mkdir -p "$out"
selection="$out/selection.json"

mapfile -t probe_files < <(find "$probe_root" -type f -name probe.json -print | sort)
(( ${#probe_files[@]} > 0 ))

healthy=()
for file in "${probe_files[@]}"; do
  if jq -e '.healthy==true' "$file" >/dev/null; then
    healthy+=("$(jq -r '.model' "$file")")
  fi
done

healthy_count=${#healthy[@]}
if (( healthy_count == 0 )); then
  jq -n --slurpfile probes <(jq -s '.' "${probe_files[@]}") \
    '{schemaVersion:1,healthyCount:0,selected:null,probes:$probes[0]}' > "$selection"
  echo "::error::No free OpenCode model passed the real tool-call probe." >&2
  cat "$selection"
  exit 75
fi

is_healthy() {
  local needle="$1" item
  for item in "${healthy[@]}"; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

coding_pref=(
  deepseek-v4-flash-free
  north-mini-code-free
  laguna-s-2.1-free
  nemotron-3.5-lightning-free
  mimo-v2.5-free
  nemotron-3-ultra-free
  hy3-free
  ling-3.0-flash-free
  ling-3.0-tiny-free
  big-pickle
  muse-spark-1.2-contributor-free
  x-preview-f-free
)

review_pref=(
  laguna-s-2.1-free
  deepseek-v4-flash-free
  mimo-v2.5-free
  nemotron-3.5-lightning-free
  nemotron-3-ultra-free
  north-mini-code-free
  hy3-free
  ling-3.0-flash-free
  ling-3.0-tiny-free
  big-pickle
  muse-spark-1.2-contributor-free
  x-preview-f-free
)

pick() {
  local pref_name="$1"; shift
  local -n pref="$pref_name"
  local candidate excluded bad
  for candidate in "${pref[@]}"; do
    is_healthy "$candidate" || continue
    bad=false
    for excluded in "$@"; do
      [[ -n "$excluded" && "$candidate" == "$excluded" ]] && bad=true
    done
    [[ "$bad" == false ]] && { printf '%s\n' "$candidate"; return 0; }
  done
  for candidate in "${pref[@]}"; do
    is_healthy "$candidate" && { printf '%s\n' "$candidate"; return 0; }
  done
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
  --slurpfile probes <(jq -s '.' "${probe_files[@]}") \
  '{schemaVersion:1,healthyCount:$healthyCount,selected:{mobile:$mobile,backend:$backend,mobileAudit:$mobileAudit,backendAudit:$backendAudit,director:$director},probes:$probes[0]}' \
  > "$selection"

echo "healthy_count=$healthy_count" >> "${GITHUB_OUTPUT:?}"
echo "mobile_model=opencode/$mobile" >> "$GITHUB_OUTPUT"
echo "backend_model=opencode/$backend" >> "$GITHUB_OUTPUT"
echo "mobile_audit_model=opencode/$mobile_audit" >> "$GITHUB_OUTPUT"
echo "backend_audit_model=opencode/$backend_audit" >> "$GITHUB_OUTPUT"
echo "director_model=opencode/$director" >> "$GITHUB_OUTPUT"

cat "$selection"
