#!/usr/bin/env bash

set -euo pipefail

repository="${GITHUB_REPOSITORY:?}"
workflow="${CHORESCORE_LOOP_WORKFLOW:-chorescore-loop.yml}"
tracking_issue="${CHORESCORE_TRACKING_ISSUE:-3}"
rollover_attempt="${CHORESCORE_RERUN_ROLLOVER_ATTEMPT:-45}"
summary_file="${GITHUB_STEP_SUMMARY:-/dev/null}"

[[ "$rollover_attempt" =~ ^[0-9]+$ ]]
(( rollover_attempt >= 2 && rollover_attempt <= 49 ))

list_runs() {
  gh run list --repo "$repository" --workflow "$workflow" --limit 30 \
    --json databaseId,status,conclusion,createdAt,url
}

runs=$(list_runs)
active_count=$(jq '[.[] | select(.status != "completed")] | length' <<<"$runs")
if (( active_count > 0 )); then
  active_url=$(jq -r '[.[] | select(.status != "completed")] | sort_by(.createdAt) | last | .url' <<<"$runs")
  {
    echo "### Watchdog ChoreScore"
    echo
    echo "Boucle déjà active : $active_url"
  } >>"$summary_file"
  exit 0
fi

latest=$(jq -c '[.[] | select(.status == "completed")] | sort_by(.createdAt) | last // empty' <<<"$runs")
if [[ -z "$latest" ]]; then
  echo "Aucun cycle ChoreScore terminé à examiner." >>"$summary_file"
  exit 0
fi

run_id=$(jq -r '.databaseId' <<<"$latest")
run_url=$(jq -r '.url' <<<"$latest")
conclusion=$(jq -r '.conclusion' <<<"$latest")
if [[ "$conclusion" != failure ]]; then
  {
    echo "### Watchdog ChoreScore"
    echo
    echo "Dernier cycle sans panne à reprendre : $run_url (`$conclusion`)."
  } >>"$summary_file"
  exit 0
fi

jobs=$(gh api "repos/$repository/actions/runs/$run_id/jobs?filter=latest&per_page=100")
failed_jobs=$(jq -c '[.jobs[] | select(.conclusion == "failure")]' <<<"$jobs")
failed_count=$(jq 'length' <<<"$failed_jobs")
if (( failed_count == 0 )); then
  echo "::warning::Le run $run_id est rouge mais aucun job échoué n'est visible."
  exit 0
fi

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
transient_jobs=()
unsafe_jobs=()

while IFS= read -r encoded_job; do
  job=$(printf '%s' "$encoded_job" | base64 -d)
  job_id=$(jq -r '.id' <<<"$job")
  job_name=$(jq -r '.name' <<<"$job")
  log_file="$tmp_dir/$job_id.log"
  step_count=$(jq '(.steps // []) | length' <<<"$job")

  # GitHub can reject a private-repository job before assigning a runner. Such
  # jobs have no steps and no logs; after a visibility/quota change they are
  # safe infrastructure retries, not code failures.
  if (( step_count == 0 )); then
    transient_jobs+=("$job_name (runner non démarré)")
    continue
  fi

  if ! gh run view "$run_id" --repo "$repository" --job "$job_id" --log >"$log_file" 2>&1; then
    unsafe_jobs+=("$job_name (logs indisponibles)")
    continue
  fi

  if grep -Eqi 'endpoint is unavailable|service unavailable|upstream request failed|provider[^[:cntrl:]]*unavailable' "$log_file"; then
    # Older retry classifiers could label an explicit provider outage as
    # permanent. The provider evidence is authoritative for recovery.
    transient_jobs+=("$job_name (panne fournisseur explicite)")
  elif grep -Fq 'CHORESCORE_OPENCODE_FAILURE_KIND=permanent' "$log_file"; then
    unsafe_jobs+=("$job_name")
  elif grep -Fq 'CHORESCORE_OPENCODE_FAILURE_KIND=transient' "$log_file"; then
    transient_jobs+=("$job_name")
  elif grep -Eqi 'network_error|temporarily unavailable|ECONNRESET|ETIMEDOUT|HTTP[^0-9]*(429|500|502|503|504)' "$log_file" &&
       grep -Eqi 'OpenCode .* reste indisponible après [0-9]+ tentatives' "$log_file"; then
    transient_jobs+=("$job_name (ancien marqueur)")
  else
    unsafe_jobs+=("$job_name")
  fi
done < <(jq -r '.[] | @base64' <<<"$failed_jobs")

