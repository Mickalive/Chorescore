#!/usr/bin/env bash

set -euo pipefail

repository="${GITHUB_REPOSITORY:?}"
workflow="${CHORESCORE_LOOP_WORKFLOW:-chorescore-loop.yml}"
tracking_issue="${CHORESCORE_TRACKING_ISSUE:-3}"
summary_file="${GITHUB_STEP_SUMMARY:-/dev/null}"

runs=$(gh run list --repo "$repository" --workflow "$workflow" --limit 30 \
  --json databaseId,status,conclusion,createdAt,url)

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

  if ! gh run view "$run_id" --repo "$repository" --job "$job_id" --log >"$log_file" 2>&1; then
    unsafe_jobs+=("$job_name (logs indisponibles)")
    continue
  fi

  if grep -Fq 'CHORESCORE_OPENCODE_FAILURE_KIND=permanent' "$log_file"; then
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

transient_list=$(IFS=', '; echo "${transient_jobs[*]}")
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
gh issue comment "$tracking_issue" --repo "$repository" --body "$body" ||
  echo "::warning::Reprise lancée, mais commentaire de suivi impossible."
