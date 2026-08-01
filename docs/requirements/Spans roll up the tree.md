---
type: PBI
parent: "[[The timeline]]"
order: 20
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/model.ts
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

1. The walk that computes rollups also gathers each subtree's date envelope — the
   earliest and the latest of every date its results state, which is earliest start to
   latest target when children carry both ends, and which cannot run backwards when
   they carry one — results only, traversing through context rows without counting
   them.
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
   disagreement as below.
4. The inferred span updates as children change, because it is derived, never stored.

**Extensions**

- **1a — a context row carries dates.** They stretch nothing: a span is derived from the
  Base's results, and an excluded note's dates are not this base's plan. A context parent
  placed by focus infers from its visible results only — the rollup rule unchanged.
- **2a — some children are dated and some are not.** The bar renders the known span and
  fades at the end the undated children leave uncertain — the Plans convention: honesty
  drawn into the pixels rather than a number pretending to be complete.
- **2b — no descendant carries a date.** The parent is unplaced like any other dateless
  item: the shelf, with its subtree beside it in the count.
- **3a — the parent's own dates disagree with its children.** Both render as stated — a
  child's bar may overflow its parent's — because resolving the disagreement silently
  would overwrite a decision with an inference. The visible conflict is the feature.

## Acceptance criteria

- A dateless parent renders its results-only date envelope — the earliest to the
  latest of every date the subtree states; earliest start to latest target with
  both-ended children, and never a reversed span whatever mix of single-ended
  children it holds — styled as inferred, faded where partly unknown, recomputed
  each render, written nowhere.
- A parent's own dates always win endpoint by endpoint: a supplied end renders as
  stated even when children overflow it, an end left empty fills from the results-only
  subtree and carries the inferred styling alone, and an end neither supplies stays
  open; the disagreement renders rather than resolves. An inferred end never crosses a
  stated one — where the envelope falls on the wrong side of the parent's own date,
  that end stays open rather than drawing a reversed span.
- Context rows' dates never contribute to any span, and a context parent's inferred
  span describes its visible results only.
- A subtree with no dates at all shelves.

## Where it lives

**Nothing yet — this note is design.** The gathering runs in the rollup walk in
`src/domain/model.ts`, which already traverses through context rows without counting
them — one walk, one statement of the invariant, and the span inherits it for free.
