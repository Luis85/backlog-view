---
type: Test case
order: 110
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-30
source: the 0.10.0 release review — `Improvement` shipped as a fifth extra type and appears in no verification
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# An Improvement beside the ladder

A verification to run.

## Why this exists

`Improvement` is the fifth extra type and the only one added since the type palette ran out
of unclaimed hues ([[The type palette has no unclaimed hue left]]). What colour its badge
takes, and whether that colour is distinguishable from the four beside it, is a question no
test in this repository can ask — and [[Every type badge is below the contrast floor]] is
open, so the answer may be "no, and neither are the others".

**Preconditions** — `npm run test-build` has installed the plugin into this repository and it
is open as a vault, with at least one `Improvement` under an `Epic`, one under a `Feature` and
one under a `PBI`.

## How to check

- The badge is **distinguishable** from `Issue`, `Bug`, `Idea` and `Deliverable` at a glance,
  in both colour schemes and under a community theme.
- Read the badge's contrast against its own fill. Record the figure rather than a verdict —
  it feeds [[Every type badge is below the contrast floor]], which is open for all five.
- `Improvement` is offered by all three creators: the `+` on a row, the toolbar's type picker,
  and `Set type`.
- A new one files into `improvements/` under the home folder by default, and the new-item
  modal names that folder before you commit.
- It **holds Tasks and nothing else**, wherever it hangs — check the offered child types under
  an Epic, a Feature and a PBI.
- Dragging one under a different level **leaves it an Improvement**. A move is a move.
- It takes its own release rather than the shipped item's — put the shipped item in one
  release and the improvement in the next, and confirm both scopes read right.

## Acceptance criteria

- The badge is legible and distinct, all three creators offer the type, and its placement
  rules hold from every input.

## Outcome

**2026-08-30 — exercised during development, not walked as a sweep.** The maintainer
reports testing this behaviour in a vault while 0.10.0 was built. That is evidence of use
and it is recorded as such; it is **not** a run of the steps below, which were not walked
one by one. Everything here that needs a community theme, a themed accent, a real pane
width or a screen reader is therefore still unanswered — those are the questions this note
exists for, and the ones development use is least likely to have asked. The note stays open
for the next sweep.

Not walked as a sweep.
