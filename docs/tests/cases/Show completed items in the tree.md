---
type: Test case
order: 60
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Show completed items in the tree

A verification to run.

## Why this exists

A toolbar control whose effect on layout — what actually disappears, and whether anything
is left out of order behind it — is a rendering question jsdom answers by class alone.

It was half of a case called `Tree quick filter and Show completed items` until
2026-08-17, when the quick filter was withdrawn
([[Remove the quick filter, now that Bases has its own search]]). The filter's half — a
highlighted match inline and ancestors kept as context — has nothing left to check: a
Base's own search narrows the results this view is given, and what that leaves is
[[Filtered bases keep their tree]]'s check rather than one for a control here.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

- **Show completed items**, unchecked — a subtree whose every note is done should
  disappear entirely; a subtree with one open item, however deep, should stay. Toggling
  it back on should restore everything with no rows out of order.
- The rollup on a parent whose children are hidden should keep counting them: hiding is a
  render decision, so the number beside the bar must not move when the toggle does.

## Acceptance criteria

- A fully-done subtree confirmed hidden, and a partly-done one confirmed to stay.
- The toggle confirmed reversible, with no row landing in a different place than it
  started.
- A rollup confirmed unchanged across the toggle.
