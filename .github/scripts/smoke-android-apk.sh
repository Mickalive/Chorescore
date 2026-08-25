#!/usr/bin/env bash
set -euo pipefail

apk="${1:?APK path is required}"
package="${2:-com.mickalive.chorescore}"
output_dir="${3:-${RUNNER_TEMP:?}/chorescore-runtime-smoke}"

test -s "$apk"
mkdir -p "$output_dir"

start_log="$output_dir/activity-start.txt"
runtime_log="$output_dir/logcat.txt"
hierarchy="$output_dir/window.xml"
screenshot="$output_dir/launch.png"

adb install -r "$apk"
adb shell svc wifi disable || true
adb shell svc data disable || true
adb logcat -c

adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity" | tr -d '\r' | tee "$start_log"
grep -Eq '^Status: ok$' "$start_log"

rendered=false
for _ in {1..20}; do
  pid=$(adb shell pidof "$package" | tr -d '\r' || true)
  if [[ -n "$pid" ]] &&
     adb shell uiautomator dump /sdcard/chorescore-window.xml >/dev/null 2>&1 &&
     adb pull /sdcard/chorescore-window.xml "$hierarchy" >/dev/null 2>&1 &&
     grep -Fq 'ChoreScore' "$hierarchy"; then
    rendered=true
    break
  fi
  sleep 2
done

if [[ "$rendered" != true ]]; then
  adb logcat -d > "$runtime_log" || true
  echo "ChoreScore did not render a visible accessibility node." >&2
  exit 1
fi

pid=$(adb shell pidof "$package" | tr -d '\r')
test -n "$pid"
adb logcat --pid="$pid" -d > "$runtime_log" || adb logcat -d > "$runtime_log"
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime.*FATAL|ReactNativeJS.*(TypeError|ReferenceError|Invariant Violation|Unable to resolve)' "$runtime_log"; then
  echo "A fatal Android or React Native error was detected." >&2
  exit 1
fi

adb exec-out screencap -p > "$screenshot"
test -s "$screenshot"

adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity" | tr -d '\r' > "$output_dir/activity-restart.txt"
sleep 3
test -n "$(adb shell pidof "$package" | tr -d '\r')"

printf 'APK runtime smoke passed: package=%s pid=%s network=disabled metro=not-required\n' "$package" "$pid"
