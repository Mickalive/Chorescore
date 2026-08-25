#!/usr/bin/env bash

set -euo pipefail

repository="${GITHUB_REPOSITORY:?}"
workflow="${CHORESCORE_LOOP_WORKFLOW:-chorescore-loop.yml}"
summary_file="${GITHUB_STEP_SUMMARY:-/dev/null}"

list_runs() {
  gh run list --repo "$repository" --workflow "$workflow" --limit 30 \
    --json databaseId,status,conclusion,createdAt,url
}

runs=$(list_runs)
active=$(jq -c '[.[] | select(.status != "completed")] | sort_by(.createdAt) | last // empty' <<<"$runs")
if [[ -n "$active" ]]; then
  active_url=$(jq -r '.url' <<<"$active")
  printf '### Continuité ChoreScore\n\nBoucle déjà active : %s\n' "$active_url" >>"$summary_file"
  exit 0
fi

# A completed release is terminal only when its committed APK attestation is
# internally coherent. A status flag alone is not evidence.
release_status=$(gh api "repos/$repository/contents/docs/RELEASE_STATUS.json?ref=lab%2Fchorescore" \
  --jq '.content' 2>/dev/null | tr -d '\n' | base64 --decode 2>/dev/null || true)
release_complete=false
if [[ -n "$release_status" ]] && jq -e '
  (.criteria | type == "array" and length > 0) and
  all(.criteria[]; .status == "complete") and
  .pendingArtifact == null and
  (.activeCriteria | length) == 0 and
  all(.openFindings[]?; (.mustFixBeforeRelease != true) or .status == "resolved") and
  any(.criteria[]; .id == "DRC-06" and
    any(.evidence[]; .kind == "artifact") and
    any(.evidence[]; .kind == "runtime-smoke"))
' <<<"$release_status" >/dev/null 2>&1; then
  reference=$(jq -r '.criteria[] | select(.id == "DRC-06") | .evidence[] | select(.kind == "artifact") | .reference' <<<"$release_status" | tail -1)
  report=${reference%% —*}
  if [[ "$report" == reports/artifacts/DEMO_APK_*.json ]]; then
    artifact_report=$(gh api "repos/$repository/contents/$report?ref=lab%2Fchorescore" \
      --jq '.content' 2>/dev/null | tr -d '\n' | base64 --decode 2>/dev/null || true)
    if jq -e '
      .schemaVersion == 1 and
      (.sourceSha | type == "string" and test("^[0-9a-f]{40}$")) and
      (.workflowRun | type == "string" and test("^[1-9][0-9]*$")) and
      (.artifactName == ("chorescore-demo-rc-" + .sourceSha)) and
      (.apkSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
      .installable == true and .standalone == true and
      .runtimeSmoke.onboardingCompleted == true and
      .runtimeSmoke.timerPersistedAcrossRestart == true and
      .runtimeSmoke.coreNavigationVisited == true
    ' <<<"$artifact_report" >/dev/null 2>&1; then
      release_complete=true
    fi
  fi
fi

if [[ "$release_complete" == true ]]; then
  printf '### Continuité ChoreScore\n\nRelease complète et attestée ; aucune relance.\n' >>"$summary_file"
  exit 0
fi

latest=$(jq -c '[.[] | select(.status == "completed")] | sort_by(.createdAt) | last // empty' <<<"$runs")
if [[ -z "$latest" ]]; then
  echo "::warning::Aucun cycle terminé à reprendre et aucune boucle active."
  exit 0
fi

run_id=$(jq -r '.databaseId' <<<"$latest")
run_url=$(jq -r '.url' <<<"$latest")
conclusion=$(jq -r '.conclusion' <<<"$latest")
jobs=$(gh api "repos/$repository/actions/runs/$run_id/jobs?filter=latest&per_page=100")

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
state_b64=""
prepare_job_id=$(jq -r '[.jobs[] | select(.name == "Prepare persistent accepted state") | .id] | first // empty' <<<"$jobs")
if [[ -n "$prepare_job_id" ]]; then
  prepare_log="$tmp_dir/prepare-$prepare_job_id.log"
  if gh run view "$run_id" --repo "$repository" --job "$prepare_job_id" --log >"$prepare_log" 2>/dev/null; then
    state_b64=$(grep -Eo 'chorescore-control-state:[A-Za-z0-9+/=]+' "$prepare_log" |
      tail -1 | cut -d: -f2- || true)
  fi
fi

control_state=""
if [[ -n "$state_b64" ]]; then
  control_state=$(printf '%s' "$state_b64" | base64 --decode 2>/dev/null || true)
fi

if jq -e --arg run "$run_id" '
  .schemaVersion == 1 and
  (.run_id | tostring) == $run and
  (.cycle_index | type == "number" and floor == . and . >= 1 and . <= 10000) and
  (.human_note | type == "string" and length <= 4000)
' <<<"$control_state" >/dev/null 2>&1; then
  cycle_index=$(jq -r '.cycle_index' <<<"$control_state")
  human_note=$(jq -r '.human_note' <<<"$control_state")
  state_source=structured
else
  cycle_index=1
  human_note=""
  state_source=safe-fallback
fi

if [[ "$conclusion" == success ]]; then
  if (( cycle_index < 10000 )); then
    cycle_index=$((cycle_index + 1))
  fi
  recovery=none
  reason="successeur manquant après cycle incomplet"
else
  recovery="$run_id"
  reason="récupération après cycle interrompu ($conclusion)"
fi

# Close the race with the Director's direct dispatch or the transient watchdog.
runs=$(list_runs)
if (( $(jq '[.[] | select(.status != "completed")] | length' <<<"$runs") > 0 )); then
  echo "Une boucle est apparue pendant le contrôle ; aucune duplication." >>"$summary_file"
  exit 0
fi

gh workflow run "$workflow" --repo "$repository" --ref main \
  -f human_note="$human_note" -f cycle_index="$cycle_index" -f max_cycles=0 \
  -f recovery_cycle_key="$recovery"

new_run=""
for _ in {1..20}; do
  runs=$(list_runs)
  new_run=$(jq -c --argjson old "$run_id" '[.[] | select(.status != "completed" and .databaseId != $old)] | sort_by(.createdAt) | last // empty' <<<"$runs")
  [[ -n "$new_run" ]] && break
  sleep 2
done

if [[ -z "$new_run" ]]; then
  echo "::error::La relance de continuité a été demandée mais aucun nouveau run n'est observable."
  exit 1
fi

new_run_id=$(jq -r '.databaseId' <<<"$new_run")
new_run_url=$(jq -r '.url' <<<"$new_run")
{
  echo "### Continuité ChoreScore rétablie"
  echo
  echo "- Cycle précédent : $run_url"
  echo "- Nouveau cycle : $new_run_url"
  echo "- Motif : $reason"
  echo "- Index logique : $cycle_index"
  echo "- État de contrôle : $state_source"
} >>"$summary_file"

printf 'Continuité rétablie : run %s -> run %s (%s).\n' "$run_id" "$new_run_id" "$reason"
