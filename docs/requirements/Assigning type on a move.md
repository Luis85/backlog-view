---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 40
status: Done
---

# Assigning type on a move

**As** someone who wants the ladder enforced rather than suggested, **I want** a moved item
and its subtree to take the types their new position implies, **so that** dragging a PBI
under an Epic makes it a Feature without my editing every note beneath it — and **as**
everyone else, **I want** that off by default, because re-typing a subtree is a strong
thing to do on a drag.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner who has opted in |
| **Trigger** | Any move that changes an item's **parent** |
| **Preconditions** | "Assign item type when moving" is on — it is **off** by default |
| **Guarantee** | A reorder among siblings never re-types anything. Only a change of parent can, because only that changes what the position means. |

**Main flow**

1. The item is dropped under a new parent.
2. Its new rung is the one below that parent's, clamped at the deepest.
3. If its `type` does not already say so, the new level is written.
4. The walk descends the subtree, each child taking the rung below its parent's **new**
   level, writing only those that disagree.
5. The whole cascade is one batch, one refresh and one undo.

**Extensions**

- **1a — the move only reorders among siblings.** No type write at all.
- **2a — the new parent is the top level.** The item becomes an `Epic`.
- **3a — the item is an `Issue` or a `Bug`.** Left alone: its rank is a property of the
  type ([[Types beside the ladder]]).
- **3b — the item's type is not on the ladder at all** (`Spike`, `Chore`). It **is**
  rewritten to the level its new position implies. Only declared extra types are exempt
  here — which is not what happens to the same type one level down. See *The asymmetry*
  below.
- **4a — a child is an extra type.** Also left alone — but the walk descends from **its**
  pinned rank rather than the position it inherited. Taking the positional rung here
  rewrote a nested Bug's Tasks into PBIs: the item correctly untouched, its children
  silently corrupted ([[Nested extra type lost its pinned rank]]).
- **4b — a child's type is not on the ladder at all** (`Spike`, `Chore`). Left alone, and
  it still occupies its rung, so its own children carry on from there rather than
  restarting. This matches what the level maths does when it renders, so plan and model
  cannot disagree.
- **4c — a child came from outside the Base's filter.** The cascade **stops** and skips
  that whole branch. It may not be written to, and re-typing only the levels beneath it
  would leave a worse ladder than leaving the branch alone.

**Guarantees**

- Levels chain down the **parent's** new level, never down visual depth. That is the same
  walk the model runs once the writes land — and it holds under focus mode, where depth is
  re-rooted and would otherwise produce a plan that disagrees with the tree it creates.

## The asymmetry

**An unrecognised custom type survives this cascade as a descendant and does not survive
it as the dragged item.** `Spike` nested inside a moved subtree is left alone; `Spike`
dropped somewhere becomes a `Feature`.

The two tests are different, and only one of them was written as a rule:

| | Retyped when — the `if` as written | So what is exempt |
| --- | --- | --- |
| The dragged item | `!isExtraType(dragged.typeName)` | declared extra types only |
| Any descendant | `child.typeName !== null && child.levelIndex !== -1` | extra types **and** unknown custom types |

There is a defensible reading — the dragged item is the one the user just acted on, so
taking its new position as an instruction is stronger there than three levels down. But
`src/domain/CLAUDE.md` states the principle without that qualification: *"custom types
outside the ladder are deliberate user data"*, and `Spike` is either that or it is not.

**Recorded, not resolved**, and now filed:
[[The dragged item is retyped, its descendants are not]] holds the argument, what would
settle it, and what leaving it undocumented already cost. This section stays because a use
case has to describe what the code does; the issue is where the open question lives, so the
behaviour is stated once and pointed at rather than restated in a fifth place.

## Acceptance criteria

- Off by default; with it off, no move writes a `type`.
- A reorder within a sibling group never re-types.
- Declared extra types are never re-typed, at any depth, and their subtrees rank from the
  pinned rung.
- An unrecognised custom **descendant** type is never re-typed, and its children continue
  the ladder from the rung it occupies. The **dragged item's** own unrecognised type is
  rewritten — see *The asymmetry*.
- The cascade never writes to a note the Base excluded, and stops rather than skipping past
  one.
- The whole cascade is a single undo.

## Where it lives

`src/domain/writePlan.ts` (`computeTypeChanges`) ·
`src/domain/itemTypes.ts` (`nextLevelIndex`, `childLevelIndex`, `EXTRA_TYPE_RANK`) ·
`src/domain/viewOptions.ts` (`autoAssignType` — the toggle, whose schema default must
match the runtime one, or the options UI lies about the behaviour).
Tests: `test/domain/writePlan.test.ts`, `test/domain/writePlanContextRows.test.ts`,
`test/domain/itemTypes.test.ts`.
Bugs it has produced: [[Nested extra type lost its pinned rank]].
