#!/usr/bin/env bash
set -euo pipefail

loop=.github/workflows/chorescore-loop.yml
launch=.github/workflows/chorescore-launch.yml
ci=.github/workflows/ci.yml

test "$(find .github/workflows -maxdepth 1 -type f -name '*.yml' | wc -l)" -eq 3
grep -Fq 'OPENCODE_RETRY_DELAY_SECONDS: "300"' "$loop"
grep -Fq 'bash .github/scripts/integrate-audited-candidates.sh' "$loop"
grep -Fq 'bash .github/scripts/trusted-product-tree.sh verify' "$loop"
grep -Fq 'bash .github/scripts/verify-final-release.sh' "$loop"
grep -Fq 'reports/artifacts' "$loop"
grep -Fq 'retention-days: 90' "$loop"
grep -Fq 'sleep 720' "$launch"
grep -Fq 'max_cycles=0' "$loop"
grep -Fq 'max_cycles=0' .github/scripts/ensure-continuous-loop.sh
! grep -Fq 'recover-transient-opencode.sh' "$launch"
! grep -Fq 'Prune completed runs superseded by this cycle' "$loop"
grep -Fq 'verify-workflow-architecture.sh' "$ci"
