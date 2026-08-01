---
type: PBI
parent: "[[A third projection]]"
order: 40
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/render/emptyStates.ts
---

# Roadmap empty states

**As** someone who has just switched to the roadmap and seen nothing, **I want** it to
say which of the possible reasons applies and where to fix it, **so that** I correct
the one thing actually missing instead of guessing among a blank pane's explanations.

The roadmap tells the truth about why it is empty, the way the tree and the board
already do: no axis configured is a different problem from an axis with nothing placed
on it, and both are different from a base whose notes are not work items. Each answer
names the option or the action it points at.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap renders with nothing to place |
| **Preconditions** | Roadmap mode is on |
| **Guarantee** | The roadmap never renders a blank pane. Whatever is missing, what renders names it and says where it is set. |

**Main flow**

1. The roadmap resolves its axis from the view options.
2. With an axis but nothing placed, the frame still renders — the declared buckets, or
   the dated grid around today — each region a drop and creation target, with the shelf
   beside it carrying everything unplaced.
3. The tree's empty-state honesty renders as an advisory beside the frame: how many
   notes the Base returned that are not work items, and the path to creating one.
4. The user acts on the named thing — configuring an axis, planning an item, creating
   one — and the next render places it.

**Extensions**

- **1a — no axis is configured.** Guidance names both ways to get one — the horizon
  property and its values, or the date properties — and where each is set. This is the
  one case with no frame, and it is guidance rather than a roadmap precisely because a
  roadmap would be a lie about an axis that does not exist.
- **2a — every result is on the shelf.** The frame renders empty beside a full shelf.
  That is the honest report of a backlog not yet planned — the state every fresh backlog
  starts in — and the shelf's count is the fact; nothing suggests dates or horizons the
  user has not chosen.
- **2b — a declared bucket holds nothing.** It renders anyway
  ([[Buckets from a horizon property]]): a horizon exists whether or not anything
  currently sits in it, the board's own empty-column rule.
- **3a — the base returned notes that are not work items.** They are counted in the
  advisory rather than shown, the same report the tree and board make — and it renders
  beside the frame, never instead of it. An empty roadmap is an empty frame, never no
  frame.

## Acceptance criteria

- With no axis configured, the roadmap names the options to set and where, instead of
  rendering nothing.
- With an axis and no placements, the frame still renders — buckets or grid, each
  region a drop and creation target — beside the shelf and the ignored-notes advisory,
  never replaced by them.
- A declared bucket with nothing in it still renders its column.
- The all-shelved state renders the empty frame beside the full shelf and lets the
  count speak; the view suggests no placement the user has not made.

## Where it lives

**Nothing yet — this note is design.** `src/view/render/emptyStates.ts` already holds
the tree's four answers and the reasoning for separating them; the roadmap's cases join
the board's there rather than growing a second vocabulary of explanations somewhere
else.
