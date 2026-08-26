#!/usr/bin/env bash
set -euo pipefail

: "${CYCLE_KEY:?CYCLE_KEY is required}"
: "${BEFORE_STATUS:?BEFORE_STATUS is required}"
: "${DIRECTOR_REPORT:?DIRECTOR_REPORT is required}"

definition="governance/RELEASE_DEFINITION.json"
status="docs/RELEASE_STATUS.json"
tasks="directives/TASKS.json"

for file in "$definition" "$status" "$tasks" "$BEFORE_STATUS" "$DIRECTOR_REPORT"; do
  test -s "$file"
done

jq -e '
  .schemaVersion == 1 and
  (.milestone | type == "string" and length > 0) and
  (.criteria | type == "array" and length > 0) and
  ([.criteria[].id] | length == (unique | length)) and
  all(.criteria[];
    (.id | type == "string" and test("^DRC-[0-9]{2}$")) and
    (.priority | type == "number") and
    (.allowedRoles | type == "array" and length > 0) and
    (.requiredEvidence | type == "array" and length > 0)
  )
' "$definition" >/dev/null

jq -e --slurpfile definition "$definition" '
  .schemaVersion == 1 and
  .milestone == $definition[0].milestone and
  (.governanceVersion | type == "string" and length > 0) and
  (.lastCycle | type == "string" and length > 0) and
  (.activeCriteria | type == "array" and length <= 2 and
    length == (unique | length)) and
  (.stalledCycles | type == "number" and floor == . and . >= 0 and . <= 2) and
  (.progressSummary | type == "string" and length > 0 and length <= 2000) and
  (.pendingArtifact == null or .pendingArtifact == "DRC-06") and
  (.blocker == null or
    (.blocker | type == "object" and
      (.reason | type == "string" and length > 0 and length <= 1000) and
      (.humanAction | type == "string" and length > 0 and length <= 1000))) and
  (.criteria | type == "array") and
  ([.criteria[].id] | sort) == ([$definition[0].criteria[].id] | sort) and
  all(.criteria[];
    (.status == "pending" or .status == "in_progress" or
      .status == "complete" or .status == "blocked") and
    (.evidence | type == "array" and length <= 100 and all(
      (.kind | type == "string" and length > 0 and length <= 50) and
      (.reference | type == "string" and length > 0 and length <= 1000) and
      (.cycle | type == "string" and length > 0 and length <= 100)
    )) and
    . as $current |
    ($definition[0].criteria[] | select(.id == $current.id)) as $criterion |
    ($current.status != "complete" or
      all($criterion.requiredEvidence[];
        . as $kind | ([$current.evidence[].kind] | index($kind)) != null))
  )
' "$status" >/dev/null

jq -e --slurpfile definition "$definition" '
  (.openFindings | type == "array" and length <= 200) and
  ([.openFindings[].id] | length == (unique | length)) and
  all(.openFindings[];
    . as $finding |
    (.id | type == "string" and length > 0 and length <= 100) and
    (.criterionId | type == "string" and
      any($definition[0].criteria[]; .id == $finding.criterionId)) and
    (.role == "mobile" or .role == "backend") and
    (.severity == "critical" or .severity == "high" or .severity == "medium" or
      .severity == "low" or .severity == "info") and
    (.mustFixBeforeRelease | type == "boolean") and
    (.status == "unresolved" or .status == "resolved" or
      .status == "deferred" or .status == "noted") and
    ((.status == "unresolved" or .status == "resolved") or
      .mustFixBeforeRelease == false) and
    (.requiredFix | type == "string" and length > 0 and length <= 2000)
  ) and
  . as $release |
  all(.criteria[];
    . as $criterion |
    $criterion.status != "complete" or
    ([ $release.openFindings[] |
       select(.criterionId == $criterion.id and .mustFixBeforeRelease == true and .status != "resolved") ] | length) == 0
  )
' "$status" >/dev/null

jq -e --slurpfile before "$BEFORE_STATUS" '
  def rank($value):
    if $value == "pending" then 0
    elif $value == "in_progress" or $value == "blocked" then 1
    elif $value == "complete" then 2
    else -1 end;
  all(.criteria[];
    . as $current |
    ($before[0].criteria[] | select(.id == $current.id)) as $old |
    rank($current.status) >= rank($old.status) and
    ($current.evidence | length) >= ($old.evidence | length)
  )
' "$status" >/dev/null

jq -e --slurpfile before "$BEFORE_STATUS" '
  . as $release |
  all($before[0].openFindings[]?;
    . as $old |
    any($release.openFindings[];
      .id == $old.id and
      .criterionId == $old.criterionId and
      .role == $old.role and
      .mustFixBeforeRelease == $old.mustFixBeforeRelease and
      .requiredFix == $old.requiredFix and
      (
        if $old.status == "resolved" then .status == "resolved"
        elif $old.status == "deferred" then (.status == "deferred" or .status == "resolved")
        elif $old.status == "noted" then (.status == "noted" or .status == "resolved")
        elif $old.status == "unresolved" then
          (.status == "unresolved" or .status == "resolved" or
            ($old.mustFixBeforeRelease == false and (.status == "deferred" or .status == "noted")))
        else false end
      )
    )
  )
