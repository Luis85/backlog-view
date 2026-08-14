---
type: Issue
order: 10
parent: "[[Assigning type on a move]]"
status: Done
priority: P3
area: domain
created: 2026-08-01
closed: 2026-08-11
source: 2026-08-01 review of PR #24, found four times in four files
files:
  - src/domain/writePlan.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The dragged item is retyped, its descendants are not

**Closed on 2026-08-11 — the asymmetry went away with the feature, and was not resolved.**
Nobody picked a reading. [[Assigning type on a move]] was withdrawn on the same day, so
both branches of the question below are deleted code: no move writes a `type` at any
depth, and an unknown custom type now survives everywhere for the same reason a declared
one does — nothing is looking at it. That is the outcome this note said it could not
justify choosing, arrived at from the other direction, and the distinction is worth
keeping: a question can stop mattering without ever having been answered.

Everything below is the record as it stood, in the present tense it was written in.

## The limitation

With the re-typing option on, an unknown custom type — `Spike`, `Chore`, anything outside the ladder
and outside the two extra types — is **preserved when it is a descendant of a move and
rewritten when it is the thing being moved**. Two predicates, twenty lines apart in
`computeTypeChanges`:

| | Retyped when — the `if` as written | So what is exempt |
| --- | --- | --- |
| The dragged item | `!isExtraType(dragged.typeName)` | declared extra types only |
| Any descendant | `child.typeName !== null && child.levelIndex !== -1` | extra types **and** unknown customs |

The middle column is the guard the rewrite sits inside, copied as it stands, and the right
column is what falls out of it. Stating the condition and the exemption in one column
inverts one of them, which is how this table first shipped.

So a `Spike` nested inside a moved subtree survives; the same `Spike` dropped somewhere
becomes a `Feature`.

## Why it stays unresolved

Nobody chose it. `src/domain/CLAUDE.md` states the principle without the exception —
*"custom types outside the ladder are deliberate user data"* — and the descendant branch
honours it while the dragged branch does not. The asymmetry reads as an artefact of the
two branches being written for different reasons: the dragged-item exemption exists to stop
a `Bug`'s Tasks becoming PBIs, and it was written against `isExtraType` because that was
the case in hand.

There is a defensible reading — the dragged item is the one the user just acted on, so its
new position is a stronger instruction than three levels down — but it has never been
argued anywhere, and a rule nobody wrote down is not a decision.

Changing it either way is cheap and unevidenced, which is the argument for neither:

- `autoType` is **off by default**, so nothing here happens unless someone opted in.
- No report exists. Nobody has said their `Spike` became a `Feature`.
- Both readings are self-consistent. Picking one on taste would replace an accident with
  a preference and leave the next reader in the same position.

## What lifted it

Neither of the two things this section listed — a report, or a decision written down.
What lifted it was the removal of the code the question was about, which the user chose
over building the check a separate defect in the same function needed. So the reading was
never picked, and if a cascade is ever built again, it is picked then and from scratch.

## Where this is stated

Five sites described this behaviour, each for a different reader, and **all five changed
together** when it was removed — this table was the checklist used to do it, which is the
one use a list like this was ever going to have:

| Site | What it holds |
| --- | --- |
| [[Assigning type on a move]] | extensions 3b and 4b, *The asymmetry* with the predicate table, an acceptance criterion |
| [[Level ladder and implied types]] | extension 2a — one sentence, and the link onward |
| [ADR 0009](../adrs/0009-the-type-rules-are-advisory.md) | a consequence: the intent, and that the dragged branch is not it |
| [ADR 0013](../adrs/0013-fix-the-type-vocabulary-at-six-names.md) | the parenthesis after `Declared pins, undeclared inherits.` |
| `src/domain/CLAUDE.md` | the principle, the exception, and where to record a decision |

A list is a weaker instrument than a check and goes stale the same way — it was here because
[[A claim in four notes and nothing to check it]] establishes that no check can reach a
claim, and a checklist beside the behaviour is what remains.

## Acceptance criteria

None. Recorded so the behaviour was known rather than rediscovered, and so a future change
to either branch would be made knowingly. The change that came was the deletion of both.

## What it cost to leave undocumented

The claim *"an unknown custom type is never rewritten"* appeared in **four** notes —
[[Assigning type on a move]], [[Level ladder and implied types]], and ADRs 0009 and 0013 —
and review found each one separately, in four rounds, because fixing the file in front of
you does not find the sentence elsewhere. Nothing mechanical connects a decision record to
a use case; see [[A claim in four notes and nothing to check it]].
