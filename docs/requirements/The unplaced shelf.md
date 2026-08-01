---
type: PBI
parent: "[[A third projection]]"
order: 30
status: Open
priority: P1
created: 2026-08-01
files:
  - src/domain/model.ts
  - src/view/render/rows.ts
---

# The unplaced shelf

**As** someone whose backlog mostly has no horizons or dates yet, **I want** everything
the axis cannot place gathered where I can see it, **so that** the roadmap shows me the
plan *and* the not-yet-planned instead of quietly showing only the flattering half.

The trackers agree on this even where they agree on little else: Aha!'s parking lot is
literally a release without a date, rendered beside the timeline; Linear keeps an
unscheduled section under the roadmap; GitHub's roadmap keeps dateless items as rows.
The closest Obsidian prior art does the opposite — notes without dates simply do not
appear — and that omission is the single biggest gap this view exists to close. The
shelf keeps sibling order, because an undated backlog still has the one rank the tree
maintains, and a second timeline suite shipping an order-driven sequence view is the
evidence that undated ordering is a real need.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap renders while some results carry no placement on the active axis |
| **Preconditions** | Roadmap mode is on and an axis is configured |
| **Guarantee** | Every result renders exactly once — on the axis or on the shelf — and the counts agree: placed plus shelved equals the results the narrowing controls admit. |

**Main flow**

1. The roadmap places every result whose frontmatter its axis can read.
2. The rest gather on the shelf: a labelled strip beside the axis, in sibling order,
   showing the same cards the axis shows.
3. The shelf names its count, so the roadmap reports how much of the backlog is not yet
   planned instead of implying the plan is the whole story.
4. Dragging an item off the shelf onto the axis places it — the write
   [[Moving between horizons]] or [[Drag from the shelf to schedule]] plans, depending
   on the axis.

**Extensions**

- **1a — a value is unreadable on the active axis.** Unreadable is unplaced: the item
  shelves and its card says why, rather than rendering somewhere a guess put it
  ([[Bars from two dates]] states what unreadable means for dates).
- **2a — the shelf is empty.** It takes no space — until a drag is live, when it renders
  as the drop target that un-places, because a target that only exists while occupied is
  a target nothing can ever reach.
- **2b — "Show completed items" is off.** A shelved item whose subtree is done hides with
  the option, exactly as its row would in the tree: the visibility rule travels with the
  item, not the projection.
- **2c — the quick filter is active.** The shelf narrows with everything else; the filter
  is session state in all three projections.
- **3a — an item is outside the Base's filter.** It is never shelved and never counted
  there: a context row is not a result, and the shelf is a statement about the results.
  Context rows render only in the context forms the epic names.

## Acceptance criteria

- Placed plus shelved equals the results the narrowing controls admit; no result is
  ever silently omitted — the stated contrast with the prior art that drops them.
- The shelf keeps sibling order — the order property's rank, not arrival order — and
  names its count.
- An empty shelf takes no space except as a live drop target during a drag.
- Unreadable placements shelve with their reason visible on the card.
- Context rows never shelve; "Show completed items" and the quick filter narrow the
  shelf exactly as they narrow the rest of the view.

## Where it lives

**Nothing yet — this note is design.** Whether a result is placeable is a domain
question answered where the rollups already are, in `src/domain/model.ts`, from fields
read the way every field is read; the shelf itself is a new render file beside
`src/view/render/rows.ts`, under the same budgets.
