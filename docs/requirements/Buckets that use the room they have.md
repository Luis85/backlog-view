---
type: PBI
parent: "[[The horizon board]]"
order: 40
status: Active
priority: P2
created: 2026-08-04
files:
  - styles/roadmap.css
---

# Buckets that use the room they have

**As** someone with a wide pane and three or four horizons, **I want** the buckets to
share the whole width instead of sitting in a fixed 260px column, **so that** the
roadmap does not waste most of a wide screen while every card stacks one to a row.

[[Buckets from a horizon property]] specified the buckets themselves — declared order,
case-insensitive matching, minted strays — and left their width and their cards' layout
as a fixed column, the same shape the board's columns use. A live vault showed the cost
of copying that shape here: a workflow board's columns are meant to hold a limit's worth
of cards in a glance-able stack, but a roadmap horizon is closer to a backlog slice, and
a fixed 260px column under-uses a wide pane far more than the board's columns do.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap renders on the horizon axis |
| **Preconditions** | Roadmap mode is on, the horizon axis is active |
| **Guarantee** | Buckets always share the full available width equally, down to a minimum width below which the row falls back to the existing horizontal scroll rather than compressing further; cards inside a bucket lay out in as many columns as the bucket's own width allows. |

**Main flow**

1. The horizon buckets render in one row, each sharing the row's width equally.
2. As the pane narrows or a horizon is added, each bucket narrows too, down to a
   minimum width.
3. Below that minimum, the row falls back to the horizontal scroll it already had —
   the same behavior as today, just no longer the default for the common case of three
   or four buckets on an ordinary pane.
4. Inside a bucket, cards lay out as a responsive grid: a wide bucket shows multiple
   card columns, a narrow one stays a single column — the same rule, no branch for
   either case.

**Extensions**

- **1a — a bucket holds fewer cards than its neighbors.** Its own grid still starts
  from the top and never stretches its cards to fill the row's shared height — the
  height only the flex row imposes, never the bucket's own content.

## Acceptance criteria

- Buckets share available width equally down to a minimum width, never below it; past
  that point the row scrolls horizontally exactly as it did before this PBI.
- Cards inside a bucket lay out as a CSS grid, reflowing into more columns as the
  bucket's rendered width allows, with no stretch applied to a sparse bucket's cards.
- No BUCKET-behavior changes for the shelf, the context strip, the dated axis, or the
  board — this PBI's own rules are `.pbl-bucket`/`.pbl-bucket-cards` in
  `styles/roadmap.css` only. That file also carries the shelf's flush-edge gutter fix
  in the same task, but that fix is "The shelf, organized"'s acceptance criterion, not
  this one's — sharing a stylesheet is not sharing behavior.

## Where it lives

`.pbl-bucket` (`styles/roadmap.css`) changes from a fixed `flex: 0 0 260px` to
`flex: 1 1 280px` with an explicit `min-width: 280px` — the explicit minimum is load
bearing, since `flex-basis` alone is not a floor once shrinking is enabled, and the
previous `min-width: 0` on the same rule would otherwise let a bucket compress past its
stated minimum instead of the row falling back to the `.pbl-tree` scroller's existing
`overflow-x: auto`.

`.pbl-bucket-cards` changes from a flex column to a CSS grid
(`repeat(auto-fill, minmax(min(240px, 100%), 1fr))`), with `align-content: start` —
necessary because `.pbl-roadmap-buckets` is itself a flex row with `align-items: stretch`, so
every bucket already stretches to the tallest one, and a grid's default alignment would
otherwise stretch a sparse bucket's own cards into that surplus height instead of
leaving them their natural size.

The visual result — actual column counts at a given pane width, and whether the
fallback scroll reads well with many horizons — is a live-vault check: jsdom has no
layout engine, so `npm run test-build` is what this note relies on rather than a DOM
assertion.
