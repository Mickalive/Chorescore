#!/usr/bin/env python3
"""Canonicalize the optional ChoreScore task-slicing contract.

The canonical representation is always:

    "slices": [
      {"id": "a", "objective": "...", "allowedPaths": ["..."]},
      {"id": "b", "objective": "...", "allowedPaths": ["..."]}
    ]

For backward compatibility only, the exact keyed-object form {"a": {...},
"b": {...}} is migrated deterministically. No other malformed shape is guessed.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys


def fail(message: str) -> None:
    raise SystemExit(message)


def normalize(path: Path) -> bool:
    try:
        tasks = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read task contract {path}: {exc}")

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

        if isinstance(slices, list):
            # Canonical-looking lists are left untouched. The strict semantic
            # validator that follows remains authoritative for ids, paths,
            # overlap and role scope.
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

    if changed:
        path.write_text(
            json.dumps(tasks, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return changed


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: normalize-task-slices.py <directives/TASKS.json>")
    normalize(Path(sys.argv[1]))


if __name__ == "__main__":
    main()
