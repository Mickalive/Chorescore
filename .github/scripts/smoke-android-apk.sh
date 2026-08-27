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

dump_ui() {
  adb shell uiautomator dump /sdcard/chorescore-window.xml >/dev/null 2>&1
  adb pull /sdcard/chorescore-window.xml "$hierarchy" >/dev/null 2>&1
}

print_ui_evidence() {
  [[ -s "$hierarchy" ]] || return 0
  python3 - "$hierarchy" <<'PY'
import sys
import xml.etree.ElementTree as ET

try:
    root = ET.parse(sys.argv[1]).getroot()
except Exception as exc:
    print(f"UI_EVIDENCE parse-error: {exc}")
    raise SystemExit(0)
seen = []
for node in root.iter("node"):
    for key in ("text", "content-desc"):
        value = node.attrib.get(key, "").strip()
        if value and value not in seen:
            seen.append(value)
for value in seen[:120]:
    print(f"UI_EVIDENCE {value}")
PY
}

capture_failure() {
  local code=$?
  if [[ "$code" -ne 0 ]]; then
    echo "::group::Android failure evidence"
    adb exec-out screencap -p >"$output_dir/99-failure.png" 2>/dev/null || true
    dump_ui || true
    adb logcat -d >"$output_dir/failure-logcat.txt" 2>/dev/null || true
    adb shell dumpsys activity activities >"$output_dir/activity-state.txt" 2>/dev/null || true
    adb shell pidof "$package" >"$output_dir/pid.txt" 2>/dev/null || true
    print_ui_evidence || true
    echo "--- fatal/runtime candidates ---"
    grep -Eai 'FATAL EXCEPTION|AndroidRuntime.*FATAL|ReactNativeJS|SoLoader|UnsatisfiedLinkError|TypeError|ReferenceError|Invariant Violation|Unable to resolve' "$output_dir/failure-logcat.txt" | tail -n 120 || true
    echo "::endgroup::"
  fi
  exit "$code"
}
trap capture_failure EXIT

node_bounds() {
  local mode="$1" needle="$2"
  python3 - "$hierarchy" "$mode" "$needle" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, mode, needle = sys.argv[1:]
root = ET.parse(path).getroot()
for node in root.iter("node"):
    values = (node.attrib.get("text", ""), node.attrib.get("content-desc", ""))
    matched = any(
        value == needle if mode == "exact" else
        value.startswith(needle) if mode == "prefix" else
        needle in value
        for value in values
    )
    if not matched:
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if match:
        print(" ".join(match.groups()))
        raise SystemExit(0)
raise SystemExit(1)
PY
}

wait_node() {
  local mode="$1" needle="$2" attempts="${3:-30}"
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if dump_ui && node_bounds "$mode" "$needle" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "::error::Nœud Android introuvable: mode=$mode valeur=$needle" >&2
  return 1
}

tap_node() {
  local mode="$1" needle="$2" attempts="${3:-20}" bounds x1 y1 x2 y2
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if dump_ui && bounds=$(node_bounds "$mode" "$needle" 2>/dev/null); then
      read -r x1 y1 x2 y2 <<<"$bounds"
      adb shell input tap "$(((x1 + x2) / 2))" "$(((y1 + y2) / 2))"
      return 0
    fi
    sleep 1
  done
  echo "::error::Contrôle Android non cliquable: mode=$mode valeur=$needle" >&2
  return 1
}

tap_node_with_scroll() {
  local mode="$1" needle="$2" bounds x1 y1 x2 y2
  for _ in {1..12}; do
    if dump_ui && bounds=$(node_bounds "$mode" "$needle" 2>/dev/null); then
      read -r x1 y1 x2 y2 <<<"$bounds"
      adb shell input tap "$(((x1 + x2) / 2))" "$(((y1 + y2) / 2))"
      return 0
    fi
    adb shell input swipe 540 1800 540 650 350
    sleep 1
  done
  echo "::error::Contrôle Android introuvable après défilement: $needle" >&2
  return 1
}

wait_node_with_scroll() {
  local mode="$1" needle="$2"
  for _ in {1..12}; do
    if dump_ui && node_bounds "$mode" "$needle" >/dev/null 2>&1; then
      return 0
    fi
    adb shell input swipe 540 1800 540 650 350
    sleep 1
  done
  echo "::error::État Android introuvable après défilement: $needle" >&2
  return 1
}

tap_onboarding_consent() {
  # React Native can expose a Pressable's accessibilityLabel as content-desc,
  # or only expose the visible child Text depending on renderer/API details.
  # Both prove the same real control and both tap inside the Pressable row.
  if tap_node_with_scroll exact "J’ai compris les conditions de la démonstration" 2>/dev/null; then
    return 0
  fi
  tap_node_with_scroll contains "J’ai compris et j’accepte les conditions"
}

adb install -r "$apk"
adb shell svc wifi disable || true
adb shell svc data disable || true
adb logcat -c

adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity" | tr -d '\r' | tee "$start_log"
grep -Eq '^Status: ok$' "$start_log"

# Fresh install: prove the actual onboarding screen first. Do not depend on a
# renderer-specific checkbox content-desc for deciding whether the screen exists.
wait_node contains "Prendre soin du foyer, ensemble." 45
adb exec-out screencap -p >"$output_dir/01-onboarding.png"
tap_onboarding_consent
tap_node_with_scroll contains "Entrer dans la démo"
wait_node contains "Tâches du foyer" 45
adb exec-out screencap -p >"$output_dir/02-home.png"

# Exercise a real mutation, then prove that the active timer survives a process
# restart with the device fully offline and without Metro.
tap_node_with_scroll prefix "Démarrer le chrono de "
wait_node_with_scroll exact "Chrono en cours"
adb exec-out screencap -p >"$output_dir/03-timer-running.png"

adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity" | tr -d '\r' >"$output_dir/activity-restart.txt"
wait_node_with_scroll exact "Chrono en cours"
tap_node_with_scroll prefix "Terminer le chrono de "
wait_node contains "Tâches saisies"

# Visit every primary destination and assert screen-specific content rather
# than merely checking that the app process exists.
tap_node contains "Historique"
wait_node contains "Relis les saisies du foyer"
tap_node contains "Classement"
wait_node exact "POINT DE REPÈRE PERSONNEL"
tap_node contains "Profil"
wait_node contains "Change de membre pour explorer la démo"
adb exec-out screencap -p >"$output_dir/04-profile.png"

pid=$(adb shell pidof "$package" | tr -d '\r')
test -n "$pid"
adb logcat --pid="$pid" -d >"$runtime_log" || adb logcat -d >"$runtime_log"
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime.*FATAL|ReactNativeJS.*(TypeError|ReferenceError|Invariant Violation|Unable to resolve)' "$runtime_log"; then
  echo "A fatal Android or React Native error was detected." >&2
  exit 1
fi

trap - EXIT
printf 'APK product smoke passed: package=%s pid=%s network=disabled metro=not-required onboarding=true timer-restart=true navigation=true\n' "$package" "$pid"
