---
type: PBI
parent: "[[Assigned work in the sidebar]]"
order: 10
status: Open
created: 2026-08-31
source: user request, 2026-08-31
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
---

# One person's tree

**As** a contributor whose work spans several branches of the backlog, **I want** the tree
that already draws a release's scope to draw MINE as well, **so that** the two screens
cannot drift about what a member is, what a context row is, or what a rollup counts.

## Use case

| | |
| --- | --- |
| **Actor** | The domain layer, on behalf of any screen that draws a scope over a subset of the tree |
| **Trigger** | A screen needs the members of a base's results that satisfy some question, plus every ancestor holding one in place |
| **Preconditions** | A `BacklogModel` has been built |
| **Guarantee** | Every row whose `isMember` predicate answers true is a member; every ancestor that holds one in place — skipping a marker and skipping an `outsideFilter` ancestor, the walk continuing upward past both — is drawn as context, carrying no membership of its own; a row's `memberTotal`/`memberDone` count only members at or below it, never the row itself; `subtreeDone` is true only when every member at or below the row (its own membership included) is done. Nothing here writes a note. |

**Main flow**

1. The caller has a `BacklogModel` and a predicate answering, for one item, whether it
   counts as a member.
2. `scopeRows` walks the model's real roots, keeping every member and every ancestor
   that holds one in place — except a marker or an `outsideFilter` row, which the walk
   passes through rather than keeping, continuing upward to the next included ancestor.
3. It returns one row per kept item, in pre-order, each carrying its depth in this
   tree (not the backlog's), whether it is a member or context, and the rollup below it.
4. A caller folds, hides done or renders from these rows through the four transforms
   this same module exports — `rowsAfterHideDone`, `visibleRows`, `siblingPlaces` and
   `childRows` — none of which reads membership again.

**Extensions**

- **1a — a member sits under a marker** (an Iteration, a Milestone). The marker is never
  kept — `descendantCount` scores one 0 and traverses it, so a marker is never what holds
  a row in place — and the walk continues past it, so the member re-roots at the level
  the marker occupied rather than losing a level or losing the member.
- **1b — a member's ancestor is `outsideFilter`.** The context-row rule says such a row is
  never a source of anything derived from the results, so it is skipped exactly as a
  marker is: the walk continues upward, and the nearest INCLUDED ancestor becomes the
  member's context row. This is the one behaviour, not a choice a caller makes — there is
  no parameter to keep an excluded ancestor instead, on this screen or on any other that
  calls `scopeRows`.
- **1c — a row is both an ancestor of one member and a member itself.** It is drawn once,
  as a member (`context: false`), and its own rollup counts what is below it exactly as
  any other member's does.
- **1d — no root has any member below it.** `scopeRows` returns an empty array; a caller
  is what decides how to draw that.

## Acceptance criteria

- A member's ancestor that is not itself a member is drawn as context, carries no
  membership, and `memberTotal` on it is exactly the number of members it holds in
  place — no ancestor and no descendant beyond that is ever added to the count.
- A member filed under a marker re-roots at the level the marker occupied; the marker
  itself draws no row.
- A member whose ancestor is `outsideFilter` re-roots under the nearest included
  ancestor, or at the top level if none exists; the excluded ancestor draws no row.
- `subtreeDone` on a row is true exactly when every member at or below it, its own
  membership included, is done — never `item.subtreeDone`, which counts every
  non-marker descendant the base returned regardless of membership.
- `releaseScope` (`src/domain/releases.ts`) and `src/domain/assignedWork.ts`'s
  `assignedRows` both call `scopeRows` with their own membership predicate, and neither
  keeps a second copy of the keep-set walk or the rollup.
- `rowsAfterHideDone`, `visibleRows`, `siblingPlaces` and `childRows` take and return
  only `ScopeRow[]` (plus a fold set, where needed) and read no membership.
- Nothing under this note writes a note.

## Where it lives

The walk (`ScopeRow`, the keep set, the pre/post-order rollup) and the four row-list
transforms are `src/domain/scopeRows.ts` — pure, over any membership predicate, reading
the model in `src/domain/model.ts` and touching no DOM. `releaseScope` in
`src/domain/releases.ts` calls it with the release membership property as its predicate;
`src/domain/assignedWork.ts` calls it with the assignee as its own. `src/view/release/scopeTree.ts`,
`src/view/release/renderScope.ts` and `src/view/release/scopeToolbar.ts` draw the
release's own rows from these; the assigned-work view's own render module does the same
for its tree. One walk, two membership questions, is the whole of what this note is for:
it is what stops the release scope and the assigned-work tree from ever drawing two
different answers to "what is a context row here".

`src/domain/assignedWork.ts` is one person's whole answer to "whose work is this, and
what is next" — three rules, pure, no DOM and no writes:

- **Whose work: the assignee LINK's own target, never its spelling.** `assignedTo` reads
  `item.assigneeEntry?.file?.path`, so two notes naming one person through different link
  text — a bare name and a path — are one person's tree rather than two, and a value
  resolving to nobody is nobody's work. `pickedResource` looks the picked path up on
  `model.resources`, the roster, rather than in `byPath`: a `Resource` note is diverted
  before it is ever a `BacklogItem`, so a person's own path is never a key there.
- **Membership is `inPlan` OR `inCatalog`, minus every marker — of every type, per
  [[My work]].** `inPlan` alone would refuse the whole test catalog ladder along with a
  `Release` and an `Iteration`; a test case somebody is assigned is still work they do, so
  `assignedRows` admits `inCatalog` beside it. A `Release` and an `Iteration` stay refused
  even so — they are containers work is put IN, not work a person does — and `isMarkerType`
  refuses every marker the same way `inIteration` already does. This was an open question
  the plan left for this task to settle (PR #234); the answer is "admit the catalog,
  still refuse every marker."
- **Plan order decides what is next, and a context row is never the answer.**
  `nextAssigned` walks the rows `scopeRows` already produced and returns the first one
  that is both a MEMBER (`!row.context`) and unfinished (`!ownWorkflowReading(row.item).done`).
  There is no second `order` per person — plan order already says what is ranked highest —
  and a context row is skipped regardless of its own state, because it is never a write
  target and therefore never something to do next.
