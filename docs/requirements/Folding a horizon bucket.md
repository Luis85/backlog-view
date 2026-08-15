---
type: PBI
parent: "[[The horizon board]]"
order: 50
status: Done
priority: P2
created: 2026-08-14
files:
  - src/view/render/roadmap.ts
  - src/view/render/board.ts
  - styles/roadmap.css
started: "2026-08-14"
finished: "2026-08-14"
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Folding a horizon bucket

**As** someone planning four horizons at once, **I want** to fold the ones I am not
working on down to a strip, **so that** the two I am comparing get the width, without
the horizons I folded leaving the roadmap.

[[Buckets that use the room they have]] made buckets share the pane equally, which is
right when every horizon is in play and wrong the moment one of them is a parking lot:
an equal share of a wide pane is still a share spent on something nobody is reading.
Folding is the answer the board reaches for in [[Done columns stay lean]], and it is the
same answer here — with one difference stated below, because an axis has no notion of
finished and so has no default to take.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user folds a bucket, or opens a folded one |
| **Preconditions** | Roadmap mode is on and the horizon axis is active |
| **Guarantee** | Nothing is written. Every card the Base returned is still on the roadmap and still counted; a folded bucket keeps its name and its count, stays a drop target, and the fold is remembered per saved view and per device. |

**Main flow**

1. Every bucket header carries a disclosure.
2. Folding one takes its cards off the roadmap and narrows it to a strip — the same
   strip a folded board column takes, because one fold should look like one fold.
3. Folded, the bucket keeps its name and its count and stays a drop target: a horizon
   nobody can move work into is a missing horizon, not a folded one.
4. The fold is remembered in the view-state store, never in the `.base`.

**Extensions**

- **1a — a bucket nobody has ruled on.** It is OPEN. The board's done column starts
  folded because a finished stage is noise; an axis has no finished, so there is no
  equivalent default and inventing one would hide a horizon the reader never shut.
- **2a — a quick filter is running.** It overrides the fold, as it overrides every other
  fold in this plugin: a search that could not show a match inside a folded bucket would
  be a search with a silent exception in it.
- **2b — every bucket is folded.** The roadmap does not then claim to be empty. Its
  advisory is measured against what the axis HOLDS, never against what it drew.
- **3a — the New button and the stray mark.** Both are withheld while folded: neither
  reads legibly rotated, and both come back with one click. The capability is not lost,
  only the shortcut — the toolbar's New is a tab stop and Set horizon is on every card.

## Acceptance criteria

- Every horizon bucket carries a disclosure that folds it to the board's own strip
  width, keeping the name, the count and the drop target.
- A bucket is open until the reader folds it — no default, on any bucket, ever.
- The fold is remembered per saved view and per device in the view-state store, and a
  bucket's fold is separate from a board column that happens to be spelled the same.
- A folded bucket contributes no cards to the roadmap's keyboard walk, and the pane's
  `listbox`/`region` role follows the cards that are actually drawn.
- The advisory is measured against the buckets' own population, so folding every bucket
  never produces "everything is done" or "nothing matches".
- The quick filter overrides the fold.

## Where it lives

`renderBucket` (`src/view/render/roadmap.ts`) asks `host.columnCollapsed('horizons', …,
false)` — the same host method the board's columns use, with `autoCollapse` always false,
which is the whole of the difference between the two. The state, the key and the store
field are [[Done columns stay lean]]'s and are described there.

The disclosure is `renderColumnFold`, exported from `src/view/render/board.ts` and shared
— a bucket's header and a column's are the same control over the same host method, and
what differs is only the scope it keys under.

A folded bucket RETURNS no cards, which is what keeps the rest of the pane honest: that
list is the keyboard's walk and what the `listbox` role is decided from, the rule
`renderShelf` already follows. `renderRoadmap` therefore counts the buckets' own
population for the advisory rather than the cards it drew.

`.pbl-bucket-collapsed` (`styles/roadmap.css`) takes the board strip's width and rotated
name, and hides the cards, the New button and the stray mark.

Measured in the browser harness: folding `Now` in the demo backlog narrows it to the same
44px strip and the remaining buckets grow to take the width back, which is the whole point.
A long horizon behaves DIFFERENTLY from a board column and is left alone — this row has no
definite height to clip against, so a 51-character name grew the band from 220px to 383px
with the count still inside the box, exactly as a tall card would. The board's own overflow
(see [[Done columns stay lean]]) was a real defect because a column caps at the pane and
the count was pushed out of it; nothing is pushed out here.

A themed vault is still unanswerable here, as ever — `npm run test-build` (ADR 0020).

**A selection inside a folded bucket goes dormant**, exactly as one inside a collapsed
tree parent has always done: the path is kept so re-opening restores your place, and the
active descendant goes with the row. Found by review on the board's fold (Codex, PR #140)
and neither new nor the fold's — [[A selection the frame did not draw]] measures it on the
tree and states the three ways out, all of which belong to `resyncAfterRender` rather than
to a fold.

**The keyboard gap is real and is not this note's to close.** A bucket is not a keyboard
stop, so nothing selects one to act on and the disclosure is reachable by pointer and by
assistive tech alone — where a board column's fold has the column stop's own menu behind
it. That is the same gap `renderBucketNew` already carries, and
[[Keyboard and menu on the roadmap]] is where bucket stops close both at once.
