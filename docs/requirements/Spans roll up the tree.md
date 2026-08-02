---
type: PBI
parent: "[[The timeline]]"
order: 20
status: Done
priority: P2
created: 2026-08-01
files:
  - src/domain/model.ts
  - src/domain/timeline.ts
  - src/domain/roadmap.ts
  - src/view/render/timeline.ts
---

# Spans roll up the tree

**As** someone planning epics by their children, **I want** a parent without dates to
span its children's, **so that** the timeline shows every level of the tree without me
maintaining copied dates that drift.

This is the Jira Plans rule, adopted whole because every part of it earns its place:
a parent's bar derives from its children — earliest start to latest target — the
rollup fills only fields the parent left empty, a manually dated parent always wins,
an inferred bar is styled as inferred, and the rolled-up values are never written back
to any item. The machinery is the walk this model already does for progress rollups,
which is also what keeps the context-row rule in force without a second statement of
it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The timeline renders a parent whose own date properties are empty |
| **Preconditions** | Roadmap mode is on with the timeline axis |
| **Guarantee** | An inferred span is display only — nothing is ever written back to the parent — and the parent's own dates, when present, always win over any inference. |

**Main flow**

1. The walk that computes rollups gathers each subtree's date evidence by kind — the
   earliest known start and the latest known target among its results, starts only
   ever standing for starts and targets only for targets — results only, traversing
   through context rows and markers without counting either.
2. A dateless parent over dated descendants renders the gathered span, styled as
   inferred so a reader can tell a plan somebody made from a summary the view drew.
3. A parent's supplied dates win endpoint by endpoint: a parent with both renders
   exactly those; one that supplied only a start or only a target keeps that end as
   stated while the empty end fills from the subtree, carrying the inferred styling on
   that end alone. An end neither the parent nor its results supply stays open, as any
   single-dated bar's does — and an inferred end never crosses a stated one: where the
   subtree's envelope falls on the wrong side of the parent's own date, the empty end
   stays open instead, because an inference may extend a statement and never
   contradict it. The children's bars then sit visibly outside, the same rendered
   disagreement as below. And a parent whose own pair is reversed is not a parent with
   dates: unreadable shelves it with the reason ([[Bars from two dates]]), and no
   inference stands in for a value that needs fixing.
4. The inferred span updates as children change, because it is derived, never stored.

**Extensions**

- **1a — a context row carries dates.** They stretch nothing: a span is derived from the
  Base's results, and an excluded note's dates are not this base's plan. A context parent
  placed by focus infers from its visible results only — the rollup rule unchanged.
- **1b — a marker is nested in the subtree.** Its date is not evidence and stretches
  nothing. A milestone is a point somebody committed to, not a record of when work
  happens ([[Milestones as their own type]]), so a release date hand-placed under an epic
  must not become that epic's inferred end — the bar would then report a deadline as
  progress. This is the same exclusion the progress count makes and the second exception
  the walk carries, for a different reason than 1a: not a row from outside the results,
  but a result that is not work.
- **2a — some children are dated and some are not.** The bar renders the known span and
  fades at the end the undated children leave uncertain — the Plans convention: honesty
  drawn into the pixels rather than a number pretending to be complete.
- **2b — no descendant carries a date.** The parent is unplaced like any other dateless
  item: the shelf, with its subtree beside it in the count.
- **2c — the subtree supplies only one kind of date.** The end with no evidence of its
  kind stays open, exactly as a single-dated bar's does: an all-target subtree infers
  a finish and no beginning, never a closed span nobody stated.
- **2d — the two kinds cross** (an earliest start after a latest target, from
  single-ended children). Neither bounds the other: the bar covers the known dates
  with both ends open — evidence bracketing activity without claiming to bound it —
  never a reversed span, and never a date repurposed across kinds.
- **3a — the parent's own dates disagree with its children.** Both render as stated — a
  child's bar may overflow its parent's — because resolving the disagreement silently
  would overwrite a decision with an inference. The visible conflict is the feature.

## Acceptance criteria

- A dateless parent renders its results-only inference by kind — earliest known start
  to latest known target, an end without evidence of its kind staying open, and never
  a reversed span or a date repurposed across kinds, whatever mix of single-ended
  children it holds — styled as inferred, faded where partly unknown, recomputed each
  render, written nowhere.
- A parent's own dates always win endpoint by endpoint: a supplied end renders as
  stated even when children overflow it, an end left empty fills from the results-only
  subtree and carries the inferred styling alone, and an end neither supplies stays
  open; the disagreement renders rather than resolves. An inferred end never crosses a
  stated one — where the evidence falls on the wrong side of the parent's own date,
  that end stays open rather than drawing a reversed span. A parent whose own pair is
  reversed is unreadable and shelves with the reason, no inference standing in — a
  typo is surfaced, never papered over.
- Context rows' dates never contribute to any span, and a context parent's inferred
  span describes its visible results only.
- A marker's date never contributes to any span either, wherever it sits: an epic over a
  hand-nested milestone infers from its work alone, and infers nothing at all when the
  milestone is the only dated thing beneath it ([[Milestones as their own type]]).
- A subtree with no dates at all shelves.

## Where it lives

The gathering runs in `assignAll`, the same rollup walk in `src/domain/model.ts` that
computes the progress counts, under the same `outsideFilter` gate: a context row's own
dates contribute nothing, while the walk still traverses through it to the results
below — one walk, one statement of the invariant, and the span inherits it for free.
`earliest`/`latest` live in `src/domain/timeline.ts` beside the rest of the civil-date
arithmetic, as the pickers where a null end is never a bound. The endpoint-by-endpoint
merge is `inferSpan` in `src/domain/roadmap.ts`, beside the shelving it shares a
decision with: a stated date always wins, an empty end fills from evidence of its own
kind, an inference may extend a statement but never contradict it (evidence on the
wrong side of a stated end is dropped and that end stays open), crossed evidence covers
both known dates with both ends inferred, and a parent whose own pair is reversed still
shelves with its reason rather than taking an inference. `src/view/render/timeline.ts`
draws the result — the `pbl-bar-inferred` class (outlined, not filled) and " — inferred
from children" in the bar's aria-label and tooltip.

Driven in `test/domain/timeline.test.ts` (the date pickers),
`test/domain/modelDateEvidence.test.ts` (the walk gathering `descendantStart`/
`descendantTarget` by kind, never from the item itself), `test/domain/modelContextRows.test.ts`
(the context-row exclusion), `test/domain/roadmap.test.ts` (`inferSpan`'s merge rules,
including the crossed and reversed cases), and `test/view/roadmapFrame.test.ts` and
`test/view/rendering.test.ts` (the inferred class and label reaching the DOM), with
`test/helpers/vault.ts` carrying the fixture support the new cases share.

**Not yet built: extension 1b's marker exclusion.** The `Milestone` type does not exist
yet, so nothing excludes a hand-nested marker's date from an ancestor's inferred span.
It lands in the same walk and is inherited the same way, with
[[Milestones as their own type]] — that note's spec already says so.
