---
type: Feature
parent: "[[Product Kanban]]"
order: 80
status: Open
created: 2026-08-15
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# An Iterations board

A second board over the *same* work the product board shows, scoped to one time box at a
time. An iteration is a note of its own — a declared type, like a milestone — and a work
item joins one by naming it in a link property. The board is reached from a scope picker
beside the projection toggle rather than from a toggle position of its own: `Product`, or
one of the iterations, the way the roadmap offers its two axes from one control
([[Horizons or dates]]).

**Nothing yet.** The work extends the seams [[A Deliverables board]] already cut — a
second `Workflow` factory in `src/domain/board.ts`, a settings group mirroring the
Deliverables one, and a resolver beside `resolvedDeliverableStateKey` in
`src/domain/optionalProperties.ts` — plus one control in
`src/view/render/toolbarControls.ts` that the roadmap's axis picker is the template for.

## Why a scope, and not a fifth toggle position

The Deliverables board took a toggle position because there is exactly **one** of it: its
population is a type, the vocabulary is fixed, and the position is as permanent as the
name. Iterations are unbounded and only accumulate — a vault three years in has seventy
of them, and a toggle with seventy positions is not a toggle. The count is the whole
argument. A scope picker holding a growing list is the control that already exists for
that shape, and the roadmap's axis picker is the one to copy.

It is deliberately **not** argued from the two boards holding the same work, which they
do not: an iteration board shows `Deliverable` cards and the product board excludes them.
A sprint is a commitment to finish some work, and a concept or a design is part of what a
sprint commits to — so this is the one board where both kinds sit together, columned by
one workflow, which is what makes it a board rather than two boards drawn side by side.

## Why the workflow is its own

The same argument [[A Deliverables board]] makes, at a different seam: what "in progress"
means inside a two-week box is not what it means across a release. An iteration workflow
is therefore configurable independently — its own state property, its own ordered states,
its own done values — and falls back to the product board's **field by field** when left
unset, so a vault that never named a second property still gets a working board rather
than an inert one.

## Outcome

*(Written when the work lands.)*

## Use cases

- [[An iteration is a note of its own]] — the type, the link property that puts an item
  in an iteration, and the menu that sets it.
- [[A board scoped to one iteration]] — the scope picker, the population, the columns
  and the moves.
- [[An iteration draws as a bar or a line]] — the split between what a marker *is* and
  what a marker is *drawn as*, and the option that picks.