if (( ${#transient_jobs[@]} == 0 || ${#unsafe_jobs[@]} > 0 )); then
  {
    echo "### Watchdog ChoreScore"
    echo
    echo "Aucune relance automatique de $run_url."
    echo
    echo "- Pannes OX transitoires : ${#transient_jobs[@]}"
    echo "- Échecs non classés transitoires : ${#unsafe_jobs[@]}"
  } >>"$summary_file"
  exit 0
fi

old_attempt=$(gh api "repos/$repository/actions/runs/$run_id" --jq '.run_attempt')
transient_list=$(IFS=', '; echo "${transient_jobs[*]}")

if (( old_attempt < rollover_attempt )); then
  gh api --method POST "repos/$repository/actions/runs/$run_id/rerun-failed-jobs" >/dev/null

  new_attempt=$((old_attempt + 1))
  confirmed=false
  for _ in {1..15}; do
    state=$(gh api "repos/$repository/actions/runs/$run_id" --jq '[.status, .run_attempt] | @tsv')
    IFS=$'\t' read -r status observed_attempt <<<"$state"
    if [[ "$status" != completed || "$observed_attempt" -gt "$old_attempt" ]]; then
      new_attempt="$observed_attempt"
      confirmed=true
      break
    fi
    sleep 2
  done

  if [[ "$confirmed" != true ]]; then
    echo "::warning::GitHub a accepté la reprise du run $run_id, mais son nouvel état n'est pas encore observable."
  fi

  {
    echo "### Watchdog ChoreScore"
    echo
    echo "Reprise automatique déclenchée : $run_url"
    echo
    echo "- Tentative GitHub : $old_attempt → $new_attempt"
    echo "- Jobs : $transient_list"
  } >>"$summary_file"

  body=$(printf '### Reprise automatique après panne OX\n\n- Run : [%s](%s)\n- Tentative GitHub : `%s → %s`\n- Jobs relancés : %s\n\nLe watchdog a conservé le même cycle et ses snapshots. Aucun échec de code non transitoire n’a été relancé.' \
    "$run_id" "$run_url" "$old_attempt" "$new_attempt" "$transient_list")
  printf '%s\n' "$body" ||
    echo "::warning::Reprise lancée, mais commentaire de suivi impossible."
  exit 0
fi

comments=$(gh issue view "$tracking_issue" --repo "$repository" --json comments)
state_b64=$(jq -r --arg needle "actions/runs/$run_id" '
  [.comments[].body
   | select(contains($needle))
   | (capture("<!-- chorescore-control-state:(?<state>[A-Za-z0-9+/=]+) -->")? // empty)
   | .state] | last // empty
' <<<"$comments")

control_state=""
if [[ -n "$state_b64" ]]; then
  control_state=$(printf '%s' "$state_b64" | base64 -d 2>/dev/null || true)
fi

if jq -e --arg run "$run_id" '
  .schemaVersion == 1 and
  (.run_id | tostring) == $run and
  (.cycle_index | type == "number" and floor == . and . >= 1 and . <= 10000) and
  (.max_cycles | type == "number" and floor == . and . >= 0 and . <= 10000) and
  (.human_note | type == "string" and length <= 4000)
' <<<"$control_state" >/dev/null 2>&1; then
  cycle_index=$(jq -r '.cycle_index' <<<"$control_state")
  max_cycles=$(jq -r '.max_cycles' <<<"$control_state")
  human_note=$(jq -r '.human_note' <<<"$control_state")
  state_source=structured
else
  related_comment=$(jq -r --arg needle "actions/runs/$run_id"     '[.comments[].body | select(contains($needle))] | last // empty' <<<"$comments")
  cycle_index=$(grep -Eo -- '- Cycle : `[0-9]+`' <<<"$related_comment" |
    grep -Eo '[0-9]+' | tail -1 || true)
  [[ "$cycle_index" =~ ^[1-9][0-9]*$ ]] || cycle_index=1
  max_cycles=0
  human_note=""
  state_source=legacy-fallback
fi

runs=$(list_runs)
if (( $(jq '[.[] | select(.status != "completed")] | length' <<<"$runs") > 0 )); then
  echo "Une boucle est apparue pendant l'analyse; rollover annulé sans erreur." >>"$summary_file"
  exit 0
fi

gh workflow run "$workflow" --repo "$repository" --ref main \
  -f human_note="$human_note" -f cycle_index="$cycle_index" -f max_cycles="$max_cycles" \
  -f recovery_cycle_key="$run_id"

new_run=""
for _ in {1..20}; do
  runs=$(list_runs)
  new_run=$(jq -c --argjson old "$run_id"     '[.[] | select(.status != "completed" and .databaseId != $old)] | sort_by(.createdAt) | last // empty' <<<"$runs")
  [[ -n "$new_run" ]] && break
  sleep 2
done

if [[ -z "$new_run" ]]; then
  echo "::error::Le rollover du run $run_id a été demandé mais aucun nouveau run n'est observable."
  exit 1
fi

new_run_id=$(jq -r '.databaseId' <<<"$new_run")
new_run_url=$(jq -r '.url' <<<"$new_run")
{
  echo "### Watchdog ChoreScore"
  echo
  echo "Rollover de récupération déclenché : $new_run_url"
  echo
  echo "- Ancien run : $run_url (tentative $old_attempt)"
  echo "- Cycle logique : $cycle_index"
  echo "- Source d'état : $state_source"
  echo "- Jobs transitoires : $transient_list"
} >>"$summary_file"

body=$(printf '### Rollover automatique après panne OX prolongée\n\n- Ancien run : [%s](%s)\n- Nouveau run : [%s](%s)\n- Cycle logique conservé : `%s`\n- Récupération : `%s`\n\nLa limite GitHub de rerun est contournée proprement par un nouveau run qui remonte les snapshots précédents.' \
  "$run_id" "$run_url" "$new_run_id" "$new_run_url" "$cycle_index" "$run_id")
printf '%s\n' "$body" ||
  echo "::warning::Rollover lancé, mais commentaire de suivi impossible."
