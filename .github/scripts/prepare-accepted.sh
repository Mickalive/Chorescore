#!/usr/bin/env bash
set -euo pipefail

repo="${GITHUB_REPOSITORY:?}"
cycle="${CYCLE_KEY:?}"
run_number="${GITHUB_RUN_NUMBER:?}"
main_sha=$(git rev-parse HEAD)
auth=$(printf 'x-access-token:%s' "${GH_TOKEN:?}" | base64 -w0)

# The only persistent product state is lab/chorescore. Create it from main only if
# the repository has never had an accepted lane.
if git ls-remote --exit-code --heads origin refs/heads/lab/chorescore >/dev/null 2>&1; then
  git -c "http.extraheader=AUTHORIZATION: basic $auth" fetch origin "+refs/heads/lab/chorescore:refs/remotes/origin/lab/chorescore"
  accepted_sha=$(git rev-parse refs/remotes/origin/lab/chorescore)
else
  accepted_sha="$main_sha"
  git -c "http.extraheader=AUTHORIZATION: basic $auth" push origin "$main_sha:refs/heads/lab/chorescore"
fi

# Sync the human-owned constitution/control files from main onto the cumulative
# accepted lane. This never copies application/product state from main.
worktree="${RUNNER_TEMP:?}/chorescore-accepted-prepare"
rm -rf "$worktree"
git worktree add --detach "$worktree" "$accepted_sha"

human_paths=(
  MAIN_PROMPT.md
  AGENTS.md
  governance
  directives/DIRECTOR.md
  .opencode/agents
  .github/workflows/chorescore-factory.yml
  .github/actions/setup-opencode
  .github/scripts
)
for path in "${human_paths[@]}"; do
  rm -rf "$worktree/$path"
  if git cat-file -e "$main_sha:$path" 2>/dev/null; then
    mkdir -p "$worktree/$(dirname "$path")"
    git archive "$main_sha" "$path" | tar -x -C "$worktree"
  fi
done

# Remove obsolete control-plane files from the accepted lane if they survived
# from historical states.
rm -f \
  "$worktree/.github/workflows/chorescore-loop.yml" \
  "$worktree/.github/workflows/chorescore-launch.yml" \
  "$worktree/.github/workflows/ci.yml" \
  "$worktree/.github/scripts/ensure-continuous-loop.sh" \
  "$worktree/.github/scripts/verify-workflow-architecture.sh" \
  "$worktree/.github/scripts/verify-immutable-governance.sh" \
  "$worktree/.github/immutable-files.sha256"
rm -rf "$worktree/.chorescore"

# The accepted lane must expose exactly one workflow.
workflow_count=$(find "$worktree/.github/workflows" -maxdepth 1 -type f -name '*.yml' | wc -l)
if [[ "$workflow_count" -ne 1 ]] || [[ ! -f "$worktree/.github/workflows/chorescore-factory.yml" ]]; then
  echo "::error::Accepted lane does not contain exactly the single ChoreScore factory workflow." >&2
  exit 20
fi

git -C "$worktree" config user.name chorescore-factory
git -C "$worktree" config user.email chorescore-factory@users.noreply.github.com
git -C "$worktree" add -A -- "${human_paths[@]}" .github .chorescore 2>/dev/null || git -C "$worktree" add -A
if ! git -C "$worktree" diff --cached --quiet; then
  git -C "$worktree" commit -m "ChoreScore factory: align clean control plane"
  git -c "http.extraheader=AUTHORIZATION: basic $auth" -C "$worktree" push origin "HEAD:refs/heads/lab/chorescore"
fi
accepted_sha=$(git -C "$worktree" rev-parse HEAD)

# Release state remains the sole authority for whether product work is complete.
status_file="$worktree/docs/RELEASE_STATUS.json"
tasks_file="$worktree/directives/TASKS.json"
test -s "$status_file"
test -s "$tasks_file"
jq -e '.milestone=="demo-rc" and ([.criteria[].id] | sort) == (["DRC-01","DRC-02","DRC-03","DRC-04","DRC-05","DRC-06","DRC-07"] | sort)' "$status_file" >/dev/null
jq -e '.schemaVersion>=1 and (.assignments.mobile.enabled|type=="boolean") and (.assignments.backend.enabled|type=="boolean")' "$tasks_file" >/dev/null

final=false
if jq -e '
  all(.criteria[]; .status=="complete") and
  (.activeCriteria|length)==0 and
  .pendingArtifact==null and
  ([.openFindings[]? | select(.mustFixBeforeRelease==true and .status=="unresolved")] | length)==0 and
  any(.criteria[] | select(.id=="DRC-06") | .evidence[]?; .kind=="artifact") and
  any(.criteria[] | select(.id=="DRC-06") | .evidence[]?; .kind=="runtime-smoke")
' "$status_file" >/dev/null; then
  final=true
fi
pending_artifact=$(jq -r '.pendingArtifact=="DRC-06"' "$status_file")
mobile_enabled=$(jq -r '.assignments.mobile.enabled' "$tasks_file")
backend_enabled=$(jq -r '.assignments.backend.enabled' "$tasks_file")

# Legacy refs are not part of the architecture anymore. Remove every old
# cycle/recovery ref. Archive snapshots are deliberately not touched here.
while IFS= read -r ref; do
  [[ -z "$ref" ]] && continue
  case "$ref" in
    refs/heads/cycle/chorescore/*|refs/heads/recovery/chorescore/*)
      git -c "http.extraheader=AUTHORIZATION: basic $auth" push origin ":$ref" || true
      ;;
  esac
done < <(git ls-remote --heads origin | awk '{print $2}')

# Purge every workflow run older than this run. This makes Actions history obey
# the same single-factory architecture instead of accumulating obsolete runs.
# Never touch this run or a later run number; a queued successor is therefore safe.
page=1
while :; do
  runs=$(gh api "repos/$repo/actions/runs?per_page=100&page=$page")
  count=$(jq '.workflow_runs | length' <<<"$runs")
  [[ "$count" -eq 0 ]] && break

  while IFS=$'\t' read -r run_id old_number status; do
    [[ -z "$run_id" ]] && continue
    [[ "$run_id" == "$GITHUB_RUN_ID" ]] && continue
    [[ "$old_number" =~ ^[0-9]+$ ]] || continue
    (( old_number < run_number )) || continue

    if [[ "$status" != "completed" ]]; then
      gh api -X POST "repos/$repo/actions/runs/$run_id/force-cancel" >/dev/null 2>&1 || \
        gh api -X POST "repos/$repo/actions/runs/$run_id/cancel" >/dev/null 2>&1 || true
    fi
    if gh api -X DELETE "repos/$repo/actions/runs/$run_id" >/dev/null 2>&1; then
      echo "Deleted obsolete workflow run $run_id (#$old_number, $status)."
    else
      echo "::warning::GitHub retained obsolete workflow run $run_id (#$old_number, $status); it is not part of factory state."
    fi
  done < <(jq -r '.workflow_runs[] | [.id, .run_number, .status] | @tsv' <<<"$runs")

  (( count < 100 )) && break
  ((page++))
done

# Garbage-collect detached worktree metadata; all ephemeral role state lives in
# Actions artifacts and runner filesystems, never persistent candidate branches.
git worktree remove --force "$worktree"
git worktree prune

{
  echo "accepted_sha=$accepted_sha"
  echo "final=$final"
  echo "pending_artifact=$pending_artifact"
  echo "mobile_enabled=$mobile_enabled"
  echo "backend_enabled=$backend_enabled"
} >> "${GITHUB_OUTPUT:?}"

echo "Clean factory state ready at $accepted_sha (cycle $cycle)."
