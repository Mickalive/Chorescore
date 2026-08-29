#!/usr/bin/env bash
set -euo pipefail
repo="${GITHUB_REPOSITORY:?}"
cycle="${CYCLE_KEY:?}"
run_number="${GITHUB_RUN_NUMBER:?}"
main_sha=$(git rev-parse HEAD)
auth=$(printf 'x-access-token:%s' "${GH_TOKEN:?}" | base64 -w0)
if git ls-remote --exit-code --heads origin refs/heads/lab/chorescore >/dev/null 2>&1; then git -c "http.extraheader=AUTHORIZATION: basic $auth" fetch origin "+refs/heads/lab/chorescore:refs/remotes/origin/lab/chorescore"; accepted_sha=$(git rev-parse refs/remotes/origin/lab/chorescore); else accepted_sha="$main_sha"; git -c "http.extraheader=AUTHORIZATION: basic $auth" push origin "$main_sha:refs/heads/lab/chorescore"; fi
worktree="${RUNNER_TEMP:?}/chorescore-accepted-prepare"
rm -rf "$worktree"
git worktree add --detach "$worktree" "$accepted_sha"
human_paths=(MAIN_PROMPT.md AGENTS.md governance directives/DIRECTOR.md .opencode/agents .github/workflows/chorescore-factory.yml .github/actions/setup-opencode .github/scripts)
for path in "${human_paths[@]}"; do rm -rf "$worktree/$path"; if git cat-file -e "$main_sha:$path" 2>/dev/null; then mkdir -p "$worktree/$(dirname "$path")"; git archive "$main_sha" "$path" | tar -x -C "$worktree"; fi; done
rm -f "$worktree/.github/workflows/chorescore-loop.yml" "$worktree/.github/workflows/chorescore-launch.yml" "$worktree/.github/workflows/ci.yml" "$worktree/.github/scripts/ensure-continuous-loop.sh" "$worktree/.github/scripts/verify-workflow-architecture.sh" "$worktree/.github/scripts/verify-immutable-governance.sh" "$worktree/.github/immutable-files.sha256"
rm -rf "$worktree/.chorescore"
workflow_count=$(find "$worktree/.github/workflows" -maxdepth 1 -type f -name '*.yml' | wc -l)
[[ "$workflow_count" -eq 1 && -f "$worktree/.github/workflows/chorescore-factory.yml" ]] || { echo "::error::Expected exactly one workflow." >&2; exit 20; }
git -C "$worktree" config user.name chorescore-factory
git -C "$worktree" config user.email chorescore-factory@users.noreply.github.com
status_file="$worktree/docs/RELEASE_STATUS.json"; tasks_file="$worktree/directives/TASKS.json"; test -s "$status_file" && test -s "$tasks_file"
# Expo SDK 57's native C++ bridge requires the SDK-compatible Reanimated/Worklets pair.
# npm's peer resolver previously floated these to Reanimated 4.6.0 + Worklets 0.12.1,
# which passes JS tests/export but cannot compile expo-modules-core (WorkletRuntime::executeSync was removed).
# Normalize the accepted source itself before DRC-06 so the APK is always built from a committed lockfile.
if jq -e '.pendingArtifact=="DRC-06"' "$status_file" >/dev/null; then
  if ! jq -e '.dependencies["react-native-reanimated"]=="4.5.1" and .dependencies["react-native-worklets"]=="0.10.1"' "$worktree/package.json" >/dev/null 2>&1 || \
     ! jq -e '.packages["node_modules/react-native-reanimated"].version=="4.5.1" and .packages["node_modules/react-native-worklets"].version=="0.10.1"' "$worktree/package-lock.json" >/dev/null 2>&1; then
    command -v npm >/dev/null 2>&1 || { echo "::error::npm is required to normalize Expo 57 native dependencies." >&2; exit 21; }
    echo "Normalizing Expo 57 native pair: react-native-reanimated=4.5.1, react-native-worklets=0.10.1"
    (
      cd "$worktree"
      npm install --package-lock-only --ignore-scripts --no-audit --no-fund --save-exact react-native-reanimated@4.5.1 react-native-worklets@0.10.1
    )
    jq -e '.dependencies["react-native-reanimated"]=="4.5.1" and .dependencies["react-native-worklets"]=="0.10.1"' "$worktree/package.json" >/dev/null
    jq -e '.packages["node_modules/react-native-reanimated"].version=="4.5.1" and .packages["node_modules/react-native-worklets"].version=="0.10.1"' "$worktree/package-lock.json" >/dev/null
  fi
