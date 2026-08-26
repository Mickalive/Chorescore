#!/usr/bin/env bash

set -euo pipefail

file="${1:?audit JSON path is required}"
test -s "$file"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# OpenCode writes the semantic decision; this trusted pass only normalizes the
# bounded machine contract. It may translate common presentation aliases, but
# it never invents a positive verdict or upgrades mustFix semantics.
jq '
  def clip($limit):
    if type == "string" then .[0:$limit] else . end;
  def text($fallback):
    if type == "string" then .
    elif . == null then $fallback
    else tostring
    end;
  def severity:
    if . == "critical" or . == "high" or . == "medium" or
       . == "low" or . == "info" then .
    else "info"
    end;

  .summary = ((.summary // .overview // .result // "Audit report") | text("Audit report") | clip(1000)) |
  .findings = (
    (.findings // [])[0:50] |
    to_entries |
    map(
      .key as $i |
      .value as $f |
      {
        id: (($f.id // $f.code // ("finding-" + (($i + 1) | tostring))) | text("finding") | clip(100)),
        severity: (($f.severity // "info") | severity),
        path: (($f.path // $f.file // "") | text("") | clip(500)),
        problem: (($f.problem // $f.description // $f.issue // "Auditor finding") | text("Auditor finding") | clip(2000)),
        evidence: (($f.evidence // $f.proof // $f.details // $f.description // $f.problem // "See audit Markdown") | text("See audit Markdown") | clip(2000)),
        mustFix: (
          if ($f.mustFix | type) == "boolean" then $f.mustFix
          elif ($f.must_fix | type) == "boolean" then $f.must_fix
          else false
          end
        ),
        requiredFix: (($f.requiredFix // $f.fix // $f.recommendation //
          (if (($f.mustFix // $f.must_fix // false) == true)
           then "Apply the required correction described in the audit Markdown."
           else "No release-blocking correction required."
           end)) | text("No release-blocking correction required.") | clip(2000)),
        verification: (($f.verification // $f.verify // $f.test //
          "Re-run the relevant checks described in the audit Markdown.") |
          text("Re-run the relevant checks described in the audit Markdown.") | clip(2000))
      }
    )
  ) |
  .checks = (
    (.checks // [])[0:50] |
    map(text("check") | clip(1000)) |
    map(select(length > 0))
  )
' "$file" >"$tmp"

mv "$tmp" "$file"
trap - EXIT
