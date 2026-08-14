---
type: Task
order: 60
parent: "[[The shelf, organized]]"
status: Done
priority: P2
area: usability
created: 2026-08-14
closed: 2026-08-14
source: Asked for directly, alongside dropping the card menu's per-child entries
files:
  - src/view/render/shelfControls.ts
  - src/view/render/shelf.ts
  - src/view/interactions/menu.ts
  - src/view/host.ts
  - src/view/uiState.ts
  - src/view/collapseState.ts
  - src/storage/collapseStore.ts
  - styles/shelf.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Drop the shelf's collapse option

## Evidence

Asked for directly. [[The shelf, organized]] gave the shelf a disclosure and made
**collapsed the default**, so the band that reports how much of the backlog is unplanned
answered that question only after a click — on every new view, on both axes. Its own
main flow says the shelf "opens collapsed by default, remembered per view like the
projection"; what a reader gets is a roadmap whose most-crowded region is hidden until
they find the control that opens it.

## What was removed

The state, not just the control — a flag with one writer and no reader is worse than
either.

- The header's disclosure button, and with it the `pbl-shelf-disclosure` and
  `pbl-shelf-collapse-icon` rules and the collapsed footprint. The header now names and
  counts the shelf as a label, and the sort and type pickers render whenever it holds
  anything.
- `Expand/Collapse unplaced (n)` from the card menu's shelf section, which keeps its
  sort and filter entries.
- `shelfCollapsed`/`setShelfCollapsed` through `host.ts`, `uiState.ts` and
  `collapseState.ts`, and the `shelfExpanded` field in the stored entry
  (`storage/collapseStore.ts`) — read, write, sanitizer and the has-content check.

A stored `shelfExpanded: true` from an earlier version is now ignored and dropped the
next time that view writes its entry. Nothing migrates it: the value it carried has no
question left to answer.

## What changed with it, and what did not

- **An all-shelved roadmap is now a composite, not a region.** Its cards are on screen,
  so the pane is a `listbox` with something to arrow through, where a shut shelf left it
  a plain `region`. The keyboard walk reaches shelf cards on the first draw.
- **The refocus branch that hands focus to the control survives.** It exists for a
  rebuild that leaves nothing to arrow through, which the disclosure used to produce by
  shutting the last content. The type filter still produces it — hide the only type and
  the pane empties — so the branch is driven by that case now, in
  `test/view/shelfUx.test.ts`.
- **The empty shelf is unchanged**: it renders, it takes a drop, and it carries the label
  alone. It never had a disclosure, since there was nothing to disclose.
- **The drop target is unchanged.** It was wired before the collapsed check and is now
  wired before the empty one, which is the same rule: the thing that un-places must not
  be gated by a display state.

## How it is checked

`test/view/shelfUx.test.ts` — the header's two controls, their tab-order rule in both
pane shapes, the walk reaching a shelf card, the empty shelf's bare label, and the drop.
`test/view/persistence.test.ts` and `test/storage/collapseStore.test.ts` no longer
round-trip a collapse.

The harness's `?perf` panel lost a workaround with this: it opened the shelf for the run
and put it back, because a collapsed shelf drew its header and returned — see
[[Take the numbers where there is no screen]].
