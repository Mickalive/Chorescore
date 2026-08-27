#!/usr/bin/env bash
set -euo pipefail

max_attempts="${OPENCODE_MAX_ATTEMPTS:-3}"
retry_delay="${OPENCODE_RETRY_DELAY_SECONDS:-300}"
attempt_timeout="${OPENCODE_ATTEMPT_TIMEOUT_SECONDS:-2400}"
label="${OPENCODE_RETRY_LABEL:-agent}"

[[ "$max_attempts" =~ ^([1-9]|1[0-2])$ ]]
[[ "$retry_delay" =~ ^[0-9]+$ ]]
[[ "$attempt_timeout" =~ ^[0-9]+$ ]]
(( retry_delay >= 30 && retry_delay <= 900 ))
(( attempt_timeout >= 600 && attempt_timeout <= 7200 ))
(( $# > 0 ))

log_file=$(mktemp "${RUNNER_TEMP:?}/opencode-${label}.XXXXXX.log")
trap 'rm -f "$log_file"' EXIT

for ((attempt=1; attempt<=max_attempts; attempt++)); do
  : >"$log_file"
  echo "OpenCode $label: attempt $attempt/$max_attempts"
  set +e
  timeout --signal=TERM --kill-after=30s "$attempt_timeout" "$@" 2>&1 | tee "$log_file"
  status=${PIPESTATUS[0]}
  set -e
  (( status == 0 )) && exit 0

  if ! grep -Eqi \
    'network_error|network error|unexpected server error|internal server error|temporarily unavailable|endpoint is unavailable|service unavailable|bad gateway|gateway timeout|too many requests|upstream request failed|provider[^[:cntrl:]]*unavailable|connection (reset|closed|refused)|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timed out|timeout|rate[_ -]?limit|HTTP[^0-9]*(429|500|502|503|504)' \
    "$log_file"; then
    echo "::error::OpenCode $label failed with non-transient status $status." >&2
    exit "$status"
  fi

  if (( attempt == max_attempts )); then
    echo "::warning::Ox/provider remains unavailable for $label after $max_attempts attempts; the next factory run will retry this lane." >&2
    exit 75
  fi
  echo "::warning::Transient Ox/provider failure for $label; retrying in ${retry_delay}s." >&2
  sleep "$retry_delay"
done
