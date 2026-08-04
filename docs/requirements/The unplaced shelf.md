---
type: PBI
parent: "[[A third projection]]"
order: 30
status: Done
priority: P1
created: 2026-08-01
files:
  - src/domain/roadmap.ts
  - src/domain/noteFields.ts
  - src/view/render/roadmap.ts
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
| **Guarantee** | Every result admitted as a row renders exactly once — on the axis or on the shelf — and the counts agree: placed plus shelved equals that row set. What focus aggregates below the rows surfaces through its ancestors' rollups, never silently ([[Focus level picks the rows]]). |

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

- Placed plus shelved equals the row set the narrowing controls admit — with focus
  set, that level's rows, everything beneath surfacing through their rollups — and no
  result is ever silently omitted: the stated contrast with the prior art that drops
  them.
- The shelf keeps sibling order — the order property's rank, not arrival order — and
  names its count.
- An empty shelf takes no space except as a live drop target during a drag.
- Unreadable placements shelve with their reason visible on the card.
- Context rows never shelve; "Show completed items" and the quick filter narrow the
  shelf exactly as they narrow the rest of the view.

## Where it lives

Built. Whether a result places is a domain question answered in `src/domain/roadmap.ts`
(`buildRoadmap`), from fields read the way every field is read — `readPlacement` and
`readDate` in `src/domain/noteFields.ts`, whose absent-versus-invalid distinction is
what lets a card say why. The shelf renders in `src/view/render/roadmap.ts`, driven in
`test/domain/roadmap.test.ts` and `test/view/roadmapFrame.test.ts` (accessors in
`test/helpers/roadmap.ts`).

Step 4 and 2a arrived first with [[Moving between horizons]], on the horizon axis: a
shelf card is a drag source, the shelf itself is the target that un-places, and an empty
shelf renders as `pbl-shelf-empty` — in the DOM so a drop has somewhere to land, kept
out of the layout by `styles.css` until a drag is live.
[[Drag from the shelf to schedule]] gave the dated axis both, and `renderShelf` no
longer reads `dnd` as "the horizon axis": it takes what a drop on that axis means and
the words to promise it in from the axis itself, rather than hardcoding the horizon's
own removal and wording against a controller that is `null` only by the withholding
this closes.

**2a's narrow-pane compaction** ([[Zoom and the today marker]] extension 2a) is built
too: the shelf compacts to its labelled count in a narrow pane, one action from open,
carried by a real toolbar control — synced rather than conditionally rendered, so a
render that rebuilds the pane without touching the toolbar still leaves the toggle
naming a shelf that exists — never vanishing outright, because an unplaced result may
lose its card but never its existence.
