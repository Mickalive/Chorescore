#!/usr/bin/env bash
set -euo pipefail

file="${1:?audit JSON path is required}"
cycle="${2:?cycle is required}"
role="${3:?role is required}"
round="${4:?round is required}"

[[ "$role" == mobile || "$role" == backend ]]
[[ "$round" == 1 || "$round" == 2 ]]
test -s "$file"

jq -e --arg cycle "$cycle" --arg role "$role" --argjson round "$round" '
  .schemaVersion == 1 and
  (.cycle | tostring) == $cycle and
  .role == $role and
  .round == $round and
  (.decision == "accept" or .decision == "repair" or .decision == "reject") and
  (.summary | type == "string" and length > 0 and length <= 1000) and
  (.findings | type == "array" and length <= 50 and all(
    (.id | type == "string" and length > 0 and length <= 100) and
    (.severity == "critical" or .severity == "high" or .severity == "medium" or
      .severity == "low" or .severity == "info") and
    (.path | type == "string" and length <= 500) and
    (.problem | type == "string" and length > 0 and length <= 2000) and
    (.evidence | type == "string" and length > 0 and length <= 2000) and
    (.mustFix | type == "boolean") and
    (.requiredFix | type == "string" and length > 0 and length <= 2000) and
    (.verification | type == "string" and length > 0 and length <= 2000)
  )) and
  (.checks | type == "array" and length <= 50 and
    all(type == "string" and length > 0 and length <= 1000)) and
  (
    (.decision == "accept" and all(.findings[]; .mustFix == false)) or
    ((.decision == "repair" or .decision == "reject") and
      any(.findings[]; .mustFix == true))
  )
' "$file" >/dev/null
