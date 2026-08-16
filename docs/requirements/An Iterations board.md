---
type: Feature
parent: "[[Product Kanban]]"
order: 65
status: Active
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

A second board scoped to one time box at a time — **not** a re-cut of the product board's
population. It shows every result that names the chosen iteration, `Deliverable` items
included, which the product board excludes; and it excludes `Iteration` notes themselves,
which the product board would happily draw. Two boards over one backlog, neither a subset
of the other. An iteration is a note of its own — a declared type, like a milestone — and a work
item joins one by naming it in a link property. The board is reached from a scope picker
beside the projection toggle rather than from a toggle position of its own: `Product`, or
one of the iterations, the way the roadmap offers its two axes from one control
([[Horizons or dates]]).

**Nothing yet.** The work extends the seams [[A Deliverables board]] already cut — a
second column builder in `src/domain/board.ts` and two more list options beside the
Deliverables group's — plus one control in `src/view/render/toolbarControls.ts` that the
roadmap's axis picker is the template for. It cuts no new seam of its own: the board
reads the product board's own state key, and the only new write path is the date pair
that joining an iteration stamps.

## Why a scope, and not a fifth toggle position

The Deliverables board took a toggle position because there is exactly **one** of it: its
population is a type, the vocabulary is fixed, and the position is as permanent as the
name. Iterations are unbounded and only accumulate — a vault three years in has seventy
of them, and a toggle with seventy positions is not a toggle. The count is the whole
argument. A scope picker holding a growing list is the control that already exists for
that shape, and the roadmap's axis picker is the one to copy.

**The count argument then took the Deliverables position too** (2026-08-16, user
request). Once the picker existed, one row held two controls both answering "which
board": a toggle position for one board and a picker for the rest is two doors with a
rule about which board uses which, and the user chose one door — the `Board` button is
every board, and its picker leads with `Product` and `Deliverables` (each under the icon
its surface already wears) above the iteration scopes. The original argument above is
kept, not overwritten: it was the right reason to build a picker at all, and it never
said the toggle position had to survive the picker's arrival. The pick is retained
exactly as an iteration scope is — `Board` reopens the board this view was last on — as
a stored word beside the stored path, never a fifth `mode`, so the two cannot
contradict.

It is deliberately **not** argued from the two boards holding the same work, which they
do not: an iteration board shows `Deliverable` cards and the product board excludes them.
A sprint is a commitment to finish some work, and a concept or a design is part of what a
sprint commits to — so this is the one board where both kinds sit together, columned by
one workflow, which is what makes it a board rather than two boards drawn side by side.

## Why the workflow is the product's, narrowed

**The opposite of what this note said until 2026-08-16**, and the reversal is worth
keeping rather than overwriting. The argument here was [[A Deliverables board]]'s, at a
different seam: what "in progress" means inside a two-week box is not what it means
across a release, so an iteration would carry its own state property, its own ordered
states and its own done values, falling back field by field when unset.

The user refused it before it was built: *"I don't want to add another workflow… I want
to use the same workflow as the product just narrower into a simple Open, In Progress,
Done workflow based on products workflow."* Two properties for one question is two places
a state can be wrong, and a fallback is machinery that exists only to reconcile them.

So the board reads the **product** state key and buckets that one workflow into three
columns. Which product states are **Open** — the iteration backlog — and which are
**Resolved** is configured; everything else is In Progress. The third column is
`Resolved` rather than `Done` because a product workflow can hold states downstream of
the point a sprint is finished with an item, so the board's terminal stage claims the
weaker verdict and the item's own workflow still decides whether it is styled as
finished.

The Deliverables board's argument still holds *for the Deliverables board*. What was
wrong was reaching for it here: two boards over the same population differ by which
**states** matter, not by which property holds them.

## Why joining an iteration schedules the item

An iteration is a time box, so joining one is a commitment to those dates. Setting an
item's iteration therefore writes the iteration's start and target onto it in the same
batch as the link — one undo slot for one decision. It writes no state: an item is in the
backlog column because it has not been started, never because joining stamped it there.

## Outcome

**Four of five use cases landed on 2026-08-16.** A vault that names an iteration
property has a twelfth type, a link that puts work in a time box and takes its dates with
it, and a board scoped to one sprint reached from a picker beside the projection
switcher. `An iteration draws as a bar or a line` has not landed, which is why this
Feature is still `Active` rather than `Done` — a Feature closed over an unbuilt use case
is a defect this register has recorded before.

**What the build settled that the design could not.** Three of them are worth carrying
forward, because each was a place a value was defined once and read another way.

A bucket is **not** its state. `BoardColumn` carries `bucket` and `takesDrop` beside
`state`, because two buckets with nothing to write both hold `state: null` — so a fold
key, a drop wiring, a column class and a menu entry all keyed on that null would have
treated them as one column, colliding with the legitimate key-removal column on top.
`columnFoldValue` is the single statement of that identity.

The **effective scope is resolved once, upstream**, and so is the projection it implies.
Falling only the renderer back to the product board left every other gate answering as an
iteration board — the count included Deliverables, the focus control stayed inert, the
filter used the whole-tree index. An iteration board whose scope no longer resolves IS
the product board, everywhere.

And the **done-column fold default is off here**, for the reason the completed-items
toggle is: Resolved is what the sprint finished, so a default that shut it would fold
away the answer the board is opened to read.

**Still owed, and not answerable here**: the scope picker's fit in a one-line toolbar
once a vault holds many iterations, the goal line and the dialog against a real theme,
and whether three columns read as a board rather than as a product board missing some.

## Use cases

- [[An iteration is a note of its own]] — the type, the link property that puts an item
  in an iteration, the goal it carries, and the menu that sets them.
- [[An iteration's timeframe schedules its items]] — what joining an iteration writes,
  and the three things it refuses to write.
- [[A board scoped to one iteration]] — the scope picker, the population, the three
  buckets and the moves.
- [[Creating an iteration from the board]] — the two picker entries, the dialog, and a
  new iteration's dates from the previous one.
- [[An iteration draws as a bar or a line]] — the split between what a marker *is* and
  what a marker is *drawn as*, and the option that picks.
