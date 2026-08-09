---
type: PBI
parent: "[[Columns from the workflow]]"
order: 60
status: Done
priority: P2
created: 2026-08-09
files:
  - styles/board.css
---

# Columns that use the room they have

**As** someone with a wide pane and a four- or five-state workflow, **I want** the board's
columns to share the whole width instead of sitting in a fixed 260px column, **so that**
the board does not leave most of a wide screen empty while every card stacks one to a row.

[[Buckets that use the room they have]] made exactly this change on the horizon axis and
said in its own acceptance criteria that it changed nothing for the board — the board's
columns were left fixed on the reasoning that a workflow stage is a glance-able stack
where a horizon bucket is a backlog slice. A wide pane says otherwise: the stack is
glance-able either way, and the empty half of the screen buys nothing. This is that same
rule applied to `.pbl-board-col`, which is one rule for BOTH board-shaped projections —
the requirements board and the Deliverables board render the same element, so neither can
have this without the other.

What it does not copy is the bucket's card grid. A column stays a single stack of cards
however wide it is: reflowing a stage into two card columns is a change to what the board
says about order, not to how much room it uses, and nobody asked for it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Either board-shaped projection renders |
| **Preconditions** | Board mode or Deliverables mode is on |
| **Guarantee** | Columns always share the full available width equally, down to a minimum width below which the row falls back to the existing horizontal scroll rather than compressing further; the empty no-state column keeps its narrow strip. |

**Main flow**

1. The workflow's columns render in one row, each sharing the row's width equally.
2. As the pane narrows or a state is added, each column narrows too, down to a minimum
   width — the 260px they were previously fixed at, so no column is ever narrower than it
   was before this PBI.
3. Below that minimum, the row falls back to the horizontal scroll it already had.

**Extensions**

- **1a — the no-state column is empty and shrinks to its drop strip.** The strip keeps its
  44px: growing every column must not turn the one column that earns its room only while
  occupied back into a full column.

## Acceptance criteria

- Columns share available width equally down to 260px, never below it; past that point the
  row scrolls horizontally exactly as it did before this PBI.
- Both board-shaped projections get it from the one rule — nothing is written twice, and
  neither board can be changed without the other.
- The empty no-state column still renders as the narrow drop strip.
- No change to the cards' layout inside a column, to the roadmap, or to the tree.

## Where it lives

`.pbl-board-col` (`styles/board.css`) changes from a fixed `flex: 0 0 260px` to
`flex: 1 1 260px` with an explicit `min-width: 260px`, replacing the `min-width: 0` that
was on the same rule — the explicit minimum is load bearing for the reason
[[Buckets that use the room they have]] records, since `flex-basis` is not a floor once
shrinking is enabled. `.pbl-board-strip` gains a `min-width: 0` to undo that floor, which
its `flex: 0 0 44px` alone would not: the two declarations are the strip's whole claim on
being narrow, and only one of them was needed while the column above it had no floor.

`test/view/boardColumnWidth.test.ts` reads those two rule bodies, in the shape the legend
swatch's own check uses: jsdom computes no layout, so what is checked is the declarations
and not a rendered width.

The rendered result was measured in Chromium against the real stylesheet
([[A browser harness without Obsidian]]): at 1900px the fixture's six columns fill the
pane with no horizontal scroll, on the requirements board and the Deliverables board
alike; at 700px they clamp at the 260px floor and the pane scrolls, the stated fallback.
What the harness still cannot answer is appearance rather than layout, so the release
sweep's own check stands (ADR 0020).
