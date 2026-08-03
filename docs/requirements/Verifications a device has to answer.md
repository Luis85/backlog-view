---
type: Feature
parent: "[[Codebase health]]"
order: 60
status: Open
area: verification
created: 2026-08-03
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
- A verification that has caught nothing across two releases is retired on that evidence,
  rather than kept because retiring it feels like a loss of rigour.

## Where it lives

`RELEASING.md` · `docs/issues/` (the verification notes) · `test-build.mjs`
