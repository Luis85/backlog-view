---
type: Test case
order: 120
parent: "[[Smoke test the tree]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-31
source: the global-rank epic — both commands, both dialogs and every notice are jsdom-only
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Seeding and respacing a vault's ranks

A verification to run.

## Why this exists

[ADR 0033](../../adrs/0033-order-is-a-global-rank.md) made `order` one rank over
everything the base returns, and the two palette commands are how an existing vault gets
there. Both open a confirmation dialog, and **no part of either dialog has been seen in
Obsidian** — `test/commands/rank.test.ts` drives them through the Modal mock, which
renders nothing. Respace's second paragraph is the sharpest case: it reuses
`.pbl-confirm-message` beside the first one, and whether two paragraphs read as two
paragraphs there is a question only a themed vault answers.

**Run this case BEFORE [[Ranking a focused backlog by hand]].** This repository's own
register is an unmigrated vault — its ranks are sibling-scoped, so every first child
carries its parent's number ([[Seed the demo vault's ranks]]). Until it is seeded, focused lists draw in tree order by design and the
feature the other case checks is not visible.

**Preconditions** — `npm run test-build` has installed the plugin into this repository,
and the repository is open as a vault with `docs/Product Backlog.base` showing the tree.
**Commit or stash first**: both commands rewrite `order` across every note the base
returns, and that is the point of them.

## How to check

**Seed ranks from the hierarchy**, from the command palette:

- It is offered while the backlog view is the active leaf, and absent otherwise —
  switch to another tab and reopen the palette to see it go.
- The dialog names a count, and the sentence about discarding hand-set focus ranks is
  legible rather than crowded against the buttons.
- Cancel writes nothing. Confirm writes, and the notice reads `Ranked N notes` with the
  same N the dialog offered.
- The tree looks unchanged afterwards, because seeding writes the order already drawn.
- The toolbar's undo arrow takes the whole batch back in one press.

**Respace ranks**, on the now-seeded vault:

- Its dialog says it keeps the order on screen, and — because the vault is distinctly
  ranked now — shows **no** second paragraph.
- Confirm, and nothing visibly moves.

**Respace's second paragraph**, which needs an unmigrated vault: undo the seed (or run
this before seeding) and open Respace again. A second paragraph appears, beginning
"Some lists are drawn in tree order at the moment". Check it reads as its own paragraph
with space above it, not as a run-on of the first.

## Acceptance criteria

- Both dialogs seen, and the counts they name match the notices that follow.
- Respace's second paragraph seen in a vault that is not distinctly ranked, and confirmed
  absent in one that is.
- One undo press takes a whole Seed batch back.
