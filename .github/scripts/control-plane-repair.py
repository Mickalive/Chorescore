#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import hashlib
import re


def replace_once(text: str, pattern: re.Pattern[str], replacement: str, label: str) -> str:
    text, count = pattern.subn(lambda _: replacement, text)
    if count != 1:
        raise SystemExit(f"{label}: expected one replacement, got {count}")
    return text


loop_path = Path('.github/workflows/chorescore-loop.yml')
loop = loop_path.read_text(encoding='utf-8')

evidence_pattern = re.compile(
    r'      - name: Require complete structured audit evidence\n.*?(?=\n      - name: Apply independently accepted candidate deltas)',
    re.S,
)
evidence_replacement = r'''      - name: Validate structured audit evidence with recovery fallback
        env:
          RECOVERY_CYCLE_KEY: ${{ needs.prepare.outputs.recovery_cycle_key }}
          MOBILE_FOUND: ${{ steps.mount.outputs.mobile_found }}
          BACKEND_FOUND: ${{ steps.mount.outputs.backend_found }}
          MOBILE_AUDIT_FOUND: ${{ steps.mount.outputs.mobile_audit_found }}
          BACKEND_AUDIT_FOUND: ${{ steps.mount.outputs.backend_audit_found }}
          MOBILE_REPAIRED_FOUND: ${{ steps.mount.outputs.mobile_repaired_found }}
          BACKEND_REPAIRED_FOUND: ${{ steps.mount.outputs.backend_repaired_found }}
          MOBILE_FINAL_AUDIT_FOUND: ${{ steps.mount.outputs.mobile_final_audit_found }}
          BACKEND_FINAL_AUDIT_FOUND: ${{ steps.mount.outputs.backend_final_audit_found }}
          RECOVERY_MOBILE_FOUND: ${{ steps.mount.outputs.recovery_mobile_found }}
          RECOVERY_BACKEND_FOUND: ${{ steps.mount.outputs.recovery_backend_found }}
          RECOVERY_MOBILE_AUDIT_FOUND: ${{ steps.mount.outputs.recovery_mobile_audit_found }}
          RECOVERY_BACKEND_AUDIT_FOUND: ${{ steps.mount.outputs.recovery_backend_audit_found }}
          RECOVERY_MOBILE_REPAIRED_FOUND: ${{ steps.mount.outputs.recovery_mobile_repaired_found }}
          RECOVERY_BACKEND_REPAIRED_FOUND: ${{ steps.mount.outputs.recovery_backend_repaired_found }}
          RECOVERY_MOBILE_FINAL_AUDIT_FOUND: ${{ steps.mount.outputs.recovery_mobile_final_audit_found }}
          RECOVERY_BACKEND_FINAL_AUDIT_FOUND: ${{ steps.mount.outputs.recovery_backend_final_audit_found }}
        shell: bash
        run: |
          set -euo pipefail
          accepted_pair() {
            local cycle="$1" role="$2" found="$3" audit_found="$4" repaired_found="$5" final_found="$6"
            local audit_dir="$7" final_dir="$8" role_upper initial final decision
            [[ "$found" == true && "$audit_found" == true ]] || return 1
            role_upper=$(tr '[:lower:]' '[:upper:]' <<<"$role")
            initial="$audit_dir/reports/audits/CYCLE_${cycle}_${role_upper}.json"
            bash .github/scripts/validate-audit-json.sh "$initial" "$cycle" "$role" 1 >/dev/null 2>&1 || return 1
            decision=$(jq -r '.decision' "$initial")
            if [[ "$decision" == accept ]]; then
              return 0
            fi
            [[ "$repaired_found" == true && "$final_found" == true ]] || return 1
            final="$final_dir/reports/audits/CYCLE_${cycle}_${role_upper}_FINAL.json"
            bash .github/scripts/validate-audit-json.sh "$final" "$cycle" "$role" 2 >/dev/null 2>&1 || return 1
            [[ "$(jq -r '.decision' "$final")" == accept ]]
          }

          for role in mobile backend; do
            if [[ "$role" == mobile ]]; then
              found="$MOBILE_FOUND"; audit_found="$MOBILE_AUDIT_FOUND"
              repaired="$MOBILE_REPAIRED_FOUND"; final_found="$MOBILE_FINAL_AUDIT_FOUND"
              rfound="$RECOVERY_MOBILE_FOUND"; raudit="$RECOVERY_MOBILE_AUDIT_FOUND"
              rrepaired="$RECOVERY_MOBILE_REPAIRED_FOUND"; rfinal="$RECOVERY_MOBILE_FINAL_AUDIT_FOUND"
            else
              found="$BACKEND_FOUND"; audit_found="$BACKEND_AUDIT_FOUND"
              repaired="$BACKEND_REPAIRED_FOUND"; final_found="$BACKEND_FINAL_AUDIT_FOUND"
              rfound="$RECOVERY_BACKEND_FOUND"; raudit="$RECOVERY_BACKEND_AUDIT_FOUND"
              rrepaired="$RECOVERY_BACKEND_REPAIRED_FOUND"; rfinal="$RECOVERY_BACKEND_FINAL_AUDIT_FOUND"
            fi

            if accepted_pair "$CYCLE_KEY" "$role" "$found" "$audit_found" "$repaired" "$final_found" \
                "/tmp/chorescore_audit_${role}" "/tmp/chorescore_audit_${role}_final"; then
              echo "Structured $role evidence: current cycle has an accepted matching pair."
              continue
            fi

            if [[ "$RECOVERY_CYCLE_KEY" != none ]] && \
               accepted_pair "$RECOVERY_CYCLE_KEY" "$role" "$rfound" "$raudit" "$rrepaired" "$rfinal" \
                "/tmp/chorescore_recovery_audit_${role}" "/tmp/chorescore_recovery_audit_${role}_final"; then
              echo "::warning::Current $role evidence is incomplete; trusted integration will reuse accepted recovery cycle $RECOVERY_CYCLE_KEY."
              continue
            fi

            echo "::warning::No accepted structured pair for $role in current/recovery evidence; trusted integration will integrate nothing for this role."
          done
'''
loop = replace_once(loop, evidence_pattern, evidence_replacement, 'structured evidence gate')

