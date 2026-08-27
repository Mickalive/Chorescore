#!/usr/bin/env bash
set -euo pipefail

repo="${GITHUB_REPOSITORY:?}"
auth=$(printf 'x-access-token:%s' "${GH_TOKEN:?}" | base64 -w0)
main_sha=$(git rev-parse HEAD)

test "$repo" = "Mickalive/Chorescore"
test "$(find .github/workflows -maxdepth 1 -type f -name '*.yml' | wc -l)" -eq 1
test -s .github/workflows/chorescore-factory.yml
for f in MAIN_PROMPT.md AGENTS.md governance/RELEASE_DEFINITION.json governance/roles/MOBILE_PRODUCT_ENGINEER.md governance/roles/BACKEND_INTEGRATION_ENGINEER.md governance/roles/INDEPENDENT_RELEASE_AUDITOR.md governance/roles/RELEASE_DIRECTOR.md directives/DIRECTOR.md .opencode/agents/mobile-cycle-runner.md .opencode/agents/backend-cycle-runner.md .opencode/agents/cycle-auditor.md .opencode/agents/cycle-director.md; do
  test -s "$f"
done

git -c "http.extraheader=AUTHORIZATION: basic $auth" fetch origin \
  "+refs/heads/lab/chorescore:refs/remotes/origin/lab/chorescore" \
  "+refs/heads/main:refs/remotes/origin/main"
accepted="${RUNNER_TEMP:?}/accepted-prepare"
rm -rf "$accepted"
git worktree add --detach "$accepted" refs/remotes/origin/lab/chorescore
accepted_before=$(git -C "$accepted" rev-parse HEAD)

for path in .github .opencode governance; do
  git -C "$accepted" rm -r -f --ignore-unmatch -- "$path" >/dev/null 2>&1 || true
done
for path in AGENTS.md CLAUDE.md MAIN_PROMPT.md opencode.json directives/DIRECTOR.md docs/agent-workflow.md docs/architecture.md docs/product-decisions.md; do
  git -C "$accepted" rm -f --ignore-unmatch -- "$path" >/dev/null 2>&1 || true
done
git -C "$accepted" checkout "$main_sha" -- \
  .github .opencode governance AGENTS.md CLAUDE.md MAIN_PROMPT.md opencode.json \
  directives/DIRECTOR.md docs/agent-workflow.md docs/architecture.md docs/product-decisions.md

git -C "$accepted" add -A -- \
  .github .opencode governance AGENTS.md CLAUDE.md MAIN_PROMPT.md opencode.json \
  directives/DIRECTOR.md docs/agent-workflow.md docs/architecture.md docs/product-decisions.md
if ! git -C "$accepted" diff --cached --quiet; then
  git -C "$accepted" config user.name chorescore-factory
  git -C "$accepted" config user.email chorescore-factory@users.noreply.github.com
  git -C "$accepted" commit -m "ChoreScore factory v3: align clean control plane"
  git -c "http.extraheader=AUTHORIZATION: basic $auth" fetch origin "+refs/heads/lab/chorescore:refs/remotes/origin/lab/chorescore"
  test "$(git -C "$accepted" rev-parse refs/remotes/origin/lab/chorescore)" = "$accepted_before"
  git -c "http.extraheader=AUTHORIZATION: basic $auth" -C "$accepted" push origin "HEAD:refs/heads/lab/chorescore"
fi
accepted_sha=$(git -C "$accepted" rev-parse HEAD)

jq -e '
  .schemaVersion==1 and .milestone=="demo-rc" and
  (.assignments|type=="object") and
  all(["mobile","backend"][]; . as $r |
    (.assignments[$r]|type=="object") and
    (.assignments[$r].enabled|type=="boolean") and
    (.assignments[$r].criterionId|type=="string") and
    (.assignments[$r].objective|type=="string") and
    (.assignments[$r].acceptance|type=="array"))
' "$accepted/directives/TASKS.json" >/dev/null

jq -e '
  .schemaVersion==1 and .milestone=="demo-rc" and
  ([.criteria[].id]|sort)==(["DRC-01","DRC-02","DRC-03","DRC-04","DRC-05","DRC-06","DRC-07"]|sort)
' "$accepted/docs/RELEASE_STATUS.json" >/dev/null

final=$(jq -r '
  all(.criteria[]; .status=="complete") and
  .pendingArtifact==null and
  (.activeCriteria|length)==0 and
  all(.openFindings[]?; (.mustFixBeforeRelease!=true) or .status=="resolved") and
  any(.criteria[]; .id=="DRC-06" and any(.evidence[]?; .kind=="artifact") and any(.evidence[]?; .kind=="runtime-smoke"))
' "$accepted/docs/RELEASE_STATUS.json")
pending=$(jq -r '.pendingArtifact=="DRC-06"' "$accepted/docs/RELEASE_STATUS.json")
mobile_enabled=$(jq -r '.assignments.mobile.enabled' "$accepted/directives/TASKS.json")
backend_enabled=$(jq -r '.assignments.backend.enabled' "$accepted/directives/TASKS.json")

echo "accepted_sha=$accepted_sha" >> "${GITHUB_OUTPUT:?}"
echo "final=$final" >> "$GITHUB_OUTPUT"
echo "pending_artifact=$pending" >> "$GITHUB_OUTPUT"
echo "mobile_enabled=$mobile_enabled" >> "$GITHUB_OUTPUT"
echo "backend_enabled=$backend_enabled" >> "$GITHUB_OUTPUT"

while IFS= read -r ref; do
  [[ -n "$ref" ]] || continue
  short=${ref#refs/heads/}
  gh api -X DELETE "repos/$repo/git/refs/heads/$short" >/dev/null 2>&1 || true
done < <(gh api --paginate "repos/$repo/git/matching-refs/heads/cycle/" --jq '.[].ref' 2>/dev/null || true)

gh api -X DELETE "repos/$repo/git/refs/heads/tmp-shard-proof" >/dev/null 2>&1 || true

while IFS= read -r ref; do
  [[ -n "$ref" ]] || continue
  short=${ref#refs/heads/}
  case "$short" in
    archive/chorescore/pre-single-factory-main-final-20260827|archive/chorescore/pre-single-factory-accepted-20260827-v2|archive/chorescore/pre-single-factory-controlplane-20260827) continue ;;
  esac
  gh api -X DELETE "repos/$repo/git/refs/heads/$short" >/dev/null 2>&1 || true
done < <(gh api --paginate "repos/$repo/git/matching-refs/heads/archive/chorescore/" --jq '.[].ref' 2>/dev/null || true)

while IFS=$'\t' read -r run_id path status; do
  [[ -n "$run_id" ]] || continue
  [[ "$path" != ".github/workflows/chorescore-factory.yml" ]] || continue
  if [[ "$status" != completed ]]; then
    gh api -X POST "repos/$repo/actions/runs/$run_id/force-cancel" >/dev/null 2>&1 || true
  fi
  gh api -X DELETE "repos/$repo/actions/runs/$run_id" >/dev/null 2>&1 || true
done < <(gh api --paginate "repos/$repo/actions/runs?per_page=100" --jq '.workflow_runs[] | [.id,.path,.status] | @tsv' 2>/dev/null || true)
