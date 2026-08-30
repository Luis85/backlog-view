---
type: Bug
order: 20
parent: "[[A board scoped to Deliverables]]"
status: Open
priority: P2
area: view
created: 2026-08-30
source: Review of the [[New cards in place]] decomposition (Codex, PR #225)
files:
  - src/view/projection.ts
  - src/view/render/toolbar.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# An Iteration focus offers a type the board cannot draw

## What happened

On the requirements board, with an `Iteration` focus retained, the primary **New**
button offers `Iteration` — and the note it creates is one `inPlan` refuses to draw, so
it vanishes from the board that made it on the pass that made it.

The mechanism is an early return. `byProjectionType` answers the `board` projection with
`types.filter((type) => !isDeliverableType(type))` and returns there; the
`!isIterationType(type) && !isReleaseType(type)` filter is in the function's **final**
return, which the board never reaches. `honouredFocusLevel` rejects only `isReleaseType`,
so an `Iteration` focus is honoured rather than cleared, and `primaryNewType`
(`render/toolbar.ts`) then finds `Iteration` in `offerableTypes`' answer and keeps it.

This is [[A board scoped to Deliverables]]'s own rule broken a third time, on a type it
did not name. That note records it being *"broken twice by being applied a surface at a
time"* and answers with **one rule, one function**; the function is right and its board
branch leaves before reaching half of it. The rule it states — *"a projection offers only
the types it can show"* — is the sentence this contradicts, and the comment above the
final return already says why each surface fails differently: *"`New` would make a note
that vanished on the pass that created it"*.

Found by inspection during review rather than from a report, so no user has hit it; the
state needs a retained `Iteration` focus, which the picker offers for the same reason.

## Fix

Not yet made. The narrowing belongs in one pass rather than one branch: the
`Iteration`/`Release` filter has to apply to the board projections too, not only to the
fall-through. The shape that composes — a filter applied to every projection's result
rather than a branch that returns early — is the one `offerableTypes` already uses for
the catalog narrowing directly below, which was added for this exact failure and states
it: *"It COMPOSES with the type narrowing above rather than replacing it, and that is the
bug this shape was written to fix: the board's early return meant every whole-vocabulary
caller there still offered `Test suite` and `Test case`."*

The test that must fail without it: `offerableTypes` on the `board` projection returns no
`Iteration`, asked of the helper rather than of a surface — the category is what broke
three times, and a test per surface is what let the second and third through.

## Lesson

**An early return in a function that narrows by rule drops every rule below it.** The
catalog narrowing was moved out of `byProjectionType` precisely so the board would reach
it; the `Iteration`/`Release` filter stayed inside, and so the board still does not. When
one function is made the single home for a rule, every branch of it has to reach every
part of the rule — otherwise "one rule, one function" is true of the file and false of
the behaviour.
