---
type: Bug
parent: "[[Move and resize a bar]]"
order: 40
status: Done
area: view
priority: P1
created: 2026-08-15
closed: 2026-08-15
source: Reported from a vault on the resource timeline — "I can drag and see the ghost but it does not save the change, this is not always the case but happens usually the first few times"
files:
  - src/view/interactions/cardDrag.ts
  - src/view/backlogView.ts
  - test/view/cardDrag.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A release that crossed a render wrote nothing

## What happens

A bar is dragged, or resized by one of its end grips, the ghost follows the pointer and
states the dates it will write — and the release writes nothing. No note is changed, no
sentence is announced, no notice appears, and the bar snaps back to where it was. It is
intermittent, and it clusters in the first minutes after a view is opened.

## Why

`onDataUpdated` rebuilt the view immediately, and `renderTreeContent` calls
`CardDragController.onRenderStart()`, which unhooks every registration the controller
made. Pragmatic looks a **drop target** up in its registry at dispatch time —
`notifyCurrent` in `make-drop-target.js` does `registry.get(record.element)` and returns
silently on a miss — exactly as it does a source. So a release dispatched at a record whose
element was torn down mid-flight reaches no `onDrop`, and the write path is never entered
at all: there is no batch for the gate to refuse, and therefore nothing to report.

The browser hides it one layer further down. With no registered target under the pointer
the adapter stops calling `preventDefault()` on `dragover`, so the browser fires no `drop`
event in the first place — the gesture ends as a cancel.

It recovers on the next `dragover` over a re-registered element, which is what makes it
intermittent rather than permanent: Chrome fires `dragover` on a stationary pointer roughly
every 350ms, so the window is a release that lands between the render and the next one. And
it clusters at the start of a session because that is when unprompted data updates arrive —
the query settling, the metadata cache resolving.

[[A drag that crossed a render never took its class off]] found the same render pass four
days earlier and recorded the opposite conclusion — *"the drop still lands"* — from a test
that re-queried the drop target before releasing on it. Re-querying models a gesture that
moved again after the render, which is the case that works; the stationary release is the
case that does not. The claim was about the half of the mechanism that was being fixed, and
the half beside it was assumed rather than driven.

## The fix

A data update **waits for the gesture**, the shape the write gate already has for the other
thing a render destroys: `CardDragController.deferUpdate()` answers whether an update has
to wait, and the monitor that already owns `.pbl-dragging` — registered for the
controller's whole life, so it outlives every render — flushes it from its `onDrop`.

Two facts make the flush safe rather than lucky. Monitors are dispatched **after** drop
targets (`make-adapter.js`), so the batch the release planned is already in flight when the
rebuild happens. And the monitor is told however a drag ends — a drop, a cancel, or the
library's broken-drag fallback for a source removed mid-flight — so a deferred update
cannot be stranded.

Waiting costs nothing the payload was not already built for: a `CardSource` captures its
span and placement shape at drag start on purpose, `resolve` re-reads the note at drop time
against the live model, and the writer checks every stated baseline against the live
frontmatter before it lands anything.

A render can still cross a gesture by another route — a pane resize — which is why the
monitor stays what owns the drag class rather than that becoming redundant.

## The tests

`test/view/cardDrag.test.ts`, "still writes what the release named — the update waits for
the drop": start a bar drag, hover the overlay, deliver a Bases update, then release **on
the element the drag entered** with no `dragover` in between. Watched failing at exactly
the reported state — the note keeps its original start date and `writeLog` is empty — and
it asserts the deferred update is not lost either, or deferring for ever would pass.

Its neighbour, the class test, now drives `view.render()` directly rather than a data
update: with this fix a data update no longer crosses a render, so driving one there would
have quietly stopped asserting anything.
