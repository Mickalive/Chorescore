#!/usr/bin/env bash
set -euo pipefail

status="docs/RELEASE_STATUS.json"
test -s "$status"

jq -e '
  . as $release |
  all(.criteria[];
    . as $criterion |
    $criterion.status != "complete" or
    ([ $release.openFindings[]? |
       select(.criterionId == $criterion.id and .mustFixBeforeRelease == true and .status != "resolved") ] | length) == 0
  )
' "$status" >/dev/null

criterion_complete() {
  local id="$1"
  jq -e --arg id "$id" 'any(.criteria[]; .id == $id and .status == "complete")' "$status" >/dev/null
}

reject_visible_claim() {
  local pattern="$1"
  local message="$2"
  if grep -RInE --include='*.ts' --include='*.tsx' "$pattern" app src; then
    echo "::error::$message"
    exit 1
  fi
}

if criterion_complete DRC-02; then
  reject_visible_claim \
    'Rien n.est conservé|rien n.est conservé' \
    "DRC-02 est terminé, mais l'interface affirme encore que rien n'est conservé."
fi

if criterion_complete DRC-04; then
  reject_visible_claim \
    'Rapport simulé|reste simulée ici' \
    "DRC-04 est terminé, mais une fonction premium est encore présentée comme simulée."
fi

if criterion_complete DRC-07; then
  grep -Fq 'Ce dépôt est public' README.md
  if grep -Fq 'Ce projet est privé' README.md; then
    echo "::error::DRC-07 est terminé, mais README.md décrit encore le dépôt comme privé."
    exit 1
  fi
  test "$(find .opencode/agents -maxdepth 1 -type f -name '*.md' | wc -l)" -eq 4
  test "$(find .github/workflows -maxdepth 1 -type f -name '*.yml' | wc -l)" -eq 3
fi
