---
type: Issue
order: 20
parent: "[[Smoke test the board]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-02
source: Feature Test epic
---

# Board card carrying hidden matches

A verification to run.

## Why this exists

Under a quick filter, a card can be the only visible ancestor of a match that the board
does not draw its own row for — a card, unlike a tree row, has no nested rows to show the
match in place. The badge that says so is asserted by class in jsdom, never read.

## How to check

Filter the board to a term that matches a descendant of a collapsed or off-column card,
not the card itself. The card should carry a visible marker that a hidden match sits
beneath it, distinguishable from the card's own state chip and legible at the card's
default size.

## Acceptance criteria

- The hidden-match marker confirmed present and legible under a real narrowing filter.