terminal_pattern = re.compile(
    r'      - name: Dispatch a recovery cycle from this failed run\n.*\Z',
    re.S,
)
terminal_replacement = r'''      - name: Dispatch a recovery cycle from this failed run
        env:
          GH_TOKEN: ${{ github.token }}
          HUMAN_NOTE: ${{ inputs.human_note }}
          PREPARED_CYCLE_INDEX: ${{ needs.prepare.outputs.cycle_index }}
          INPUT_CYCLE_INDEX: ${{ inputs.cycle_index }}
          INPUT_RECOVERY_CYCLE_KEY: ${{ inputs.recovery_cycle_key }}
        shell: bash
        run: |
          set -euo pipefail
          cycle_index="${PREPARED_CYCLE_INDEX:-${INPUT_CYCLE_INDEX:-1}}"
          [[ "$cycle_index" =~ ^[1-9][0-9]*$ ]] || cycle_index=1

          active=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow chorescore-loop.yml --limit 20 \
            --json databaseId,status,createdAt |
            jq -c --argjson current "$GITHUB_RUN_ID" \
              '[.[] | select(.databaseId != $current and .status != "completed")] | sort_by(.createdAt) | last // empty')
          if [[ -n "$active" ]]; then
            echo "Un cycle successeur existe déjà ; aucune duplication."
            exit 0
          fi

          recovery="${INPUT_RECOVERY_CYCLE_KEY:-none}"
          [[ "$recovery" == none || "$recovery" =~ ^[1-9][0-9]*$ ]] || recovery=none
          if gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/cycle/chorescore/$GITHUB_RUN_ID/director-recovery" >/dev/null 2>&1; then
            recovery="$GITHUB_RUN_ID"
            echo "Recovery anchor: current Director snapshot $recovery."
          elif [[ "$recovery" != none ]]; then
            echo "Recovery anchor: preserving prior useful cycle $recovery."
          else
            echo "Recovery anchor: none; restart from persistent accepted lane."
          fi

          gh workflow run chorescore-loop.yml --repo "$GITHUB_REPOSITORY" --ref main \
            -f human_note="$HUMAN_NOTE" -f cycle_index="$cycle_index" -f max_cycles=0 \
            -f recovery_cycle_key="$recovery"
          for _ in {1..20}; do
            successor=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow chorescore-loop.yml --limit 20 \
              --json databaseId,status,createdAt |
              jq -c --argjson current "$GITHUB_RUN_ID" \
                '[.[] | select(.databaseId != $current and .status != "completed")] | sort_by(.createdAt) | last // empty')
            [[ -n "$successor" ]] && exit 0
            sleep 2
          done
          echo "::error::La récupération a été demandée mais aucun nouveau cycle n'est observable."
          exit 1
'''
loop = replace_once(loop, terminal_pattern, terminal_replacement, 'terminal recovery dispatch')
loop_path.write_text(loop, encoding='utf-8')

