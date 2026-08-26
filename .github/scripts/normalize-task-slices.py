#!/usr/bin/env python3
"""Canonicalize the ChoreScore Director control contract.

The task-slicing representation is always:

    "slices": [
      {"id": "a", "objective": "...", "allowedPaths": ["..."]},
      {"id": "b", "objective": "...", "allowedPaths": ["..."]}
    ]

For backward compatibility only, the exact keyed-object form {"a": {...},
"b": {...}} is migrated deterministically. No other malformed slice shape is
guessed.

When invoked after the Director has produced the current cycle report, the same
pass also canonicalizes *non-semantic* bookkeeping that the strict validator
bounds mechanically: free-form prose lengths, the cycle bookkeeping fields,
disabled-role stale slices, and literal machine tags in Markdown. It never
repairs semantic contradictions such as criterion regressions, missing audit
evidence, unresolved release blockers, invalid role/criterion assignments,
overlapping slice scopes, or an invalid continue/stop decision. Those remain
fail-closed in validate-release-state.sh.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any


def fail(message: str) -> None:
    raise SystemExit(message)


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read JSON {path}: {exc}")


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def clamp_text(value: Any, limit: int, label: str) -> tuple[Any, bool]:
    if not isinstance(value, str) or len(value) <= limit:
        return value, False
    suffix = " … [canonicalized]"
    keep = max(0, limit - len(suffix))
    result = value[:keep].rstrip() + suffix
    result = result[:limit]
    print(
        f"Canonicalized non-semantic prose bound {label}: "
        f"{len(value)} -> {len(result)} chars.",
        file=sys.stderr,
    )
    return result, True


def normalize_slices(tasks: dict[str, Any]) -> bool:
    assignments = tasks.get("assignments")
    if not isinstance(assignments, dict):
        fail("task contract assignments must be an object")

    changed = False
    for role in ("mobile", "backend"):
        assignment = assignments.get(role)
        if not isinstance(assignment, dict):
            fail(f"task contract assignment {role} must be an object")

        slices = assignment.get("slices")
        if slices is None or slices == []:
            continue

        if assignment.get("enabled") is False:
            assignment.pop("slices", None)
            changed = True
            print(
                f"Removed stale slices from disabled {role} assignment.",
                file=sys.stderr,
            )
            continue

        if isinstance(slices, list):
            # Canonical-looking lists are left untouched. The strict semantic
            # validator remains authoritative for ids, paths, overlap and role
            # scope.
            continue

        if not isinstance(slices, dict):
            fail(f"{role} slices must be a canonical list or legacy a/b object")
        if set(slices) != {"a", "b"}:
            fail(f"{role} legacy slice object must contain exactly keys a and b")

        canonical = []
        for slice_id in ("a", "b"):
            item = slices[slice_id]
            if not isinstance(item, dict):
                fail(f"{role} legacy slice {slice_id} must be an object")
            existing_id = item.get("id")
            if existing_id not in (None, slice_id):
                fail(
                    f"{role} legacy slice {slice_id} carries conflicting id "
                    f"{existing_id!r}"
                )
            normalized_item = dict(item)
            normalized_item["id"] = slice_id
            canonical.append(normalized_item)

        assignment["slices"] = canonical
        changed = True
        print(
            f"Canonicalized legacy {role} slices object to ordered a/b list.",
            file=sys.stderr,
        )
    return changed


def canonicalize_task_prose(tasks: dict[str, Any]) -> bool:
    assignments = tasks.get("assignments")
    if not isinstance(assignments, dict):
        return False

    changed = False
    for role in ("mobile", "backend"):
        assignment = assignments.get(role)
        if not isinstance(assignment, dict):
            continue
        value, did = clamp_text(
            assignment.get("objective"), 2000, f"tasks.{role}.objective"
        )
        if did:
            assignment["objective"] = value
            changed = True

        acceptance = assignment.get("acceptance")
        if isinstance(acceptance, list):
            for index, item in enumerate(acceptance):
                value, did = clamp_text(
                    item, 1000, f"tasks.{role}.acceptance[{index}]"
                )
                if did:
                    acceptance[index] = value
                    changed = True
    return changed


def canonicalize_status(
    status: dict[str, Any],
    before: dict[str, Any],
    cycle: str,
) -> bool:
    changed = False

    if status.get("lastCycle") != cycle:
        status["lastCycle"] = cycle
        changed = True
        print(f"Canonicalized release lastCycle to {cycle}.", file=sys.stderr)

    value, did = clamp_text(status.get("progressSummary"), 2000, "release.progressSummary")
    if did:
        status["progressSummary"] = value
        changed = True

    blocker = status.get("blocker")
    if isinstance(blocker, dict):
        for key in ("reason", "humanAction"):
            value, did = clamp_text(blocker.get(key), 1000, f"release.blocker.{key}")
            if did:
                blocker[key] = value
                changed = True

    criteria = status.get("criteria")
    if isinstance(criteria, list):
        for c_index, criterion in enumerate(criteria):
            if not isinstance(criterion, dict):
                continue
            evidence = criterion.get("evidence")
            if not isinstance(evidence, list):
                continue
            for e_index, item in enumerate(evidence):
                if not isinstance(item, dict):
                    continue
                value, did = clamp_text(
                    item.get("reference"),
                    1000,
                    f"release.criteria[{c_index}].evidence[{e_index}].reference",
                )
                if did:
                    item["reference"] = value
                    changed = True

    old_findings = {
        item.get("id"): item
        for item in before.get("openFindings", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    findings = status.get("openFindings")
    if isinstance(findings, list):
        for index, item in enumerate(findings):
            if not isinstance(item, dict):
                continue
            finding_id = item.get("id")
            # Existing requiredFix text is intentionally immutable. Only a
            # newly introduced finding may have an overlong free-form fix
            # canonicalized; edits to old findings remain a strict failure.
            if isinstance(finding_id, str) and finding_id not in old_findings:
                value, did = clamp_text(
                    item.get("requiredFix"),
                    2000,
                    f"release.openFindings[{index}].requiredFix",
                )
                if did:
                    item["requiredFix"] = value
                    changed = True

    before_criteria = {
        item.get("id"): item
        for item in before.get("criteria", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }

    def rank(value: Any) -> int:
        if value == "pending":
            return 0
        if value in ("in_progress", "blocked"):
            return 1
        if value == "complete":
            return 2
        return -1

    objective_progress = False
    if isinstance(criteria, list):
        for current in criteria:
            if not isinstance(current, dict):
                continue
            old = before_criteria.get(current.get("id"))
            if not isinstance(old, dict):
                continue
            current_evidence = current.get("evidence")
            old_evidence = old.get("evidence")
            if (
                rank(current.get("status")) > rank(old.get("status"))
                or (
                    isinstance(current_evidence, list)
                    and isinstance(old_evidence, list)
                    and len(current_evidence) > len(old_evidence)
                )
            ):
                objective_progress = True
                break

    product_paths = [
        "app",
        "src",
        "tests",
        "functions/src",
        "functions/test",
        "firestore.rules",
        "firestore.indexes.json",
        "storage.rules",
        "firebase.json",
    ]
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain", "--", *product_paths],
            check=True,
            text=True,
            capture_output=True,
        )
        code_changed = bool(result.stdout.strip())
    except (OSError, subprocess.CalledProcessError) as exc:
        fail(f"cannot compute deterministic stalledCycles state: {exc}")

    old_stalled = before.get("stalledCycles")
    if isinstance(old_stalled, int) and not isinstance(old_stalled, bool):
        expected = 0 if (objective_progress or code_changed) else min(old_stalled + 1, 2)
        if status.get("stalledCycles") != expected:
            status["stalledCycles"] = expected
            changed = True
            print(
                f"Canonicalized deterministic stalledCycles to {expected}.",
                file=sys.stderr,
            )

    return changed


def canonicalize_report(report: dict[str, Any]) -> bool:
    changed = False

    value, did = clamp_text(report.get("reason"), 1000, "director.reason")
    if did:
        report["reason"] = value
        changed = True

    evidence = report.get("progressEvidence")
    if isinstance(evidence, list):
        for index, item in enumerate(evidence):
            value, did = clamp_text(
                item, 1000, f"director.progressEvidence[{index}]"
            )
            if did:
                evidence[index] = value
                changed = True

    next_obj = report.get("next")
    if isinstance(next_obj, dict):
        for key in ("mobile", "backend", "audit"):
            value, did = clamp_text(next_obj.get(key), 2000, f"director.next.{key}")
            if did:
                next_obj[key] = value
                changed = True
    return changed


def ensure_machine_tag(path: Path, token: str, label: str) -> bool:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        fail(f"cannot read {label} {path}: {exc}")
    if token in text:
        return False
    with path.open("a", encoding="utf-8") as handle:
        if text and not text.endswith("\n"):
            handle.write("\n")
        handle.write(f"\n<!-- machine-contract: {token} -->\n")
    print(f"Added missing machine tag {token} to {label}.", file=sys.stderr)
    return True


def canonicalize_director_phase(tasks: dict[str, Any]) -> bool:
    cycle = os.environ.get("CYCLE_KEY", "").strip()
    runner_temp = os.environ.get("RUNNER_TEMP", "").strip()
    if not cycle or not runner_temp:
        return False

    report_path = Path("reports/director") / f"CYCLE_{cycle}.json"
    status_path = Path("docs/RELEASE_STATUS.json")
    before_path = Path(runner_temp) / "chorescore-release-status-before.json"

    # During prepare there is no report/before snapshot for the current run;
    # keep the historical task-slice behavior only.
    if not (report_path.is_file() and status_path.is_file() and before_path.is_file()):
        return False

    report = read_json(report_path)
    status = read_json(status_path)
    before = read_json(before_path)
    if not all(isinstance(item, dict) for item in (report, status, before)):
        fail("Director control JSON roots must be objects")

    changed = False
    changed |= canonicalize_task_prose(tasks)
    changed |= canonicalize_status(status, before, cycle)
    changed |= canonicalize_report(report)

    if changed:
        write_json(status_path, status)
        write_json(report_path, report)

    assignments = tasks.get("assignments")
    if isinstance(assignments, dict):
        for role in ("mobile", "backend"):
            assignment = assignments.get(role)
            if not isinstance(assignment, dict) or assignment.get("enabled") is not True:
                continue
            criterion = assignment.get("criterionId")
            if isinstance(criterion, str) and criterion:
                directive = Path("directives") / f"{role.upper()}.md"
                changed |= ensure_machine_tag(
                    directive, criterion, f"{role} directive"
                )

    changed |= ensure_machine_tag(
        Path("directives/AUDITOR.md"), "mustFix", "auditor directive"
    )

    active = tasks.get("activeCriteria")
    if isinstance(active, list):
        next_cycle = Path("docs/NEXT_CYCLE.md")
        for criterion in active:
            if isinstance(criterion, str) and criterion:
                changed |= ensure_machine_tag(
                    next_cycle, criterion, "next-cycle document"
                )

    return changed


def normalize(path: Path) -> bool:
    tasks = read_json(path)
    if not isinstance(tasks, dict):
        fail("task contract root must be an object")

    changed = normalize_slices(tasks)
    director_phase = canonicalize_director_phase(tasks)

    # canonicalize_director_phase may alter task prose in memory.
    if changed or director_phase:
        write_json(path, tasks)
    return changed or director_phase


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: normalize-task-slices.py <directives/TASKS.json>")
    normalize(Path(sys.argv[1]))


if __name__ == "__main__":
    main()
