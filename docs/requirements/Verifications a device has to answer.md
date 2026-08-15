---
type: Feature
parent: "[[Codebase health]]"
order: 5
status: Open
area: verification
created: 2026-08-03
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: Alex
---

# Verifications a device has to answer

The checks this repository cannot run get a cadence, so they are run rather than
accumulated — and the ones that answer a condition rather than a release keep their own
trigger.

**Outcome** — "We have never checked that" stops being a thing anyone discovers by reading
the issue folder.

## Acceptance criteria

- The re-runnable verifications have a stated point in the release process, and each run
  dates its note's `Outcome`.
- A conditional verification is not folded into that sweep, and says which it is.
- A verification that has caught nothing across two releases is **reviewed** on that
  evidence — kept, narrowed or retired as a recorded decision, rather than either drifting
  on unread or being dropped because a quiet check reads as a spent one.

## Where it lives

`RELEASING.md` · `docs/tests/cases/` (the verification notes) · `test-build.mjs`
