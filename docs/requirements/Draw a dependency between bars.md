---
type: PBI
parent: "[[Dependencies]]"
order: 40
status: Done
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

1. A revealed connector sits just past the **drawn** end of the row's bar, outside it, so it
   never competes with the resize grip already there.
2. Dragging from the connector draws a preview line to the pointer, and the bars that are
   legal targets are marked as such while it is held.
3. Releasing over a legal target states *that item waits for this one* — the write lands on
   the bar dropped **onto**, which is the one that waits, so the gesture runs in the same
   direction as the arrow it creates.
4. Escape, or a release anywhere that is not a legal target, cancels: nothing is written and
   nothing is marked.

**Extensions**

- **1a — the row is a milestone, as the PREREQUISITE.** Its bar is a point, so its
  connector is at the diamond. A deadline something else waits for is the ordinary case,
  not a special one — and it is the only direction a milestone takes part in, which is
  what its connector is for. See 1g for the direction it does not.
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
- **1f — the bar's end is clipped by the window.** The connector sits **at the clipped
  edge**, inside the grid, not past it. `barGeometry` clamps `startDay`/`spanDays` to the
  drawn window and reports `clippedEnd`, so a bar running past the edge has no on-screen end
  to sit beyond: a connector placed past the clamped one lands outside the scrollable grid,
  where it is unreachable at exactly the zoom that produced the clipping. This is the same
  answer [[Arrows between bars]] gives an anchor at a clipped edge, and it costs the
  gesture nothing — the connector is a handle, and a handle claims no date, so unlike a
  diamond it can sit at a boundary without asserting anything is there. Which is also why
  it is not suppressed: the drag writes a *dependency*, and the fact that some of the bar
  is off-screen says nothing about whether the ordering is true.
- **1g — the row is a MILESTONE, as the dependent.** It never is one. A milestone is a
  point in time, so it waits for nothing: it declares no prerequisites, is never a drop
  target (dropping onto a bar is what makes that bar wait), and neither dependency menu
  entry appears on it. A note retyped to `Milestone` while carrying a `dependsOn` key
  keeps the key and it stops meaning anything — the rule is kept at the READ
  (`readItems.ts`), so no arrow, no conflict and no candidate list can be derived from it
  anywhere. The other direction is 1a's and is deliberately kept. Decided 2026-08-09; the
  reversal it required of an existing acceptance — a marker row folding "Waits for…" into
  its label — is recorded at the test that now asserts the opposite.
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
- **3d — a note is replaced at one of the gesture's own paths while it is held.** The
  drag survives a refresh by carrying a PATH, which is what lets a drop still find its
  note after the model was rebuilt underneath it — and a path is exactly what a
  delete-and-recreate satisfies while being a different note. So both ends confirm by
  FILE: the target at the drop (`liveTarget?.file !== target.file`) and the source when
  its payload is resolved. The source's half lives in `CardDragController.resolve`, not
  here, and deliberately: every drag this view has resolves through that one method, so
  a guard written beside this gesture would have left a board move, a bucket and the
  shelf still writing to whatever note now answers to the dragged path. Same rule as
  [[Linking two items]] 2e, arriving from the drag side.
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
- It is always inside the grid: a bar clipped by the window carries its connector at the
  clipped edge, so no zoom or scroll position leaves a drawn bar with an unreachable
  connector.
- It is reachable without hover: under `(hover: none)` it is visible with no gesture, and
  the rule that does it sits immediately after the `opacity: 0` it overrides — the ordering
  checked the way `test/view/rendering.test.ts` already checks it for the other two revealed
  controls, since a stylesheet cannot be asked whether a control is reachable.
- It is VISIBLE on the keyboard-selected row, which is a fourth trigger and not a spare
  one. The other three are a pointer's `:hover`, a programmatic `:focus-visible` and the
  drag's own `.is-active`, and a keyboard user on this axis reaches none of them: the pane
  is one tab stop with a roving `aria-activedescendant`, so focus stays on the scroller,
  and the connector is `tabindex="-1"` like every per-row control, so it is never the
  focused element. Without it the handle is invisible for the whole keyboard path — which
  is not an operability failure, since 3b's answer is the row menu's **Depends on…**, but
  it does mean the affordance advertises itself to a mouse and to nobody else.
- The SOURCE bar carries a mark of its own, and it is a third state rather than a second:
  a legal target is unmarked, an illegal one is dimmed, and the source is neither — it
  refuses its own drop, so unmarked made the one bar that cannot be dropped on look
  exactly like every bar that can. It does not take the illegal dimming: that applies to
  the bar, and this bar holds the connector the preview line comes out of, so greying the
  anchor of a live gesture reads as the drag having gone wrong. An outline instead, dashed
  and lighter than the drop target's, so the origin and the bar under the pointer are
  never one look. `pbl-link-source` shipped as a class nothing drew — set by `src/` and
  asserted by `test/`, neither of which can see whether a stylesheet answers it.
