#!/usr/bin/env bash
set -euo pipefail

loop=.github/workflows/chorescore-loop.yml
supervisor=.github/workflows/chorescore-launch.yml
ci=.github/workflows/ci.yml

test "$(find .github/workflows -maxdepth 1 -type f -name '*.yml' | wc -l)" -eq 3
grep -Fq 'OX_MODEL: opencode/x-preview-f-free' "$loop"
grep -Fq 'OPENCODE_RETRY_DELAY_SECONDS: "300"' "$loop"
grep -Fq 'group: chorescore-loop-v2-${{ github.run_id }}' "$loop"
grep -Fq 'bash .github/scripts/integrate-audited-candidates.sh' "$loop"
grep -Fq 'bash .github/scripts/trusted-product-tree.sh verify' "$loop"
grep -Fq 'bash .github/scripts/verify-final-release.sh' "$loop"
grep -Fq 'retention-days: 90' "$loop"
! grep -Fq 'Dispatch next audited cycle' "$loop"
! grep -Fq 'terminal_failure_report:' "$loop"
grep -Fq 'name: ChoreScore Supervisor' "$supervisor"
grep -Fq 'cron: "*/5 * * * *"' "$supervisor"
grep -Fq '"ChoreScore Autonomous App Loop"' "$supervisor"
grep -Fq 'Garbage-collect obsolete cycle state and runs' "$supervisor"
grep -Fq 'Final release fully attested' "$supervisor"
! grep -Fq 'ensure-continuous-loop.sh' "$supervisor"
! grep -Fq 'schedule:' "$ci"
! grep -Fq 'Continuity watchdog' "$ci"
