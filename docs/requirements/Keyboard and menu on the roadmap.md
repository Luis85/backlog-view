---
type: PBI
parent: "[[Scheduling work]]"
order: 30
status: Active
priority: P2
created: 2026-08-01
files:
  - src/view/interactions/keyboard.ts
  - src/view/interactions/menu.ts
  - src/ui/prompts.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
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
   across buckets on the horizon axis, along the grid by whole cells on the timeline.
   On a
   bar, Tab shifts the grip between the holds the pointer may take — the whole bar
   where every end it renders is the note's own, stated or open, and each end that
   can take a write ([[Move and resize a bar]]) — announced with the selection, so
   arrows resize as well as slide: the one-date write the edge drag plans, without
   the pointer.
3. Space drops, committing the batch the drag would write; Escape cancels with nothing
   written.
4. The context menu offers the moves in words — set horizon, schedule, unschedule,
   clear horizon — beside the item's existing actions. Schedule opens
   the dates for entry, prefilled with the dates the note itself states — an inferred
   endpoint arrives blank, because an inference is display and confirming a prompt
   must not be the write that materializes it — or, for an unscheduled item, with
   today spanning one zoom cell, the shelf drop's own default; confirming writes the
   same shaped batch the gestures write. Each
   menu action is one dimension and one small undoable batch.

**Extensions**

- **2a — the item is a context row.** Nothing lifts — Enter still opens it, as
  everywhere — and the menu withholds every write action, offering navigation alone:
  the rule the board's menu already keeps for excluded items.
- **2b — the item is on the shelf.** The lift carries it onto the axis — entering the
  timeline at today's cell, the anchor the menu default already uses, or the horizon
  axis at its first bucket — and arrows move from there. The drop writes the same
  schedule-or-horizon batch the shelf drag writes, so triage needs no pointer and
  starts where the reader is oriented.
- **2c — the item is a marker.** The lift holds a point, so it moves the target alone and
  offers no end grip to resize — the batch a milestone's own gestures write
  ([[Milestones as their own type]]), which this path commits rather than re-derives. The
  general rule already says the keyboard's batch is identical to the drag's; it is stated
  here because "identical" is only a guarantee where both were narrowed, and a keyboard
  path that widened one back would be the write no pointer could make. With only a start
  property configured the marker has no key it may write, so it takes no lift and its
  schedule and unschedule entries are absent — 4b's rule reaching a type rather than an
  axis, and the pointer's own answer in the same configuration.
- **3a — the commit is refused.** Loud, nothing written, selection stays where the user
  left it — the failure is announced where the keyboard user is, not on a pointer they
  are not holding.
- **4a — the menu's removal actions.** Unschedule and clear horizon remove keys, the
  shelf's rule, landing the item wherever the placement rules put it next: clearing a
  horizon always shelves, because buckets read the note's own frontmatter alone and
  nothing rolls a horizon up, while unscheduling shelves only a wholly dateless
  subtree, an inferred span standing otherwise. Un-placing needs no pointer either.
  Each removal action appears only while the note carries the key it would remove —
  absent, not inert, exactly as an unconfigured axis withholds its actions — so no
  offered action can write nothing.
- **4b — an axis is not configured.** Its actions are absent, not inert: schedule and
  unschedule appear only while a date property is configured, set and clear horizon
  only while a horizon property is — the state chip's own render-only-when-configured
  rule, applied per axis. With one date property configured, schedule's entry offers
  the one end there is.

## Acceptance criteria

- Lift, move, drop, cancel work as specified on both axes — Space, arrows, Space,
  Escape — the grip reaching every hold the pointer may take: the whole bar where
  every rendered end is the note's own (stated or open), each writable end — a marker's
  diamond having none, so its lift moves its target alone — so a
  resize is a keyboard move too; the committed batch is identical to the drag's, and
  Escape always exits with nothing written.
- Enter opens the selected note in roadmap mode exactly as in every other projection,
  context rows included ([[Opening the work]]); the lift never takes it over.
- The context menu offers set horizon (declared plus observed values), schedule — a
  date entry prefilled with the dates the note states, an inferred endpoint blank,
  or with today spanning one zoom cell for an unscheduled item — unschedule, clear
  horizon, each writing the batch shape the gestures
  write — one dimension and one small undoable batch each; on context rows it offers
  no write action, and each action appears only while its axis property is
  configured — a removal action only while the note carries the key it would remove —
  never inert, never writing an unconfigured key.
- No write on the roadmap is reachable only by pointer.
- A refused commit is announced at the selection, which does not move.

## Where it lives

**Partly built.** [[Moving between horizons]] shipped the horizon axis's two non-pointer
paths, because a write with no keyboard route is a write this register does not ship:
`handleRoadmapMoveKey` in `src/view/interactions/keyboard.ts` steps the selected card
one placement on Alt+Left/Right, over a ladder that leads with the shelf — where 2b
already says a lift entering from the shelf should arrive — and `Set horizon` in
`src/view/interactions/menu.ts` offers the rendered buckets plus the shelf, withheld
whole on a context row (2a) and absent wherever no buckets render (4b's rule, read off
the render rather than off the settings). Both plan the identical batch the drag plans,
through `performHorizonMove`. Driven in `test/view/roadmapMoves.test.ts`.

It also inherits one concrete gap from [[Buckets from a horizon property]]: a bucket's
New button is pointer-only, because a bucket is not a keyboard stop for anything to be
done to. **Bucket stops are this note's step 1** — arrows moving the selection across
the roadmap's regions — and creating into the selected bucket is what they are first
needed for. The capability is not lost meanwhile (the toolbar's New plus Alt+arrow
reaches the same place), only the one-gesture path.

What remains is everything this note is actually about. The **lift** — Space, arrows,
Space, Escape, with Tab shifting the grip along a bar — is a state machine that has no
code yet and joins `src/view/interactions/keyboard.ts` beside the tree's navigation;
Alt+arrow is a single-dimension shortcut, not a lift. The **date entry** is a prompt
beside the new-item prompts in
`src/ui/prompts.ts`, and schedule, unschedule and clear horizon are menu actions in
`src/view/interactions/menu.ts` — the removal pair gated on the note carrying the key
(4a), which the current Set horizon expresses only as its shelf entry. `Schedule` and
`Unschedule` already give the dated
axis's single-dimension writes a non-pointer path, and the drags shipped by
[[Move and resize a bar]] and [[Drag from the shelf to schedule]] give it pointer ones
too — so WCAG 2.2 SC 2.5.7 is satisfied the day the drags land, and what the lift still
owes is the ergonomic path, not compliance.