- Legality is shown during the drag: an illegal target is visibly illegal before release,
  and releasing on one writes nothing. Every legal target would change something — a bar
  already waiting for the source is illegal, decided from the **target's** prerequisites,
  since the target is the note the drop writes to.
- A completed drag produces the same batch, refusals, announcement and undo as the menu
  path, because it calls the same method — there is no second plan for a dependency write.
- The write lands on the bar dropped onto and on no other note; no drop changes a date.
- Escape and a release on nothing both cancel, writing and marking nothing.

## Where it lives

**Built.** The connector and its drag turned out to want their OWN module rather than
joining `src/view/interactions/timelineDrag.ts`: a link claims no date, so it shares none of
that module's px↔date arithmetic, and `src/view/interactions/linkDrag.ts`'s `wireBarLink`
wires a bar's two roles instead — the connector as a source (skipped where none was drawn)
and the bar itself as a target (wired regardless, since a bar with no connector of its own
is still something another bar's link may legitimately point at). `begin` sweeps legality
ONCE, at drag start, from `legalTargetPaths` (below), marks every row that fails it with
`pbl-link-illegal` and the source row with `pbl-link-source`, and `end` — reached however
the gesture ends, dropped or cancelled — clears both; `wireLinkPreview` draws the pointer's
line into one SVG path minted on the first frame and moved, never rebuilt, on every one
after. `drop` re-asks legality of the CURRENT model rather than the drag-start snapshot,
matching a picker's own re-check, and calls `applyDependencyWrite` — the same function the
menu's `promptAddDependency` calls (`src/view/interactions/dependencies.ts`) — so the batch,
its refusals, its announcement and its undo are the menu's, unchanged.

Legality is asked of `legalTargetPaths`, in `src/view/interactions/dependencies.ts` beside
it — not `src/domain/dropTargets.ts`, which turned out to answer a different question (the
tree's reparent legality). `legalTargetPaths` is `candidates` asked from the other end: a
drop of S onto T writes to T, so T is legal exactly when S is a legal prerequisite FOR T —
three of its four exclusions (self, already declared, would close a loop) are `candidates`
restated rather than re-derived, and the fourth (`outsideFilter`) is a guard on the TARGET
that `candidates` alone cannot give, since that function only filters the *candidate* side.

The payload-kind refusal — extension 3b's "no drop of this gesture changes a date" — is on
`CardDragController` itself (`src/view/interactions/cardDrag.ts`): every payload carries a
`kind` ('move' or 'link'), and every `canDrop` goes through one private `mine(data, kind)`
gate rather than a check repeated at each target. `wireDropTarget` — the one method every
region target already called — took a `kind: DragKind = 'move'` parameter rather than
gaining a `wireLinkTarget` sibling: registering a target the ordinary way, with no fourth
argument, refuses a link by construction, which is the whole point of putting the check at
the forbidden thing rather than at a second method somebody has to remember to reach for.
The bar-as-link-target half of `wireBarLink` calls the same method with `kind: 'link'`.
`wireLinkSource` and `wireLinkPointer` are the other two new registrations — a draggable
connector and a monitor for wherever the pointer is, gated on the same private token so a
split pane never draws another view's line.

The dated shelf's own test ("does not unschedule when released on the dated shelf") does
NOT by itself prove this guard load-bearing: the shelf's `accepts: (source) => source.hold
=== 'body'` (`src/view/render/shelf.ts`) already refuses a link on its own, since a link's
`CardSource.hold` is always `null` — an unrelated, incidental filter, not the `mine()` gate.
What proves the gate is `test/view/cardDrag.test.ts`'s "wireDropTarget refuses a link by
construction, with no accepts filter of its own", which wires a bare `wireDropTarget` with
no `accepts` of its own — the everyday shape — and drags a real link source onto it
directly, no shelf or grid involved.

The connector itself is drawn by `renderConnector` in `src/view/render/timeline.ts`, which
also gives every `pbl-timeline-row` its `data-pbl-path` — what the legality sweep marks
rows by, since a title is not an identity. Its own reveal and the `(hover: none)` block that
undoes it, from extension 1e above, are in `styles/timelineFurniture.css`
— not `styles/timeline.css`, which reached its 400-line cap building the grid this note
draws on — and the drag-state rules (the illegal dimming, the drop-over outline, the
preview line) are filed there beside it for the same reason, overriding by specificity
rather than position. The declutter that hides bar labels while a gesture is aimed is
`.pbl-linking`, never `.pbl-dragging`: that class also reveals the tree's root strip for a
card move, which a link can never use, since it reparents nothing.
