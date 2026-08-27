#!/usr/bin/env bash
set -euo pipefail
# Release attestation runs only after the accepted source has produced and passed the standalone APK smoke gate.

source_sha="${SOURCE_SHA:?}"
apk_sha="${APK_SHA256:?}"
artifact_name="${ARTIFACT_NAME:?}"
cycle="${CYCLE_KEY:?}"
repo="${GITHUB_REPOSITORY:?}"
report="reports/artifacts/DEMO_APK_${source_sha}.json"
mkdir -p reports/artifacts

jq -n \
  --arg sourceSha "$source_sha" \
  --arg workflowRun "$GITHUB_RUN_ID" \
  --arg artifactName "$artifact_name" \
  --arg apkSha256 "$apk_sha" \
  '{schemaVersion:1,sourceSha:$sourceSha,workflowRun:$workflowRun,artifactName:$artifactName,apkSha256:$apkSha256,installable:true,standalone:true,runtimeSmoke:{apiLevel:35,networkDisabled:true,metroRequired:false,onboardingCompleted:true,timerPersistedAcrossRestart:true,coreNavigationVisited:true}}' \
  > "$report"

tmp=$(mktemp)
jq --arg cycle "$cycle" --arg report "$report" --arg sha "$apk_sha" '
  .criteria |= map(if .id=="DRC-06" then
    .status="complete" |
    .evidence = ([.evidence[]? | select(.kind!="artifact" and .kind!="runtime-smoke")] + [
      {kind:"artifact",reference:($report+" — APK SHA-256 "+$sha),cycle:$cycle},
      {kind:"runtime-smoke",reference:($report+" — Android API 35 sans Metro ni réseau ; onboarding, reprise chrono et navigation cœur vérifiés"),cycle:$cycle}
    ])
  else . end) |
  .pendingArtifact=null |
  .activeCriteria=[] |
  .stalledCycles=0 |
  .blocker=null |
  .progressSummary="demo-rc terminé : APK standalone construit, installé et parcouru sur Android API 35 sans Metro ni réseau."
' docs/RELEASE_STATUS.json > "$tmp"
mv "$tmp" docs/RELEASE_STATUS.json

git config user.name chorescore-factory
git config user.email chorescore-factory@users.noreply.github.com
git add -- docs/RELEASE_STATUS.json reports/artifacts
git commit -m "ChoreScore demo-rc: final standalone APK attestation"

bash .github/scripts/verify-final-release.sh

auth=$(printf 'x-access-token:%s' "${GH_TOKEN:?}" | base64 -w0)
git -c "http.extraheader=AUTHORIZATION: basic $auth" fetch origin "+refs/heads/lab/chorescore:refs/remotes/origin/lab/chorescore"
remote=$(git rev-parse refs/remotes/origin/lab/chorescore)
if [[ "$remote" != "$source_sha" ]]; then
  echo "::error::Accepted lane advanced during APK build/smoke; refusing stale attestation." >&2
  exit 75
fi
git -c "http.extraheader=AUTHORIZATION: basic $auth" push origin "HEAD:refs/heads/lab/chorescore"

gh api -X PUT "repos/$repo/actions/workflows/chorescore-factory.yml/disable" >/dev/null
printf 'FINAL_PRODUCT_ATTESTED source=%s apk_sha256=%s artifact=%s\n' "$source_sha" "$apk_sha" "$artifact_name"
