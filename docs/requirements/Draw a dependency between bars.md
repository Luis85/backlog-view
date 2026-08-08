---
type: PBI
parent: "[[Dependencies]]"
order: 40
status: Open
priority: P3
created: 2026-08-08
source: user request
---

# Draw a dependency between bars

**As** someone looking at two bars in the wrong order, **I want** to drag a link from one
to the other, **so that** stating the ordering is a gesture on the picture that shows it.

This is the Gantt convention and it is a *second* way to do what [[Linking two items]]
already does — never the only way, because SC 2.5.7 requires the single-pointer path to
exist and because a shelved prerequisite has no bar to drag from. So the write is not
re-planned here: the drop calls the one method the menu calls, per the rule this codebase
already keeps for the board and the horizon axis — **one move, several inputs, one place
the batch is planned and announced**. Adding this gesture must add no second idea of what
a dependency write is.

What is genuinely new is the affordance. A bar's ends are already taken: dragging one
moves that date ([[Move and resize a bar]]), and horizontal space is the scarce resource
in an Obsidian pane — the first-hand lesson the ecosystem's timeline beta reports. So the
connector is its own mark, revealed rather than permanent, and placed where it cannot be
mistaken for the resize grip it sits beside.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The pointer hovers, or the keyboard focuses, a timeline row whose item has a bar — or the device has no hover, where it is not revealed because it was never hidden |
| **Preconditions** | Roadmap mode is on with the dated axis, and the dependency property is bound ([[Dependencies as a property]]) |
| **Guarantee** | The gesture plans no write of its own: a completed drag calls the same method the menu calls, so the batch, its refusals and its undo are identical either way. A cancelled drag writes nothing. No drop changes a date, and none writes to a note the Base excluded. |

**Main flow**

1. A revealed connector sits just past the **end** of the row's bar, outside it, so it
   never competes with the resize grip already there.
2. Dragging from the connector draws a preview line to the pointer, and the bars that are
   legal targets are marked as such while it is held.
3. Releasing over a legal target states *that item waits for this one* — the write lands on
   the bar dropped **onto**, which is the one that waits, so the gesture runs in the same
   direction as the arrow it creates.
4. Escape, or a release anywhere that is not a legal target, cancels: nothing is written and
   nothing is marked.

**Extensions**

- **1a — the row is a milestone.** Its bar is a point, so its connector is at the diamond.
  A deadline something else waits for is the ordinary case, not a special one.
- **1b — the row is outside the Base's filter.** No connector. It is never a write target,
  and a gesture that started from it would have to be refused at the end instead of never
  offered.
- **1c — the dependency key is unbound, or the item has no bar.** No connector: nothing to
  draw from, or nothing this view can record.
- **1d — the bar is narrower than its own handles.** The connector still sits outside the
  bar's end rather than inside it, so a one-day bar keeps both its resize grip and its
  connector instead of trading one for the other.
- **1e — the device has no hover.** Neither trigger above is available on a touch-only
  device with no hardware keyboard, so the connector is **permanent** there rather than
  revealed: a `(hover: none)` block undoes the `opacity: 0`, and it sits *beside* that rule
  rather than in `styles/touch.css`, because a media query adds no specificity and any later
  rule for the same selector would get between the pair. Not a new rule — `.pbl-add` and
  `.pbl-bucket-add` each carry exactly that block for exactly this reason, and a
  hover-revealed control that lacked one shipped unreachable on touch once
  ([[Buckets from a horizon property]]). Permanent is also the cheap direction: what a
  hoverless device loses by showing the connector always is the discretion, not a gesture.
- **2a — the pointer is over an illegal target.** The source bar itself, a context row, a
  target that would close a loop, or **a target that already waits for the source** —
  marked as illegal **while the drag is held**, not refused after release. A refusal that
  arrives after the gesture ends is a gesture the user has already committed to.
  That fourth case is the duplicate one, and it is the *target's* list that decides it,
  not the source's: dragging A onto B writes to B, so the pick that would change nothing is
  a B already waiting for A. Stating it as "something it already waits for" is the menu's
  sentence, where the item under the cursor is the dependent; here the dependent is the one
  dropped onto, and the same words name the wrong end.
- **2b — the target lies beyond the visible grid.** The grid scrolls at the edge exactly as
  the existing bar drag does; where a pointer still cannot reach it, [[Linking two items]]
  always can, which is why that path ships first rather than as a fallback bolted on here.
- **2c — the intended prerequisite is on the shelf.** Unreachable by this gesture by
  construction: the shelf holds what has no bar. The menu path is the answer, and dragging
  *from* the shelf means scheduling, which is a different gesture with its own note
  ([[Drag from the shelf to schedule]]).
- **3a — the drop lands while the configuration has problems.** The gate refuses the batch
  loudly, identically to the menu path, because it is the same batch.
- **3b — the input is touch.** The same rules the other card and bar drags already keep
  ([[Keyboard, menu and touch]]); no dependency-specific gesture, and no gesture that only
  a mouse can make. The half that is *not* shared is the affordance, which is 1e's: a
  connector nothing reveals is a gesture only a mouse can start, whatever the drag handler
  accepts.
- **4a — the user takes the link back.** One undo, because the drag produced the same
  single-note batch the menu produces.

## Acceptance criteria

- The connector appears only on a result's bar, only with the key bound, and sits outside
  the bar's end so it never displaces the resize grip — including on a bar one day wide.
- It is reachable without hover: under `(hover: none)` it is visible with no gesture, and
  the rule that does it sits immediately after the `opacity: 0` it overrides — the ordering
  checked the way `test/view/rendering.test.ts` already checks it for the other two revealed
  controls, since a stylesheet cannot be asked whether a control is reachable.
- Legality is shown during the drag: an illegal target is visibly illegal before release,
  and releasing on one writes nothing. Every legal target would change something — a bar
  already waiting for the source is illegal, decided from the **target's** prerequisites,
  since the target is the note the drop writes to.
- A completed drag produces the same batch, refusals, announcement and undo as the menu
  path, because it calls the same method — there is no second plan for a dependency write.
- The write lands on the bar dropped onto and on no other note; no drop changes a date.
- Escape and a release on nothing both cancel, writing and marking nothing.

## Where it lives

**Nothing yet — this note is design.** The connector and its drag join the bar gestures in
`src/view/interactions/timelineDrag.ts`, which already owns the pointer session, the day
grid and the preview for moving and resizing a bar; the preview line and the legality
marking are the drop-indicator vocabulary in `styles/dragDrop.css` and `styles/timeline.css`
rather than a new one. The connector's own reveal and the `(hover: none)` block that undoes
it are a pair in `styles/timeline.css` and deliberately not in `styles/touch.css`, which
says why for the two controls that already do this. Legality itself is asked of `src/domain/dropTargets.ts` — the module
that already answers "would this drop be refused" for the tree — and the write is the
method [[Linking two items]] puts on `src/view/host.ts`, called and not re-planned.
