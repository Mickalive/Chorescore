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
for value in seen[:160]:
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
    grep -Eai 'FATAL EXCEPTION|AndroidRuntime.*FATAL|ReactNativeJS|SoLoader|UnsatisfiedLinkError|TypeError|ReferenceError|Invariant Violation|Unable to resolve' "$output_dir/failure-logcat.txt" | tail -n 160 || true
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
parent = {child: node for node in root.iter() for child in node}

def matches(node):
    for value in (node.attrib.get("text", ""), node.attrib.get("content-desc", "")):
        if mode == "exact" and value == needle:
            return True
        if mode == "prefix" and value.startswith(needle):
            return True
        if mode == "contains" and needle in value:
            return True
    return False

def bounds(node):
    m = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    return m.groups() if m else None

for node in root.iter("node"):
    if not matches(node):
        continue
    cur = node
    while cur is not None:
        parsed = bounds(cur)
        if parsed and cur.attrib.get("clickable") == "true" and cur.attrib.get("enabled", "true") == "true":
            print(" ".join(parsed))
            raise SystemExit(0)
        cur = parent.get(cur)
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

scroll_toward_top() {
  local height="${1:-2200}"
  adb shell input swipe 540 700 540 "$((height - 350))" 250
}

scroll_toward_bottom() {
  local height="${1:-2200}"
  adb shell input swipe 540 "$((height - 450))" 540 650 300
}

reset_to_top() {
  local height
  height="$(screen_height)"
  [[ -n "$height" ]] || height=2200
  for _ in {1..7}; do
    scroll_toward_top "$height"
    sleep 0.25
  done
}

# Search the complete scrollable surface deterministically: current viewport first,
# then reset to the top and scan downward. This avoids the old one-way search bug
# where a state appearing above the tapped task could never be observed.
find_node_anywhere() {
  local mode="$1" needle="$2" passes="${3:-2}" height bounds
  height="$(screen_height)"
  [[ -n "$height" ]] || height=2200

  if dump_ui && bounds=$(node_bounds "$mode" "$needle" 2>/dev/null); then
    printf '%s\n' "$bounds"
    return 0
  fi

  for ((pass = 1; pass <= passes; pass++)); do
    reset_to_top
    for _ in {1..14}; do
      assert_foreground "recherche de '$needle'" || return 1
      if dump_ui && bounds=$(node_bounds "$mode" "$needle" 2>/dev/null); then
        printf '%s\n' "$bounds"
        return 0
      fi
      scroll_toward_bottom "$height"
      sleep 0.4
    done
  done
  return 1
}

wait_anywhere() {
  local mode="$1" needle="$2" attempts="${3:-3}"
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    assert_foreground "attente de '$needle'" || return 1
    if find_node_anywhere "$mode" "$needle" 1 >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "::error::État Android introuvable: mode=$mode valeur=$needle" >&2
  return 1
}

tap_anywhere() {
  local mode="$1" needle="$2" attempts="${3:-3}" bounds x1 y1 x2 y2 height center_y
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    assert_foreground "recherche du contrôle '$needle'" || return 1
    if bounds=$(find_node_anywhere "$mode" "$needle" 1 2>/dev/null); then
      read -r x1 y1 x2 y2 <<<"$bounds"
      height="$(screen_height)"
      [[ -n "$height" ]] || height=2200
      center_y=$(((y1 + y2) / 2))
      if [[ "$center_y" -gt $((height - 160)) ]]; then
        scroll_toward_bottom "$height"
        sleep 0.6
        continue
      fi
      adb shell input tap "$(((x1 + x2) / 2))" "$center_y"
      sleep 1
      assert_foreground "clic sur '$needle'" || return 1
      return 0
    fi
    sleep 1
  done
  echo "::error::Contrôle Android introuvable ou non cliquable: mode=$mode valeur=$needle" >&2
  return 1
}

tap_onboarding_consent() {
  if tap_anywhere exact "J’ai compris les conditions de la démonstration" 2 2>/dev/null; then
    return 0
  fi
  tap_anywhere contains "J’ai compris et j’accepte les conditions" 2
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
wait_anywhere contains "Prendre soin du foyer, ensemble." 4
adb exec-out screencap -p >"$output_dir/01-onboarding.png"

stage="accept-terms"
tap_onboarding_consent
adb exec-out screencap -p >"$output_dir/01b-terms-accepted.png"

stage="enter-app"
tap_anywhere contains "Entrer dans la démo" 3
assert_foreground "sortie de l’onboarding"

stage="tasks-home"
wait_anywhere contains "Tâches du foyer" 4
adb exec-out screencap -p >"$output_dir/02-home.png"

stage="start-timer"
for attempt in {1..3}; do
  if tap_anywhere prefix "Démarrer le chrono de " 1 && wait_anywhere exact "Chrono en cours" 1; then
    break
  fi
  if [[ "$attempt" -eq 3 ]]; then
    echo "::error::Le chrono n'a pas pu être confirmé après trois tentatives." >&2
    exit 1
  fi
  sleep 1
 done
adb exec-out screencap -p >"$output_dir/03-timer-running.png"

stage="restart-with-timer"
adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity" | tr -d '\r' >"$output_dir/activity-restart.txt"
sleep 1
assert_foreground "relance avec chrono actif"
wait_anywhere exact "Chrono en cours" 3

stage="finish-timer"
tap_anywhere prefix "Terminer le chrono de " 3
wait_anywhere contains "Tâches saisies" 3

stage="history"
tap_anywhere contains "Historique" 3
wait_anywhere contains "Relis les saisies du foyer" 3

stage="leaderboard"
tap_anywhere contains "Classement" 3
wait_anywhere exact "POINT DE REPÈRE PERSONNEL" 3

stage="profile"
tap_anywhere contains "Profil" 3
wait_anywhere contains "Change de membre pour explorer la démo" 3
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