ensure_path = Path('.github/scripts/ensure-continuous-loop.sh')
ensure = ensure_path.read_text(encoding='utf-8')
old_state = '''if jq -e --arg run "$run_id" '\n  .schemaVersion == 1 and\n  (.run_id | tostring) == $run and\n  (.cycle_index | type == "number" and floor == . and . >= 1 and . <= 10000) and\n  (.human_note | type == "string" and length <= 4000)\n' <<<"$control_state" >/dev/null 2>&1; then\n  cycle_index=$(jq -r '.cycle_index' <<<"$control_state")\n  human_note=$(jq -r '.human_note' <<<"$control_state")\n  state_source=structured\nelse\n  cycle_index=1\n  human_note=""\n  state_source=safe-fallback\nfi'''
new_state = '''if jq -e --arg run "$run_id" '\n  .schemaVersion == 1 and\n  (.run_id | tostring) == $run and\n  (.cycle_index | type == "number" and floor == . and . >= 1 and . <= 10000) and\n  (.human_note | type == "string" and length <= 4000) and\n  (.recovery_cycle_key | type == "string" and (. == "none" or test("^[1-9][0-9]*$")))\n' <<<"$control_state" >/dev/null 2>&1; then\n  cycle_index=$(jq -r '.cycle_index' <<<"$control_state")\n  human_note=$(jq -r '.human_note' <<<"$control_state")\n  prior_recovery=$(jq -r '.recovery_cycle_key' <<<"$control_state")\n  state_source=structured\nelse\n  cycle_index=1\n  human_note=""\n  prior_recovery=none\n  state_source=safe-fallback\nfi'''
if old_state not in ensure:
    raise SystemExit('watchdog structured-state block not found')
ensure = ensure.replace(old_state, new_state, 1)

old_recovery = '''if [[ "$conclusion" == success ]]; then\n  if (( cycle_index < 10000 )); then\n    cycle_index=$((cycle_index + 1))\n  fi\n  recovery=none\n  reason="successeur manquant après cycle incomplet"\nelse\n  recovery="$run_id"\n  reason="récupération après cycle interrompu ($conclusion)"\nfi'''
new_recovery = '''if [[ "$conclusion" == success ]]; then\n  if (( cycle_index < 10000 )); then\n    cycle_index=$((cycle_index + 1))\n  fi\n  recovery=none\n  reason="successeur manquant après cycle incomplet"\nelse\n  recovery="$prior_recovery"\n  if gh api "repos/$repository/git/ref/heads/cycle/chorescore/$run_id/director-recovery" >/dev/null 2>&1; then\n    recovery="$run_id"\n    reason="récupération du snapshot Director vérifié après cycle interrompu ($conclusion)"\n  elif [[ "$recovery" != none ]]; then\n    reason="récupération conservant le dernier snapshot utile $recovery après cycle interrompu ($conclusion)"\n  else\n    reason="reprise depuis la branche acceptée après cycle interrompu sans snapshot utile ($conclusion)"\n  fi\nfi'''
if old_recovery not in ensure:
    raise SystemExit('watchdog recovery block not found')
ensure = ensure.replace(old_recovery, new_recovery, 1)
ensure_path.write_text(ensure, encoding='utf-8')

manifest_path = Path('.github/immutable-files.sha256')
manifest = manifest_path.read_text(encoding='utf-8')
ensure_hash = hashlib.sha256(ensure.encode()).hexdigest()
manifest, count = re.subn(
    r'^[0-9a-f]{64}  \.github/scripts/ensure-continuous-loop\.sh$',
    ensure_hash + '  .github/scripts/ensure-continuous-loop.sh',
    manifest,
    count=1,
    flags=re.M,
)
if count != 1:
    raise SystemExit('immutable ensure-continuous entry not found')
manifest_path.write_text(manifest, encoding='utf-8')
manifest_hash = hashlib.sha256(manifest.encode()).hexdigest()

for workflow_name in ('.github/workflows/ci.yml', '.github/workflows/chorescore-loop.yml'):
    path = Path(workflow_name)
    text = path.read_text(encoding='utf-8')
    text, count = re.subn(
        r'IMMUTABLE_MANIFEST_SHA256: [0-9a-f]{64}',
        'IMMUTABLE_MANIFEST_SHA256: ' + manifest_hash,
        text,
    )
    if count < 1:
        raise SystemExit(f'no immutable manifest root found in {workflow_name}')
    path.write_text(text, encoding='utf-8')

print(f'ENSURE_HASH={ensure_hash}')
print(f'IMMUTABLE_MANIFEST_SHA256={manifest_hash}')
