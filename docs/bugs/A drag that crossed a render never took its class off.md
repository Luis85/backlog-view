---
type: Bug
parent: "[[Move and resize a bar]]"
order: 30
status: Done
area: view
priority: P1
created: 2026-08-11
closed: 2026-08-11
source: Reported from a vault while drawing dependencies on the timeline — "suddenly all hover events were not working anymore and the circle didn't appear on hover", with the root-drop strip stuck on screen. Not reproducible by the reporter.
files:
  - src/view/interactions/cardDrag.ts
  - test/view/cardDrag.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A drag that crossed a render never took its class off

## What happens

The roadmap stops responding to the pointer, permanently, for the life of the view. Rows
no longer take `:hover`, a bar's dependency connector never appears, and so no new
dependency can be drawn. Reported with a fourth symptom that names the cause: the
`Move to top level` strip stayed on screen with no drag in flight.

One stale class explains all four. `.pbl-dragging` rides `.pbl-view` and every one of
those is a rule keyed on it:

| Rule | What a stale class does |
| --- | --- |
| `.pbl-dragging .pbl-timeline-drop { pointer-events: auto }` | The full-grid drop overlay stops being transparent to the pointer and swallows every event over the day area — this is the hover and the connector |
| `.pbl-dragging .pbl-timeline-header { pointer-events: none }` | The header stops responding too |
| `.pbl-dragging .pbl-bar-label { visibility: hidden }` | Bar labels stay hidden |
| `.pbl-dragging .pbl-shelf-empty { display: flex }` | An empty shelf stays drawn |
| `.pbl-view.pbl-dragging:not(.pbl-focused) .pbl-root-drop` | The strip stayed visible — the symptom that identified the class, and the only one of the five that no longer exists |

## Why

`wireCard` hung the class off the **draggable's** own hooks — added in its `onDragStart`,
removed in its `onDrop`. Two facts turn that into a permanent stranding:

1. `CardDragController.onRenderStart()` unhooks every registration this controller made,
   at the top of every render pass, because the projection is rebuilt wholesale.
2. Pragmatic resolves a source's callbacks out of its registry **at dispatch time**, not
   at drag start. Its own comment on the lookup says why: *"During a drag operation, a
   draggable can be — remounted with different functions — removed completely. So we need
   to get the latest entry from the registry"* (`adapter/element-adapter.js`,
   `dispatchEventToSource`).

So a gesture held across a render never gets its `onDrop`. And `viewEl` is built once in
the view's constructor and survives every render, so nothing later takes the class off.

**The drop was believed to still land**, and that is why this read as a cosmetic
stranding: the target under the pointer is a live element the new pass registered, and the
payload resolves against the rebuilt model exactly as designed. That belief was wrong, and
it hid a second, larger failure for four days — see
[[A release that crossed a render wrote nothing]]. Pragmatic looks a DROP TARGET up in its
registry at dispatch time exactly as it does a source, so the release reaches no `onDrop`
either, unless a `dragover` has landed on a re-registered element in between. The class
fix below is still right and still needed; what it was described as costing was not.

Why it appeared while drawing dependencies, and why it would not reproduce on demand: each
dependency write refreshes the view, so a session spent linking bars is a session full of
re-renders. The connector sits at the bar's right edge (`left: 100%`), so grabbing the bar
instead of the dot is one pixel away — and it only strands if a render happens to land
inside that one gesture. That is a race with the vault's own update timing, which is
exactly the shape of a bug a reporter cannot reproduce.

The document-level `dragend` net in `backlogView.ts` cannot cover it either, and the same
library comment says why: *"dragend does not fire if the draggable source has been removed
during the drag"*.

## The fix

The class is owned by a **monitor**, registered for the controller's whole life in its
constructor and cleaned up only by `dispose` — never among the per-render registrations:

```ts
monitorForElements({
	canMonitor: ({ source }) => this.mine(source.data, 'move'),
	onDragStart: () => this.viewEl.addClass('pbl-dragging'),
	onDrop: () => this.viewEl.removeClass('pbl-dragging'),
})
```

A monitor lives in a registry of its own and joins the drag's active set when the drag
starts, so it is told however that drag ends — a drop, a cancel, or the library's
broken-drag fallback (`getBindingsForBrokenDrags`) for a source removed mid-flight. The
rule it makes structural: **state put on an element that outlives the gesture has to be
taken off by a hook that outlives the render.** `cardEl.addClass('pbl-drag-source')` stays
on the draggable, correctly — that element does *not* survive a render, so a mark stranded
on it dies with it.

`canMonitor` gates on `'move'`, which reproduces the previous behaviour exactly: a link
drag never set this class, and `.pbl-linking` is its own.

## The test

`test/view/cardDrag.test.ts`, "still takes the drag state back off the view when the drop
lands" — start a bar drag, enter the overlay, assert the class is on, `refresh` the view
mid-gesture, drop on the re-queried overlay. Written first and watched failing at exactly
the reported state (`expected true to be false`), which is also the positive control: the
drop still lands in the red run, so the test is asserting the stranding rather than a
broken gesture.

## What this does not fix, stated rather than folded in

The tree's own `DragDropController` sets `.pbl-dragging` from a native `dragstart` and
clears it from `clearDragState`, which the same removed-source rule can skip. That hole is
real and reachable by the same route — a data update inside a tree drag. It is left alone
because it now has no visible consequence: with the root-drop strip gone, no rule keyed on
`.pbl-dragging` applies to anything the tree draws, and all four remaining ones are on
roadmap elements. The consequence that survives is remote — strand it in the tree, switch
to the roadmap, and the pane is dead — and closing it is not a one-line change: a tree drag
*survives* a render (it is keyed by path, and the new rows are re-wired), so clearing the
state at render start would break a gesture the card layer's fix deliberately keeps alive.
Worth doing if that route is ever seen; not worth guessing at here.
