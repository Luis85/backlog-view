---
type: Task
order: 60
parent: "[[The shelf, organized]]"
status: Done
priority: P2
area: usability
created: 2026-08-14
closed: 2026-08-15
source: Asked for directly, alongside dropping the card menu's per-child entries
files:
  - src/view/interactions/menu.ts
  - src/view/render/shelfControls.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Drop the shelf's toggle from the card menu

## Evidence

Asked for directly, to shorten the card's right-click menu — the same ask that dropped
the per-child entries beside it ([[Drop the per-child entries from the card menu]]). The
shelf's own header is where a reader working through unplaced work is already looking,
and `Expand/Collapse unplaced (n)` was a line on the menu of every card on screen for a
control that sits in one place.

**The shelf still collapses.** The first attempt removed the whole feature — the
disclosure, the stored `shelfExpanded`, `shelfCollapsed` through the host — and that was
a misreading of the ask, corrected the next day. Only the menu entry goes.

## What was removed, and what took its place

- `Expand/Collapse unplaced (n)` from `addShelfSection` (`src/view/interactions/menu.ts`).
  The section keeps its sort and filter entries, and now returns early on a collapsed
  shelf: with the cards shut away there is nothing to order or narrow, which is the rule
  the header already keeps for the same two pickers.
- **The disclosure became a real tab stop** (`renderShelfControls`), which is what makes
  this a decluttering rather than a pointer-only shelf. The menu section was the
  documented keyboard path for every `tabindex="-1"` control in the header, and a
  collapsed shelf draws no card of its own to open a menu from — so a shelf shut by
  keyboard could not have been reopened by one.
- `syncShelfTabStops` now skips the disclosure. It exists to put the header's controls
  BACK in the tab order when the pane is not a composite; over a permanent stop it would
  only ever write `-1` in the state the stop exists for.
- `refocus` hands the disclosure its own replacement in both pane shapes. The two pickers
  still hand focus to the pane inside a composite, because they are `tabindex="-1"` there
  and the pane's key handler ignores any event whose target is not the pane itself.

## What that costs

One extra tab stop inside a `listbox`, which the composite pattern does not sanction.
That is the deviation the timeline's lead-resize grip already carries
(`src/view/CLAUDE.md`, "One control inside a composite pane is a real tab stop"), and it
is earned the same way: the disclosure is chrome fixed to the pane's own frame, it never
renders among the cards, and it cannot compete with the roving selection because
`handleRoadmapKeydown` returns on any event the pane did not receive itself. How a screen
reader announces a button in that position is not answerable here — it belongs with the
grip's own open question in `docs/tests/suites/Smoke test the roadmap.md`.

## How it is checked

`test/view/shelfUx.test.ts`: the card menu offers no shelf section at all while the shelf
is shut, the disclosure is `tabindex="0"` in both pane shapes, and it keeps its own focus
across the rebuild its press causes — driven twice running, so a hand-off to the pane
fails rather than passing on the first press. The two pickers' existing tab-order and
refocus tests are unchanged, which is what says the exception is the disclosure's alone.
