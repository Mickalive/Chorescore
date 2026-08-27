#!/usr/bin/env bash
set -euo pipefail

file="${1:?audit JSON required}"
cycle="${2:?cycle required}"
role="${3:?role required}"
round="${4:-1}"

test -s "$file"

jq -e --arg cycle "$cycle" --arg role "$role" --argjson round "$round" '
  .schemaVersion == 1 and
  (.cycle | tostring) == $cycle and
  .role == $role and
  .round == $round and
  (.decision == "accept" or .decision == "repair" or .decision == "reject") and
  (.summary | type == "string" and length > 0) and
  (.findings | type == "array") and
  all(.findings[];
    (.path | type == "string") and
    (.problem | type == "string" and length > 0) and
    (.evidence | type == "string" and length > 0) and
    (.mustFix | type == "boolean") and
    (.requiredFix | type == "string") and
    (.verification | type == "string" and length > 0)
  ) and
  (.checks | type == "array") and
  all(.checks[]; type == "string" and length > 0) and
  (if .decision == "accept" then all(.findings[]; .mustFix == false)
   else any(.findings[]; .mustFix == true)
   end)
' "$file" >/dev/null