' "$status" >/dev/null

jq -e --slurpfile status "$status" --slurpfile definition "$definition" '
  .schemaVersion == 1 and
  .milestone == $definition[0].milestone and
  (.activeCriteria | type == "array" and length <= 2 and
    length == (unique | length)) and
  (.assignments | type == "object")
' "$tasks" >/dev/null

for role in mobile backend; do
  jq -e --arg role "$role" '
    .assignments[$role] as $assignment |
    ($assignment | type == "object") and
    ($assignment.enabled | type == "boolean") and
    ($assignment.criterionId | type == "string" and length > 0) and
    ($assignment.objective | type == "string" and length > 0 and length <= 2000) and
    ($assignment.acceptance | type == "array" and length <= 20 and
      all(type == "string" and length > 0 and length <= 1000))
  ' "$tasks" >/dev/null
done

enabled_count=$(jq '[.assignments[] | select(.enabled == true)] | length' "$tasks")
(( enabled_count >= 0 && enabled_count <= 2 ))

enabled_criteria=$(jq -c '[.assignments[] | select(.enabled == true) | .criterionId] | unique | sort' "$tasks")
task_active=$(jq -c '.activeCriteria | sort' "$tasks")
test "$enabled_criteria" = "$task_active"
status_active=$(jq -c '.activeCriteria | sort' "$status")
test "$task_active" = "$status_active"

while IFS= read -r role; do
  criterion=$(jq -r --arg role "$role" '.assignments[$role].criterionId' "$tasks")
  jq -e --arg criterion "$criterion" '
    .activeCriteria | index($criterion) != null
  ' "$tasks" >/dev/null
  jq -e --arg criterion "$criterion" '
    any(.criteria[]; .id == $criterion and
      (.status == "pending" or .status == "in_progress"))
  ' "$status" >/dev/null
  jq -e --arg role "$role" --arg criterion "$criterion" '
    any(.criteria[]; .id == $criterion and
      (.allowedRoles | index($role) != null))
  ' "$definition" >/dev/null
  directive="directives/$(tr '[:lower:]' '[:upper:]' <<<"$role").md"
  grep -F "$criterion" "$directive" >/dev/null
done < <(jq -r '.assignments | to_entries[] | select(.value.enabled == true) | .key' "$tasks")

grep -F "mustFix" directives/AUDITOR.md >/dev/null
for criterion in $(jq -r '.activeCriteria[]' "$tasks"); do
  grep -F "$criterion" docs/NEXT_CYCLE.md >/dev/null
done

decision=$(jq -r '.decision' "$DIRECTOR_REPORT")
jq -e --arg cycle "$CYCLE_KEY" --slurpfile status "$status" '
  (.cycle | tostring) == $cycle and
  (.activeCriteria | sort) == ($status[0].activeCriteria | sort) and
  (.progressEvidence | type == "array" and length > 0 and length <= 50 and
    all(type == "string" and length > 0 and length <= 1000))
' "$DIRECTOR_REPORT" >/dev/null

test "$(jq -r '.lastCycle' "$status")" = "$CYCLE_KEY"

objective_progress=$(jq -n   --slurpfile before "$BEFORE_STATUS"   --slurpfile current "$status" '
    def rank($value):
      if $value == "pending" then 0
      elif $value == "in_progress" or $value == "blocked" then 1
      elif $value == "complete" then 2
      else -1 end;
    any($current[0].criteria[];
      . as $new |
      ($before[0].criteria[] | select(.id == $new.id)) as $old |
      rank($new.status) > rank($old.status) or
      ($new.evidence | length) > ($old.evidence | length)
    )
  ')

code_changed=false
if [[ -n "$(git status --porcelain -- app src tests functions/src functions/test   firestore.rules firestore.indexes.json storage.rules firebase.json)" ]]; then
  code_changed=true
fi

old_stalled=$(jq -r '.stalledCycles' "$BEFORE_STATUS")
new_stalled=$(jq -r '.stalledCycles' "$status")
if [[ "$objective_progress" == true || "$code_changed" == true ]]; then
  test "$new_stalled" -eq 0
else
  expected=$((old_stalled + 1))
  (( expected > 2 )) && expected=2
  test "$new_stalled" -eq "$expected"
fi

all_complete=$(jq 'all(.criteria[]; .status == "complete")' "$status")
pending_artifact_ready=$(jq '
  .pendingArtifact == "DRC-06" and
  (.activeCriteria | length) == 0 and
  all(.criteria[];
    if .id == "DRC-06" then
      .status == "in_progress" and any(.evidence[]; .kind == "audit")
    else
      .status == "complete"
    end)
' "$status")

if [[ "$decision" == continue ]]; then
  [[ "$all_complete" == false ]]
  test "$(jq -r '.pendingArtifact' "$status")" = null
  (( enabled_count >= 1 ))
elif [[ "$decision" == stop ]]; then
  [[ "$all_complete" == true || "$pending_artifact_ready" == true ]]
  if [[ "$pending_artifact_ready" == true ]]; then
    (( enabled_count == 0 ))
  fi
else
  echo "::error::Unknown Director decision: $decision"
  exit 1
fi
