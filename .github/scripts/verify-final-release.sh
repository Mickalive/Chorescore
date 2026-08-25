#!/usr/bin/env bash
set -euo pipefail

status="docs/RELEASE_STATUS.json"
test -s "$status"

jq -e '
  all(.criteria[]; .status == "complete") and
  .pendingArtifact == null and
  (.activeCriteria | length) == 0 and
  all(.openFindings[]?; (.mustFixBeforeRelease != true) or .status == "resolved") and
  any(.criteria[]; .id == "DRC-06" and
    any(.evidence[]; .kind == "artifact") and
    any(.evidence[]; .kind == "runtime-smoke"))
' "$status" >/dev/null

reference=$(jq -r '.criteria[] | select(.id == "DRC-06") | .evidence[] | select(.kind == "artifact") | .reference' "$status" | tail -1)
report=${reference%% —*}
[[ "$report" == reports/artifacts/DEMO_APK_*.json ]]
test -s "$report"

jq -e '
  .schemaVersion == 1 and
  (.sourceSha | type == "string" and test("^[0-9a-f]{40}$")) and
  (.workflowRun | type == "string" and test("^[1-9][0-9]*$")) and
  (.artifactName == ("chorescore-demo-rc-" + .sourceSha)) and
  (.apkSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
  .installable == true and
  .standalone == true and
  .runtimeSmoke.apiLevel == 35 and
  .runtimeSmoke.networkDisabled == true and
  .runtimeSmoke.metroRequired == false and
  .runtimeSmoke.onboardingCompleted == true and
  .runtimeSmoke.timerPersistedAcrossRestart == true and
  .runtimeSmoke.coreNavigationVisited == true
' "$report" >/dev/null

source_sha=$(jq -r '.sourceSha' "$report")
git cat-file -e "$source_sha^{commit}"
git merge-base --is-ancestor "$source_sha" HEAD
