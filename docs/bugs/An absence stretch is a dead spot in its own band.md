---
type: Bug
parent: "[[Resource absences]]"
order: 10
status: Done
area: drag and drop
priority: P2
created: 2026-08-14
closed: 2026-08-14
source: Review of the resource timeline, 2026-08-14 — found by reading, confirmed by a driven drag
files:
  - src/view/render/timeline.ts
  - test/view/resourceAbsences.test.ts
---

# An absence stretch is a dead spot in its own band

## What happened

On the resources axis, dropping a bar anywhere on a resource's band assigns it to that
resource — its header, any of its bar rows, any context row it places. Anywhere except
the one kind of line the band grew last: an **absence stretch**. A release there writes
nothing, highlights nothing and reports nothing. Confirmed by driving the real gesture: a
bar dropped on the absence row inside Bob's band keeps `assignee: Alice`.

It is the worst line to lose, because absences **lead** the band (`laneEntries` in
`src/view/render/lanes.ts` — an unavailable stretch is a fact about the row, and the work
reads against it). So the dead strip sits between a row's header and its work, exactly
where a pointer aiming for the row passes through.

## Why

The band has no container to wire — every line is a sibling positioned against one shared
day grid — so [[Assigning items to a resource]] wires it **element by element**, through
`TimelineDrawing.laneTarget`. `drawEntries` in `src/view/render/timeline.ts` does that in
one loop, and the absence branch `continue`s before reaching it:

```ts
if (entry.kind === 'absence') {
    const away = renderLaneAbsence(...);
    if (lane) renderLaneRowDescription(away, lane.name);
    continue;               // <- never reaches laneTarget?.(row, lane)
}
```

The two lines below the loop's `continue` are the wiring every other line gets. The
absence branch does remember to name the row (`renderLaneRowDescription`), which is what
makes this read as complete on inspection: half of what a band line owes is there.

This is the recorded cost of per-element wiring arriving, not a surprise. The
specification for it names the element kinds as a **list** — "the header, each bar row,
each excluded note's row" — and a list is what the fourth kind, added a commit later by
[[Resource absences]], could join silently by not joining. The fix is one call; the
finding is that "every element of the band is a target" was never a rule anything asked,
only a sentence enumerating what existed when it was written.

## The fix

There is now ONE place a line of a band is finished — `inBand` inside `drawEntries` — and
it does both things a line owes: says whose row it is in, and joins the list of the band's
elements. A fifth kind of line has one call to make instead of two to remember.

The check is stated from the RULE rather than from the list of kinds that existed when it
was written, which is the whole lesson here: `test/view/resourceAbsences.test.ts` collects
every line of one resource's band off the rendered DOM, asserts the count, and drives a
drop at each — so a kind added later either joins the band or fails this.
