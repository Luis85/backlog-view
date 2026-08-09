---
type: Bug
parent: "[[Move and resize a bar]]"
order: 20
status: Open
area: view
priority: P3
created: 2026-08-09
source: Found while fixing the same defect on the dependency connector — Codex review on
  PR #114 raised the connector, and the grips turned out to be the identical case one
  pixel away
files:
  - src/view/render/timeline.ts
  - src/view/render/board.ts
---

# A bar grip click opens the note

## What happens

Clicking a bar's resize grip on the dated axis, without moving far enough for the press to
become a drag, opens the note. The grip is a handle for a date, not a link, and the note
opening is the row's action reaching a control that meant something else.

Driven in the jsdom harness on 2026-08-09, against the current `main` behaviour: a `click`
dispatched on `.pbl-bar-grip` leaves `vault.opened` holding `Alpha.md`. Both grips are
affected; a middle click reaches the row's `auxclick` and opens it in a new tab by the
route a primary-click guard would not cover.

## Why

`wireCardActivation` (`src/view/render/board.ts`) puts an **unfiltered** click handler on
the row, and the grips are `div`s inside the bar inside that row. Nothing between them
stops the event, so the row's handler runs for a press that was aimed at the grip.

This is the house pattern working as designed and one control not having joined it: every
other interactive thing inside a card carries its own `stopPropagation` — `.pbl-card-kid`,
the chevron, the card-children toggle, the state and horizon chips, eight sites in all,
each with the reason written beside it. The grips never got theirs.

## Not fixed here on purpose

The dependency connector had exactly this defect and was fixed in PR #114, where it was in
scope: that PR introduced the connector. The grips are older than that PR and shipped on
`main`, so changing them inside it would put a behaviour change reviewers of a dependency
feature are not looking for into its diff, and would make one revert undo two unrelated
things.

The fix is two lines in `renderBar`'s hold loop, in the same idiom as the connector's:

```ts
if (hold !== 'body') {
	grip.addEventListener('click', (evt) => evt.stopPropagation());
	grip.addEventListener('auxclick', (evt) => evt.stopPropagation());
}
```

**The `hold !== 'body'` guard is the whole subtlety and must not be dropped.** The body
hold IS the bar element (`hold === 'body' ? el : el.createDiv(...)`), so a guard applied to
every hold would stop a click on the BAR from opening the note — which is behaviour a
reader depends on and nobody asked to change. Only the two edge grips are the handles that
mean something else.

## The wider question this leaves

Eight `stopPropagation` sites and now a ninth is the shape of a rule that is kept by
remembering. A filter inside `wireCardActivation` — ignore a click whose target is an
interactive control within the card — would hold for controls not yet written, which is
what the root guide asks of a category invariant ("checked at the forbidden thing, not by
listing the places"). It was not done as part of the connector fix because imposing a
central filter on eight existing call sites is a refactor, not a bug fix, and it needs its
own decision about what counts as a control. Worth taking up with this bug rather than
before it.
