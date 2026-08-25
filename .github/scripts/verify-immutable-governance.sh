#!/usr/bin/env bash
set -euo pipefail

: "${IMMUTABLE_MANIFEST_SHA256:?IMMUTABLE_MANIFEST_SHA256 is required}"

printf '%s  .github/immutable-files.sha256\n' "$IMMUTABLE_MANIFEST_SHA256" |
  sha256sum --check --strict
sha256sum --check --strict .github/immutable-files.sha256
