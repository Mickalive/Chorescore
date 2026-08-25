#!/usr/bin/env bash
set -euo pipefail

mode="${1:?snapshot or verify is required}"
manifest="${2:?manifest path is required}"

write_manifest() {
  local destination="$1"
  local paths=(
    app src tests functions/src functions/test docs/security
    firestore.rules firestore.indexes.json storage.rules firebase.json
  )

  : >"$destination"
  while IFS= read -r path; do
    test -f "$path" || continue
    printf '%s  %s\n' "$(sha256sum "$path" | awk '{print $1}')" "$path" >>"$destination"
  done < <(git ls-files --cached --others --exclude-standard -- "${paths[@]}" | LC_ALL=C sort -u)
}

case "$mode" in
  snapshot)
    write_manifest "$manifest"
    ;;
  verify)
    test -s "$manifest"
    current=$(mktemp)
    trap 'rm -f "$current"' EXIT
    write_manifest "$current"
    if ! diff -u "$manifest" "$current"; then
      echo "::error::Le directeur a modifié l'arbre produit après l'intégration auditée." >&2
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 snapshot|verify MANIFEST" >&2
    exit 2
    ;;
esac
