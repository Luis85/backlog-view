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
  - src/ui/prompts.ts
---

# Keyboard and menu on the roadmap

**As** someone who cannot or will not drag, **I want** every roadmap move available
from the keyboard and the menu, **so that** the roadmap is operable, not just
watchable.

WCAG 2.2 SC 2.5.7 requires a single-pointer alternative to every dragging movement —
the obligation the board already carries ([[Keyboard, menu and touch]]) — and the
pattern to copy is the lift mode GitHub's roadmap and the board's chosen drag layer
both document: lift, move by arrows, drop to commit, Escape to cancel, on the treegrid
semantics the commercial Gantt components describe. The keys follow this register's
own contract — Enter is activation and opens the note in every projection
([[Opening the work]]), so the lift is Space, the drag layer's documented
accessibility convention. The
ecosystem makes this worth stating loudly: the Obsidian timeline closest to shipping
names keyboard access as its own open gap, so here it is specified with the feature
rather than deferred behind it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Arrows, Space or Escape on a selected roadmap item, or its context menu |
| **Preconditions** | Roadmap mode is on |
| **Guarantee** | Every write a drag can produce has a non-pointer path — single-dimension changes as menu actions, combined moves through the lift — writing the same batch shapes through the same gate; no roadmap write is reachable only by pointer, Enter stays activation everywhere, and Escape always leaves nothing written. |

**Main flow**

1. Arrows move the selection across the roadmap's rows and regions — the tree's
   one-tab-stop rule unchanged, shelf included.
2. Space lifts the selected item — Enter stays what it is in every projection:
   activation, opening the note ([[Opening the work]]). Arrows preview the move —
   across buckets on the horizon axis, along the grid by whole cells on the timeline,
   and, with lanes on, up and down across lanes, so one lift can cross lane and axis
   together and commit the combined batch [[Lanes on the roadmap]] specifies. On a
   bar, Tab shifts the grip between the whole bar and each end that can take a write —
   the same ends the pointer may hold ([[Move and resize a bar]]) — announced with the
   selection, so arrows resize as well as slide: the one-date write the edge drag
   plans, without the pointer.
3. Space drops, committing the batch the drag would write; Escape cancels with nothing
   written.
4. The context menu offers the moves in words — set horizon, schedule, unschedule,
   clear horizon, and, with lanes on, move to lane, offering every legal lane under
   the drag's own cycle rules — beside the item's existing actions. Schedule opens
   the dates for entry, prefilled with the item's current dates or, for an
   unscheduled item, with today spanning one zoom cell — the shelf drop's own
   default — and confirming writes the same shaped batch the gestures write. Each
   menu action is one dimension and one small undoable batch; the combined
   lane-plus-axis move's non-pointer path is the lift, which holds both dimensions
   before one drop.

**Extensions**

- **2a — the item is a context row.** Nothing lifts — Enter still opens it, as
  everywhere — and the menu withholds every write action, offering navigation alone:
  the rule the board's menu already keeps for excluded items.
- **2b — the item is on the shelf.** The lift carries it onto the axis — entering the
  timeline at today's cell, the anchor the menu default already uses, or the horizon
  axis at its first bucket — and arrows move from there. The drop writes the same
  schedule-or-horizon batch the shelf drag writes, so triage needs no pointer and
  starts where the reader is oriented.
- **3a — the commit is refused.** Loud, nothing written, selection stays where the user
  left it — the failure is announced where the keyboard user is, not on a pointer they
  are not holding.
- **4a — the menu's removal actions.** Unschedule and clear horizon remove keys, the
  shelf's rule, landing the item wherever the placement rules put it next: clearing a
  horizon always shelves, because buckets read the note's own frontmatter alone and
  nothing rolls a horizon up, while unscheduling shelves only a wholly dateless
  subtree, an inferred span standing otherwise. Un-placing needs no pointer either.
- **4b — an axis is not configured.** Its actions are absent, not inert: schedule and
  unschedule appear only while a date property is configured, set and clear horizon
  only while a horizon property is — the state chip's own render-only-when-configured
  rule, applied per axis. With one date property configured, schedule's entry offers
  the one end there is.

## Acceptance criteria

- Lift, move, drop, cancel work as specified on both axes — Space, arrows, Space,
  Escape — the grip reaching the whole bar and each writable end, so a resize is a
  keyboard move too, and up and down crossing lanes when lanes are on, so one drop can
  carry the combined lane-plus-axis batch; the committed batch is identical to the
  drag's, and Escape always exits with nothing written.
- Enter opens the selected note in roadmap mode exactly as in every other projection,
  context rows included ([[Opening the work]]); the lift never takes it over.
- The context menu offers set horizon (declared plus observed values), schedule — a
  date entry prefilled with the current dates, or with today spanning one zoom cell
  for an unscheduled item — unschedule, clear horizon and, with lanes on, move to
  lane under the drag's own cycle rules, each writing the batch shape the gestures
  write — one dimension and one small undoable batch each, the combined
  lane-plus-axis move's non-pointer path being the lift; on context rows it offers
  no write action, and each action appears only while its axis property is
  configured — never inert, never writing an unconfigured key.
- No write on the roadmap is reachable only by pointer.
- A refused commit is announced at the selection, which does not move.

## Where it lives

**Nothing yet — this note is design.** The lift state machine joins
`src/view/interactions/keyboard.ts` beside the tree's navigation; the actions join the
one context menu in `src/view/interactions/menu.ts`, which already decides what an
excluded item is offered; the date entry is a prompt beside the new-item prompts in
`src/ui/prompts.ts`.
