---
type: PBI
parent: "[[Scheduling work]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/interactions/keyboard.ts
  - src/view/interactions/menu.ts
---

# Keyboard and menu on the roadmap

**As** someone who cannot or will not drag, **I want** every roadmap move available
from the keyboard and the menu, **so that** the roadmap is operable, not just
watchable.

WCAG 2.2 SC 2.5.7 requires a single-pointer alternative to every dragging movement —
the obligation the board already carries ([[Keyboard, menu and touch]]) — and the
pattern to copy is GitHub's: Enter picks up, arrows move, Enter commits, Escape
cancels, on the treegrid semantics the commercial Gantt components document. The
ecosystem makes this worth stating loudly: the Obsidian timeline closest to shipping
names keyboard access as its own open gap, so here it is specified with the feature
rather than deferred behind it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Arrows, Enter or Escape on a selected roadmap item, or its context menu |
| **Preconditions** | Roadmap mode is on |
| **Guarantee** | Every write a drag can produce exists as a keyboard path and as a menu action writing the identical batch; no roadmap write is reachable only by pointer, and Escape always leaves nothing written. |

**Main flow**

1. Arrows move the selection across the roadmap's rows and regions — the tree's
   one-tab-stop rule unchanged, shelf included.
2. Enter picks up the selected item; arrows preview the move — across buckets on the
   horizon axis, along the grid by whole cells on the timeline. On a bar, Tab shifts
   the grip between the whole bar and each end, announced with the selection, so
   arrows resize as well as slide — the one-date write the edge drag plans
   ([[Move and resize a bar]]), without the pointer.
3. Enter commits the batch the drag would write; Escape cancels with nothing written.
4. The context menu offers the moves in words — set horizon, schedule (start, target
   or both), unschedule, clear horizon — each writing the drag's own batch, beside the
   item's existing actions.

**Extensions**

- **2a — the item is a context row.** Nothing picks up, and the menu withholds every
  write action, offering navigation alone — the rule the board's menu already keeps for
  excluded items.
- **2b — the item is on the shelf.** Pick-up carries it onto the axis: the commit writes
  the same schedule-or-horizon batch the shelf drag writes, so triage needs no pointer.
- **3a — the commit is refused.** Loud, nothing written, selection stays where the user
  left it — the failure is announced where the keyboard user is, not on a pointer they
  are not holding.
- **4a — the menu's removal actions.** Unschedule and clear horizon remove keys, the
  shelf's rule, so returning an item to the shelf needs no pointer either.

## Acceptance criteria

- Pick-up, move, commit, cancel work as specified on both axes — the grip reaching the
  whole bar and each end, so a resize is a keyboard move too — and the committed batch
  is identical to the drag's; Escape always exits with nothing written.
- The context menu offers set horizon (declared plus observed values), schedule —
  start, target or both — unschedule and clear horizon, each writing the drag's batch;
  on context rows it offers no write action.
- No write on the roadmap is reachable only by pointer.
- A refused commit is announced at the selection, which does not move.

## Where it lives

**Nothing yet — this note is design.** The pick-up state machine joins
`src/view/interactions/keyboard.ts` beside the tree's navigation; the actions join the
one context menu in `src/view/interactions/menu.ts`, which already decides what an
excluded item is offered.
