---
type: Issue
order: 10
parent: "[[Assigning type on a move]]"
status: Open
priority: P3
area: domain
created: 2026-08-01
source: 2026-08-01 review of PR #24, found four times in four files
files:
  - src/domain/writePlan.ts
---

# The dragged item is retyped, its descendants are not

## The asymmetry

With `autoType` on, an unknown custom type — `Spike`, `Chore`, anything outside the ladder
and outside the two extra types — is **preserved when it is a descendant of a move and
rewritten when it is the thing being moved**. Two predicates, twenty lines apart in
`computeTypeChanges`:

| | Exempt from retyping | The test |
| --- | --- | --- |
| The dragged item | Declared extra types only | `!isExtraType(dragged.typeName)` |
| Any descendant | Extra types **and** unknown customs | `child.typeName !== null && child.levelIndex !== -1` |

So a `Spike` nested inside a moved subtree survives; the same `Spike` dropped somewhere
becomes a `Feature`.

## Why this is filed rather than fixed

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

## What would settle it

A report, or a decision written down. If it is decided that the dragged item is genuinely
special, `src/domain/CLAUDE.md` should say so beside the principle it qualifies — the
exemption living only in a predicate is what let four documents claim the opposite.

## Acceptance criteria

None. Recorded so the behaviour is known rather than rediscovered, and so a future change
to either branch is made knowingly.

## What it cost to leave undocumented

The claim *"an unknown custom type is never rewritten"* appeared in **four** notes —
[[Assigning type on a move]], [[Level ladder and implied types]], and ADRs 0009 and 0013 —
and review found each one separately, in four rounds, because fixing the file in front of
you does not find the sentence elsewhere. Nothing mechanical connects a decision record to
a use case; see [[A claim in four notes and nothing to check it]].
