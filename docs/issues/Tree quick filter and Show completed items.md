---
type: Issue
order: 60
parent: "[[Smoke test the tree]]"
status: Open
priority: P3
area: verification
created: 2026-08-02
source: Feature Test epic
---

# Tree quick filter and Show completed items

A verification to run.

## Why this exists

Both are toolbar controls whose effect on layout — what actually disappears, and how a
match is highlighted — is a rendering question jsdom answers by class alone.

## How to check

- **Quick filter** — type a fragment of a note's title. Matching rows should highlight
  the matched text inline, ancestors of a match should stay visible as context, and
  clearing the field should restore the full tree without a flash.
- **Show completed items**, unchecked — a subtree whose every note is done should
  disappear entirely; a subtree with one open item, however deep, should stay. Toggling
  it back on should restore everything with no rows out of order.

## Acceptance criteria

- The highlight and the ancestor-context behaviour both confirmed under the filter.
- A fully-done subtree confirmed hidden, and a partly-done one confirmed to stay.
