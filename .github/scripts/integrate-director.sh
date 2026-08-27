#!/usr/bin/env bash
set -euo pipefail

cycle="${CYCLE_KEY:?}"
base_sha="${ACCEPTED_SHA:?}"
mkdir -p reports/audits reports/director
integration_file="${RUNNER_TEMP:?}/integration.json"
printf '{"schemaVersion":1,"cycle":"%s","baseSha":"%s","roles":{}}\n' "$cycle" "$base_sha" > "$integration_file"

set_role_manifest() {
  local role="$1" status="$2" decision="$3" detail="$4"
  local tmp
  tmp=$(mktemp)
  jq --arg role "$role" --arg status "$status" --arg decision "$decision" --arg detail "$detail" \
    '.roles[$role]={status:$status,auditDecision:$decision,detail:$detail}' "$integration_file" > "$tmp"
  mv "$tmp" "$integration_file"
}

integrate_role() {
  local role="$1" candidate_result="$2" audit_result="$3"
  local enabled candidate_dir audit_dir report decision
  enabled=$(jq -r --arg role "$role" '.assignments[$role].enabled' directives/TASKS.json)
  if [[ "$enabled" != true ]]; then
    set_role_manifest "$role" "disabled" "none" "role disabled by current task state"
    return 0
  fi
  if [[ "$candidate_result" != success ]]; then
    set_role_manifest "$role" "candidate-unavailable" "none" "candidate job result: $candidate_result"
    return 0
  fi
  if [[ "$audit_result" != success ]]; then
    set_role_manifest "$role" "audit-unavailable" "none" "audit job result: $audit_result"
    return 0
  fi

  candidate_dir="/tmp/factory/candidate-$role"
  audit_dir="/tmp/factory/audit-$role"
  test -s "$candidate_dir/candidate.patch"
  report=$(find "$audit_dir" -maxdepth 1 -type f -name '*.json' | head -1)
  test -n "$report" && test -s "$report"
  bash .github/scripts/validate-audit-json.sh "$report" "$cycle" "$role" 1
  cp "$audit_dir"/*.json "$audit_dir"/*.md reports/audits/
  git add -- reports/audits
  decision=$(jq -r '.decision' "$report")

  if [[ "$decision" == accept ]]; then
    git apply --check "$candidate_dir/candidate.patch"
    git apply --index "$candidate_dir/candidate.patch"
    set_role_manifest "$role" "integrated" "$decision" "accepted audited patch applied"
  else
    set_role_manifest "$role" "not-integrated" "$decision" "audit requires repair/rejection; report persisted"
  fi
}

integrate_role mobile "${MOBILE_CANDIDATE_RESULT:-skipped}" "${MOBILE_AUDIT_RESULT:-skipped}"
integrate_role backend "${BACKEND_CANDIDATE_RESULT:-skipped}" "${BACKEND_AUDIT_RESULT:-skipped}"

npm run check
npx --no-install expo export --platform android --output-dir "$RUNNER_TEMP/chorescore-android-export"
npm --prefix functions run check
npm audit --omit=dev --audit-level=high
npm --prefix functions audit --omit=dev --audit-level=high

git config user.name chorescore-factory
git config user.email chorescore-factory@users.noreply.github.com
auth=$(printf 'x-access-token:%s' "${GH_TOKEN:?}" | base64 -w0)
git -c "http.extraheader=AUTHORIZATION: basic $auth" fetch origin "+refs/heads/lab/chorescore:refs/remotes/origin/lab/chorescore"
remote_before=$(git rev-parse refs/remotes/origin/lab/chorescore)
if [[ "$remote_before" != "$base_sha" ]]; then
  echo "::error::Accepted lane advanced from $base_sha to $remote_before; refusing stale integration." >&2
  exit 75
fi

if ! git diff --cached --quiet; then
  git commit -m "ChoreScore factory $cycle: independently audited product delta"
  git -c "http.extraheader=AUTHORIZATION: basic $auth" push origin "HEAD:refs/heads/lab/chorescore"
fi
product_sha=$(git rev-parse HEAD)
cp docs/RELEASE_STATUS.json "$RUNNER_TEMP/release-before-director.json"

manifest=$(jq -c . "$integration_file")
OPENCODE_RETRY_LABEL=director \
  bash .github/scripts/run-ox.sh \
  opencode run --model "${OX_MODEL:?}" --agent cycle-director \
  "You are ChoreScore Release Director for factory cycle $cycle. Read MAIN_PROMPT.md, governance/roles/RELEASE_DIRECTOR.md, governance/RELEASE_DEFINITION.json, directives/DIRECTOR.md, docs/RELEASE_STATUS.json, directives/TASKS.json, docs/NEXT_CYCLE.md and all current audit reports. Trusted integration manifest: $manifest. Product code and audit reports have already been persisted by the trusted shell. Never edit product code, docs/security, workflows, governance, agents, dependencies or lockfiles. Update only directives/TASKS.json, directives/MOBILE.md, directives/BACKEND.md, directives/AUDITOR.md, docs/NEXT_CYCLE.md, docs/RELEASE_STATUS.json and reports/director/RUN_${cycle}.md + JSON. Preserve every completed criterion and its evidence. For repair/reject audits, make the requiredFix the first bounded task for that role. DRC-05 completes only after its unresolved release-blocking accessibility findings are resolved with tests and accepted audit evidence. DRC-07 completes only after accurate security/public documentation is present with accepted audit evidence. When DRC-05 and DRC-07 are complete and DRC-06 lacks accepted audit evidence, assign the mobile role a bounded DRC-06 source-readiness audit task; do not build the APK yourself. When DRC-06 has accepted audit evidence and every other criterion is complete, set DRC-06 status to in_progress, pendingArtifact to 'DRC-06', activeCriteria to [], disable both code roles, and set report decision='stop'. Otherwise keep at least one useful local task active and report decision='continue'. Stagnation, Ox/provider failure, absent candidate or negative audit never means final completion."

git add -A
mapfile -d '' director_changed < <(git diff --cached --name-only -z HEAD)
for path in "${director_changed[@]}"; do
  case "$path" in
    directives/TASKS.json|directives/MOBILE.md|directives/BACKEND.md|directives/AUDITOR.md|docs/NEXT_CYCLE.md|docs/RELEASE_STATUS.json|reports/director/*) ;;
    *) echo "::error::Director changed forbidden path: $path" >&2; exit 20 ;;
  esac
done

report="reports/director/RUN_${cycle}.json"
test -s "$report"
test -s "reports/director/RUN_${cycle}.md"
jq -e --arg cycle "$cycle" '
  .schemaVersion==1 and (.cycle|tostring)==$cycle and
  (.decision=="continue" or .decision=="stop") and
  (.reason|type=="string" and length>0) and
  (.progressEvidence|type=="array")
' "$report" >/dev/null

jq -e -n --slurpfile before "$RUNNER_TEMP/release-before-director.json" --slurpfile after docs/RELEASE_STATUS.json '
  all($before[0].criteria[] | select(.status=="complete");
    .id as $id | (.evidence|length) as $n |
    any($after[0].criteria[]; .id==$id and .status=="complete" and (.evidence|length) >= $n)
  )
' >/dev/null

jq -e '
  .schemaVersion==1 and .milestone=="demo-rc" and
  ([.criteria[].id] | sort) == (["DRC-01","DRC-02","DRC-03","DRC-04","DRC-05","DRC-06","DRC-07"] | sort) and
  (.pendingArtifact==null or .pendingArtifact=="DRC-06") and
  (.criteria[] | select(.id=="DRC-06") | .status != "complete")
' docs/RELEASE_STATUS.json >/dev/null

pending=$(jq -r '.pendingArtifact=="DRC-06"' docs/RELEASE_STATUS.json)
if [[ "$pending" == true ]]; then
  jq -e '
    all(.criteria[]; if .id=="DRC-06" then .status=="in_progress" and any(.evidence[]?; .kind=="audit") else .status=="complete" end) and
    (.activeCriteria|length)==0
  ' docs/RELEASE_STATUS.json >/dev/null
  jq -e '.assignments.mobile.enabled==false and .assignments.backend.enabled==false' directives/TASKS.json >/dev/null
  jq -e '.decision=="stop"' "$report" >/dev/null
else
  jq -e '(.activeCriteria|length)>=1' docs/RELEASE_STATUS.json >/dev/null
  jq -e '(.assignments.mobile.enabled==true or .assignments.backend.enabled==true)' directives/TASKS.json >/dev/null
  jq -e '.decision=="continue"' "$report" >/dev/null
fi

git -c "http.extraheader=AUTHORIZATION: basic $auth" fetch origin "+refs/heads/lab/chorescore:refs/remotes/origin/lab/chorescore"
remote_after_product=$(git rev-parse refs/remotes/origin/lab/chorescore)
if [[ "$remote_after_product" != "$product_sha" ]]; then
  echo "::error::Accepted lane advanced during Director; refusing stale state update." >&2
  exit 75
fi

if ! git diff --cached --quiet; then
  git commit -m "ChoreScore factory $cycle: release director state"
  git -c "http.extraheader=AUTHORIZATION: basic $auth" push origin "HEAD:refs/heads/lab/chorescore"
fi
accepted_sha=$(git rev-parse HEAD)

echo "accepted_sha=$accepted_sha" >> "${GITHUB_OUTPUT:?}"
echo "pending_artifact=$pending" >> "$GITHUB_OUTPUT"
