---
type: Bug
parent: "[[Move and resize a bar]]"
order: 20
status: Done
area: view
priority: P3
created: 2026-08-09
closed: 2026-08-09
source: Found while fixing the same defect on the dependency connector — Codex review on
  PR #114 raised the connector, and the grips turned out to be the identical case one
  pixel away
files:
  - src/view/render/timeline.ts
  - src/view/render/board.ts
  - test/view/timelineDrag.test.ts
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

## The fix

Two lines in `renderBar`'s hold loop, the same idiom as the connector's guard:

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

That is why the tests are a PAIR rather than one, in `test/view/timelineDrag.test.ts`: the
grips stay silent on both event routes, and the bar itself still opens its note. Written
first and watched failing — the grip half red at four opens (two grips, two routes), the
bar half already green, which is what proves the second test is guarding something the
first could have broken rather than restating it.

## Fixed later than found, deliberately

It was raised inside PR #114 and initially left out of it: the grips shipped before that
branch, so folding them in would have put a behaviour change reviewers of a dependency
feature were not looking for into its diff, and made one revert undo two unrelated things.
It went in on the same branch once the maintainer asked for it, which is the difference
between a scope judgement and a decision — the judgement is mine to make, the decision is
not.

## The wider question this left, and its answer

Ten `stopPropagation` sites was the shape of a rule kept by remembering, and this bug plus
the connector's are what it cost: opting out was each control's job, and the two newest
controls both forgot.

That is now a filter — `fromRowControl` in `src/view/render/rows.ts`, asked by both
row-activation wirings — and the per-control guards are gone, this fix's two among them.
The question the deferral named ("what counts as a control?") is answered by `ROW_CONTROL`:
`button`, plus the three kinds this codebase deliberately does not draw as buttons. That is
a rule rather than a list of places, because the view guide already requires every new
per-row control to be a real `<button>` — so one written tomorrow is covered without
touching the selector, which is what the root guide asks of a category invariant.

The two tests below survived the refactor unchanged and are what proves it kept this fix's
behaviour: the grips stay silent, the bar still opens.
