---
type: PBI
parent: "[[A third projection]]"
order: 30
status: Done
priority: P1
created: 2026-08-01
files:
  - src/domain/roadmap.ts
  - src/domain/shelf.ts
  - src/domain/noteFields.ts
  - src/view/render/roadmap.ts
  - src/view/render/shelf.ts
  - src/view/render/shelfControls.ts
  - test/domain/shelf.test.ts
  - test/helpers/obsidian-mock.ts
  - test/helpers/vault.ts
  - test/view/shelfUx.test.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: 2026-08-09
risk: ""
assignee: ""
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
2. The rest gather on the shelf: a labelled strip beside the axis, showing the same
   cards the axis shows. Grouped by type ("The shelf, organized"); sibling order
   orders cards within a group, not across the whole strip.
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
- Within each type group, the shelf keeps sibling order — the order property's rank,
  not arrival order ("The shelf, organized" specifies the grouping itself). The shelf
  names its count.
- An empty shelf takes no space except as a live drop target during a drag.
- Unreadable placements shelve with their reason visible on the card.
- Context rows never shelve; "Show completed items" and the quick filter narrow the
  shelf exactly as they narrow the rest of the view.

## Where it lives

Built. Whether a result places is a domain question answered in `src/domain/roadmap.ts`
(`buildRoadmap`), from fields read the way every field is read — `readPlacement` and
`readDate` in `src/domain/noteFields.ts`, whose absent-versus-invalid distinction is
what lets a card say why. The shelf's grouping, sorting, and filtering logic lives in
`src/domain/shelf.ts` (`organizeShelf`). The shelf and the context strip render in
`src/view/render/shelf.ts` (`renderShelf`, `renderContextStrip`) — split out of
`src/view/render/roadmap.ts`, which still builds the frame and the two axes and calls
into `shelf.ts` for the bands beside them — driven in `test/domain/roadmap.test.ts`,
`test/view/roadmapFrame.test.ts` and `test/view/shelfUx.test.ts` (accessors in
`test/helpers/roadmap.ts`).

The shelf's own header picks (`host.shelfCollapsed`, `shelfSort`, `shelfHiddenTypes`,
persisted UI state in the view-state store) are what `renderShelf` now consults:
collapsed contributes zero cards to the DOM (the drop target and its outcome preview
are wired before that check, never after, so collapsing can never disable the one thing
that un-places), and an expanded shelf groups its cards through `organizeShelf` — by
type, in `ALL_TYPES` order plus a trailing `Other` — sorted within each group and
filtered by type, all three display-only. The advisory gate on the roadmap's own empty
state was fixed in the same change: it sums the axis's own rendered count (captured
before the shelf renders, so collapsing the shelf cannot make it lie), the shelf's real
count and the context strip's count, rather than counting what is currently on screen —
an all-shelved, collapsed backlog is not empty, it is a backlog not yet planned. This
whole paragraph is [[The shelf, organized]]'s own ground: that PBI specifies the
grouping, sort, filter and collapse UX summarized here.

The shelf's interactive chrome — a collapse toggle, a sort picker, a type filter —
cannot live inside the roadmap pane itself: it wears `role="listbox"` while any cards
render, a one-tab-stop composite widget with no room for a `<select>` or checkboxes. It
is built instead as toolbar chrome, a sibling of the pane rather than a descendant, in
`src/view/render/shelfControls.ts` (`renderShelfControls`, called from `renderToolbar`),
driven in `test/view/shelfUx.test.ts`. `syncShelfControls`, beside it, fills the built
structure with the shelf's live population, current picks, and per-type counts; it runs
after every content render, alongside `syncCountLabel`.

Step 4 and 2a arrived first with [[Moving between horizons]], on the horizon axis: a
shelf card is a drag source, the shelf itself is the target that un-places, and an empty
shelf renders as `pbl-shelf-empty` — in the DOM so a drop has somewhere to land, kept
out of the layout by `styles/shelf.css` until a drag is live.
[[Drag from the shelf to schedule]] gave the dated axis both, and `renderShelf` no
longer reads `dnd` as "the horizon axis": it takes what a drop on that axis means and
the words to promise it in from the axis itself, rather than hardcoding the horizon's
own removal and wording against a controller that is `null` only by the withholding
this closes. Whether the empty strip actually appears under a dragged card — jsdom
paints nothing, so a test can assert the class and never the layout — is
[[Smoke test the visual changes]]'s to check.

**2a's narrow-pane compaction** ([[Zoom and the today marker]] extension 2a) is met by
the collapse itself rather than by a second mechanism: the shelf opens shut on both axes
and stays where the reader put it, so a narrow pane already opens with the cards away
and the labelled count showing. The width-measured compaction that once did this job
separately — a toolbar toggle, a pixel threshold, session-only state — is gone: two ways
to hide the same cards disagreed with each other, and the one that persists is the one a
reader chose ("The shelf, organized").
