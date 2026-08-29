---
type: Issue
order: 10
parent: "[[Backfill missing properties]]"
status: Open
priority: P3
area: limitation
created: 2026-08-02
source: found while building [[Milestones as their own type]]; named in PR
files:
  - src/domain/writePlan.ts
  - src/view/interactions/plan.ts
  - src/domain/itemTypes.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The backfill stubs a key a milestone may not touch

## The limitation

Two rules that are each correct disagree about one note.

`missingKeyStubs` in `src/domain/writePlan.ts` walks `OPTIONAL_FIELDS` and stubs every
configured key the note does not already carry. It asks one question per field — is the
key configured, and does the note already hold it — and it asks nothing about the note's
**type**. So a `Milestone` in a view configuring both date properties is given a `start:`
key by the backfill, exactly as an Epic is.

`placementEnds` in `src/view/interactions/plan.ts` narrows a marker to its target alone:

```ts
function placementEnds(item: BacklogItem): ('start' | 'target')[] {
	return isMarkerType(item.typeName) ? ['target'] : [...BOTH_ENDS];
}
```

`carriesDates` and the Unschedule entry both read that narrowing, so for a milestone they
consider only `target`. A milestone whose only date key is the `start:` the backfill just
wrote therefore reports as carrying no dates, and **no path offers to remove it**. The
plugin created a key and then declared it untouchable.

## Why the two are both right

The narrowing is the rule [[Milestones as their own type]] exists to state: a marker is a
point in time, its date is the target property, and a `start` on one is **ignored — never
rewritten, and never removed**, because ignoring a value and deleting it are different
acts. That is deliberate and should not change: a vault may already carry a `start` on a
note the user later retypes to `Milestone`, and eating it would be a write nobody asked
for.

The backfill is also right to be type-blind in general — its job is to make a note's
properties bindable so the view's pickers have something to offer, and every other field
wants exactly that.

What is wrong is only the intersection: the backfill *creates* the value the narrowing
politely leaves alone. "Do not delete a start the user wrote" is a good rule; "do not
delete a start **we** wrote" is not the same rule, and the code cannot currently tell
them apart.

## Why it is not fixed yet

**The fix is a layering question, not a line.** `missingKeyStubs` is in `src/domain/`,
`placementEnds` is in `src/view/`, and the architecture is one-directional — domain may
not reach up into view. So the narrowing has to move *down* before the backfill can ask
it: most likely beside `isMarkerType` in `src/domain/itemTypes.ts`, or as a field-set
question in `src/domain/settings.ts` where the optional-property table already lives.

That is a real change to where a rule lives, and the rule is young. It is also worth
doing once rather than twice: the three specified-but-unbuilt placement gestures
([[Drag from the shelf to schedule]], [[Move and resize a bar]],
[[Keyboard and menu on the roadmap]]) all inherit `placementEnds` by asking it, and a
domain-side home would serve them too.

## What it is not

Harmless to everything derived. `placeMarker` reduces a milestone to its target point
before any span rule is asked about it, so a stray `start:` cannot shelve the note,
cannot reverse its span, and cannot reach `barGeometry`. It is not evidence either — a
marker aggregates into nothing, which is the exclusion `assignAll` carries. The cost is
an inert key in frontmatter that the view will not clear, visible to anyone reading the
note's properties and to any other tool that reads them.

## Where it lives

`missingKeyStubs` and `planBackfillWrite` in `src/domain/writePlan.ts` decide what the
backfill creates; `placementEnds`, `canSchedule` and `carriesDates` in
`src/view/interactions/plan.ts` decide what a placement may take away. The predicate that
would join them is `isMarkerType` in `src/domain/itemTypes.ts`.
