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

stage="bootstrap"

dump_ui() {
  adb shell uiautomator dump /sdcard/chorescore-window.xml >/dev/null 2>&1
  adb pull /sdcard/chorescore-window.xml "$hierarchy" >/dev/null 2>&1
}

foreground_state() {
  adb shell dumpsys activity activities 2>/dev/null | grep -E -m1 'topResumedActivity|mResumedActivity|ResumedActivity' || \
    adb shell dumpsys window windows 2>/dev/null | grep -E -m1 'mCurrentFocus|mFocusedApp' || true
}

assert_foreground() {
  local where="$1" state
  state="$(foreground_state)"
  if [[ "$state" != *"$package"* ]]; then
    echo "::error::ChoreScore a quitté le premier plan pendant: $where" >&2
    echo "FOREGROUND_STATE $state" >&2
    return 1
  fi
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
    echo "SMOKE_STAGE $stage"
    echo "FOREGROUND_STATE $(foreground_state)"
    echo "APP_PID $(adb shell pidof "$package" 2>/dev/null | tr -d '\r' || true)"
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

# Return bounds for the matched semantic node's nearest clickable ancestor.
# React Native often exposes visible Text as a child of the actual Pressable;
# tapping the child coordinates directly can hit system navigation after scroll.
node_bounds() {
  local mode="$1" needle="$2"
  python3 - "$hierarchy" "$mode" "$needle" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, mode, needle = sys.argv[1:]
root = ET.parse(path).getroot()
parent = {child: node for node in root.iter() for child in node}

def matches(node):
    values = (node.attrib.get("text", ""), node.attrib.get("content-desc", ""))
    for value in values:
        if mode == "exact" and value == needle:
            return True
        if mode == "prefix" and value.startswith(needle):
            return True
        if mode == "contains" and needle in value:
            return True
    return False

def bounds(node):
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    return match.groups() if match else None

for node in root.iter("node"):
    if not matches(node):
        continue
    current = node
    while current is not None:
        parsed = bounds(current)
        if parsed and current.attrib.get("clickable") == "true" and current.attrib.get("enabled", "true") == "true":
            print(" ".join(parsed))
            raise SystemExit(0)
        current = parent.get(current)
    parsed = bounds(node)
    if parsed:
        print(" ".join(parsed))
        raise SystemExit(0)
raise SystemExit(1)
PY
}

screen_height() {
  adb shell wm size 2>/dev/null | tr -d '\r' | sed -nE 's/.*Physical size: [0-9]+x([0-9]+).*/\1/p' | head -n1
}

wait_node() {
  local mode="$1" needle="$2" attempts="${3:-30}"
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    assert_foreground "attente de '$needle'" || return 1
    if dump_ui && node_bounds "$mode" "$needle" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "::error::Nœud Android introuvable: mode=$mode valeur=$needle" >&2
  return 1
}

tap_node() {
  local mode="$1" needle="$2" attempts="${3:-20}" bounds x1 y1 x2 y2 height center_y
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    assert_foreground "recherche du contrôle '$needle'" || return 1
    if dump_ui && bounds=$(node_bounds "$mode" "$needle" 2>/dev/null); then
      read -r x1 y1 x2 y2 <<<"$bounds"
      height="$(screen_height)"
      center_y=$(((y1 + y2) / 2))
      # Keep taps away from Android's gesture/navigation area.
      if [[ -n "$height" && "$center_y" -gt $((height - 180)) ]]; then
        adb shell input swipe 540 "$((height - 450))" 540 "$((height / 2))" 300
        sleep 1
        continue
      fi
      adb shell input tap "$(((x1 + x2) / 2))" "$center_y"
      sleep 1
      assert_foreground "clic sur '$needle'" || return 1
      return 0
    fi
    sleep 1
  done
  echo "::error::Contrôle Android non cliquable: mode=$mode valeur=$needle" >&2
  return 1
}

tap_node_with_scroll() {
  local mode="$1" needle="$2" bounds x1 y1 x2 y2 height center_y
  for _ in {1..12}; do
    assert_foreground "recherche avec défilement de '$needle'" || return 1
    if dump_ui && bounds=$(node_bounds "$mode" "$needle" 2>/dev/null); then
      read -r x1 y1 x2 y2 <<<"$bounds"
      height="$(screen_height)"
      center_y=$(((y1 + y2) / 2))
      if [[ -n "$height" && "$center_y" -gt $((height - 180)) ]]; then
        adb shell input swipe 540 "$((height - 450))" 540 "$((height / 2))" 300
        sleep 1
        continue
      fi
      adb shell input tap "$(((x1 + x2) / 2))" "$center_y"
      sleep 1
      assert_foreground "clic sur '$needle'" || return 1
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
    assert_foreground "attente avec défilement de '$needle'" || return 1
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
  if tap_node_with_scroll exact "J’ai compris les conditions de la démonstration" 2>/dev/null; then
    return 0
  fi
  tap_node_with_scroll contains "J’ai compris et j’accepte les conditions"
}

stage="install"
adb install -r "$apk"
adb shell svc wifi disable || true
adb shell svc data disable || true
adb logcat -c

stage="cold-launch"
adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity" | tr -d '\r' | tee "$start_log"
grep -Eq '^Status: ok$' "$start_log"
sleep 1
assert_foreground "lancement initial"

stage="onboarding-visible"
wait_node contains "Prendre soin du foyer, ensemble." 45
adb exec-out screencap -p >"$output_dir/01-onboarding.png"

stage="accept-terms"
tap_onboarding_consent
adb exec-out screencap -p >"$output_dir/01b-terms-accepted.png"

stage="enter-app"
tap_node_with_scroll contains "Entrer dans la démo"
assert_foreground "sortie de l’onboarding"

stage="tasks-home"
wait_node contains "Tâches du foyer" 45
adb exec-out screencap -p >"$output_dir/02-home.png"

stage="start-timer"
tap_node_with_scroll prefix "Démarrer le chrono de "
wait_node_with_scroll exact "Chrono en cours"
adb exec-out screencap -p >"$output_dir/03-timer-running.png"

stage="restart-with-timer"
adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity" | tr -d '\r' >"$output_dir/activity-restart.txt"
sleep 1
assert_foreground "relance avec chrono actif"
wait_node_with_scroll exact "Chrono en cours"

stage="finish-timer"
tap_node_with_scroll prefix "Terminer le chrono de "
wait_node contains "Tâches saisies"

stage="history"
tap_node contains "Historique"
wait_node contains "Relis les saisies du foyer"

stage="leaderboard"
tap_node contains "Classement"
wait_node exact "POINT DE REPÈRE PERSONNEL"

stage="profile"
tap_node contains "Profil"
wait_node contains "Change de membre pour explorer la démo"
adb exec-out screencap -p >"$output_dir/04-profile.png"

stage="runtime-audit"
pid=$(adb shell pidof "$package" | tr -d '\r')
test -n "$pid"
adb logcat --pid="$pid" -d >"$runtime_log" || adb logcat -d >"$runtime_log"
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime.*FATAL|ReactNativeJS.*(TypeError|ReferenceError|Invariant Violation|Unable to resolve)' "$runtime_log"; then
  echo "A fatal Android or React Native error was detected." >&2
  exit 1
fi

stage="complete"
trap - EXIT
printf 'APK product smoke passed: package=%s pid=%s network=disabled metro=not-required onboarding=true timer-restart=true navigation=true\n' "$package" "$pid"
