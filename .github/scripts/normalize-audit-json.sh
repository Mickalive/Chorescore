#!/usr/bin/env bash

set -euo pipefail

file="${1:?audit JSON path is required}"
test -s "$file"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# OpenCode writes the semantic decision; this trusted pass only enforces the
# bounded machine contract. Full evidence remains available in the Markdown.
jq '
  def clip($limit):
    if type == "string" then .[0:$limit] else . end;

  .summary |= clip(1000) |
  .findings = (
    (.findings // [])[0:50] |
    map(
      .id |= clip(100) |
      .path |= clip(500) |
      .problem |= clip(2000) |
      .evidence |= clip(2000) |
      .requiredFix |= clip(2000) |
      .verification |= clip(2000)
    )
  ) |
  .checks = ((.checks // [])[0:50] | map(clip(1000)))
' "$file" >"$tmp"

mv "$tmp" "$file"
trap - EXIT
