---
type: Issue
parent: "[[Cross-cutting concerns]]"
order: 60
status: Open
area: ux
priority: P2
created: 2026-08-14
source: "Automated review of PR #140 (folding a board column), which found it on the fold
  and where it is neither new nor the fold's"
files:
  - src/view/selection.ts
  - src/view/interactions/keyboard.ts
---

# A selection the frame did not draw

## Why this exists

`resyncAfterRender` keeps `selectedPath` when the render draws no row for it. The active
descendant goes (`syncActiveDescendant(null)`) and `pbl-has-selection` comes off, so the
pane looks unselected and correctly announces nothing — but the view still holds the path.
Two things follow, and only the second is a nuisance:

- Enter and the menu key do nothing. They resolve the selection to a rendered element and
  find none.
- **Escape is spent clearing it.** `handleFilterKey` reaches `host.clearSelection()`
  whenever `selectedPath` is non-null, so the first Escape after the row disappears
  consumes the key and looks like nothing happened.

Keeping the path is deliberate and worth keeping: it is what restores your place when the
row comes back. Clear a quick filter, or re-expand the parent, and the selection is
still on the row you left it on.

## What was measured

Reported against the new column fold, and it is not the fold's and not the board's — the
TREE has done this since collapse existed. Driven in a scratch test on 2026-08-14: select
a child row, `setCollapsed` its parent, re-render — `selectedPath` is still `Child.md`,
`aria-activedescendant` is gone, and one row is drawn. Identical state, reached by the
oldest control in the plugin.

The board's fold reaches it more easily, which is what made it visible: one click, on a
column the reader chose, and unlike a filter it persists across sessions. "Show completed
items" reaches it too, and the quick filter does not — Escape clears the filter first,
and lifting the filter brings the row back.

## What it would take

A rule for "a selection whose row this frame did not draw", held by every projection at
once. It is a real trade and not an oversight:

- **Keep it dormant** (today). Costs the swallowed Escape and two inert keys.
- **Drop it on the render that cannot show it.** Costs the restore — collapse and
  re-expand, or filter and clear, and your place is gone.
- **Keep it and make Escape ask whether it is visible.** Keeps both, at the price of a
  new host predicate ("is there a rendered row for the selection") that only Escape reads,
  and of a rule that is nowhere near where the selection is reconciled.

The third looks best and none of them is a change to make inside a PR about folding: all
three land in `resyncAfterRender` or beside it, and every projection reads it. Whichever
is chosen, the check has to be driven on the TREE as well as the board, or it will be the
board's fix again.