fi
git -C "$worktree" add -A
if ! git -C "$worktree" diff --cached --quiet; then git -C "$worktree" commit -m "ChoreScore factory: align clean control plane"; git -c "http.extraheader=AUTHORIZATION: basic $auth" -C "$worktree" push origin "HEAD:refs/heads/lab/chorescore"; fi
accepted_sha=$(git -C "$worktree" rev-parse HEAD)
jq -e '.milestone=="demo-rc" and ([.criteria[].id]|sort)==(["DRC-01","DRC-02","DRC-03","DRC-04","DRC-05","DRC-06","DRC-07"]|sort)' "$status_file" >/dev/null
jq -e '.schemaVersion>=1 and (.assignments.mobile.enabled|type=="boolean") and (.assignments.backend.enabled|type=="boolean")' "$tasks_file" >/dev/null
final=false
if jq -e 'all(.criteria[];.status=="complete") and (.activeCriteria|length)==0 and .pendingArtifact==null and ([.openFindings[]?|select(.mustFixBeforeRelease==true and .status=="unresolved")]|length)==0 and any(.criteria[]|select(.id=="DRC-06")|.evidence[]?;.kind=="artifact") and any(.criteria[]|select(.id=="DRC-06")|.evidence[]?;.kind=="runtime-smoke")' "$status_file" >/dev/null; then final=true; fi
pending_artifact=$(jq -r '.pendingArtifact=="DRC-06"' "$status_file"); mobile_enabled=$(jq -r '.assignments.mobile.enabled' "$tasks_file"); backend_enabled=$(jq -r '.assignments.backend.enabled' "$tasks_file")
while IFS= read -r ref; do case "$ref" in refs/heads/cycle/chorescore/*|refs/heads/recovery/chorescore/*) git -c "http.extraheader=AUTHORIZATION: basic $auth" push origin ":$ref" || true;; esac; done < <(git ls-remote --heads origin | awk '{print $2}')
# Cleanup is deliberately scoped ONLY to obsolete Product Factory runs.
# Other workflows (notably ChoreScore Phone APK) and their artifacts must survive so humans can test real-device builds in parallel.
while :; do
  runs=$(gh api "repos/$repo/actions/runs?per_page=100&page=1")
  old_runs=$(jq --argjson current "$run_number" --arg current_id "$GITHUB_RUN_ID" '[.workflow_runs[]|select(.path==".github/workflows/chorescore-factory.yml" and (.run_number<$current) and ((.id|tostring)!=$current_id))]' <<<"$runs")
  [[ $(jq 'length' <<<"$old_runs") -gt 0 ]] || break
  deleted_any=false
  while IFS=$'\t' read -r run_id old_number status; do
    [[ -n "$run_id" ]] || continue
    if [[ "$status" != completed ]]; then gh api -X POST "repos/$repo/actions/runs/$run_id/force-cancel" >/dev/null 2>&1 || gh api -X POST "repos/$repo/actions/runs/$run_id/cancel" >/dev/null 2>&1 || true; fi
    if gh api -X DELETE "repos/$repo/actions/runs/$run_id" >/dev/null 2>&1; then echo "Deleted obsolete Product Factory run $run_id (#$old_number, $status)."; deleted_any=true; else echo "::warning::GitHub retained obsolete Product Factory run $run_id (#$old_number, $status)."; fi
  done < <(jq -r '.[]|[.id,.run_number,.status]|@tsv' <<<"$old_runs")
  [[ "$deleted_any" == true ]] || break
done
git worktree remove --force "$worktree"; git worktree prune
{ echo "accepted_sha=$accepted_sha"; echo "final=$final"; echo "pending_artifact=$pending_artifact"; echo "mobile_enabled=$mobile_enabled"; echo "backend_enabled=$backend_enabled"; } >> "${GITHUB_OUTPUT:?}"
echo "Clean factory state ready at $accepted_sha (cycle $cycle)."
