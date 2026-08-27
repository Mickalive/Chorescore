#!/usr/bin/env bash
set -euo pipefail

sha256sum --check --strict .github/immutable-files.sha256
