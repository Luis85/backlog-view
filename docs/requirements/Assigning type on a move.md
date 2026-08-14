---
type: PBI
parent: "[[Reordering and reparenting]]"
order: 40
status: Done
closed: 2026-08-11
source: 2026-08-11 whole-branch review, plus the user's decision on it
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Assigning type on a move

**Withdrawn on 2026-08-11. The feature was removed rather than repaired, and nothing in
the plugin re-types a note on a move any more.** This note is kept because the register
keeps its closed work: it is now the record of a capability that existed, what it cost,
and why it went.

**Why it went.** The whole-branch review found the cascade's nested no-crossing guard
(`|| child.ladder !== destLadder`, in what was `computeTypeChanges`) with nothing checking
it: deleting that clause left all 1818 tests green, and losing it let a drag of an
unrelated `Epic` write a plan rung onto a hand-nested `Test suite`, taking the note out of
the test catalog. That was the one write path in the plugin that did not ask
`keepsProjection`. Asked whether to build the missing check, the user chose to remove the
whole feature instead — and removing the cascade removes the door rather than putting a
lock on it.

It also settles two things the register was carrying rather than deciding. The asymmetry
below — the dragged item retyped while its descendants were not — went away with the code
that produced it ([[The dragged item is retyped, its descendants are not]]). And ADR 0009
says the type rules are advisory; this was its single exception, off by default, so the
ADR is now true without one. The option is gone from the view options, and an
`autoAssignType` key left in an existing `.base` is read by nothing.

The want this note was written from, kept as it was written:

**As** someone who wants the ladder enforced rather than suggested, **I want** a moved item
and its subtree to take the types their new position implies, **so that** dragging a PBI
under an Epic makes it a Feature without my editing every note beneath it — and **as**
everyone else, **I want** that off by default, because re-typing a subtree is a strong
thing to do on a drag. Nothing serves it today; the ladder is advisory everywhere, and
`Set type` is the only thing that writes a type to a note that already has one.

## Use case

*What the feature did while it existed. Every row below is past tense on purpose: no
configuration produces any of it now.*

| | |
| --- | --- |
| **Actor** | Backlog owner who had opted in |
| **Trigger** | Any move that changed an item's **parent** |
| **Preconditions** | "Assign item type when moving" was on — it was **off** by default |
| **Guarantee** | A reorder among siblings never re-typed anything. Only a change of parent could, because only that changed what the position meant. |

**Main flow**

1. The item was dropped under a new parent.
2. Its new rung was the one below that parent's, clamped at the deepest.
3. If its `type` did not already say so, the new level was written.
4. The walk descended the subtree, each child taking the rung below its parent's **new**
   level, writing only those that disagreed.
5. The whole cascade was one batch, one refresh and one undo.

**Extensions**

- **1a — the move only reordered among siblings.** No type write at all.
- **2a — the new parent was the top level.** The item became an `Epic`.
- **3a — the item was an `Issue` or a `Bug`.** Left alone: its rank is a property of the
  type ([[Types beside the ladder]]).
- **3b — the item's type was not on the ladder at all** (`Spike`, `Chore`). It **was**
  rewritten to the level its new position implied — see *The asymmetry* below.
- **4a — a child was an extra type.** Also left alone, and the walk descended from **its**
  pinned rank rather than the position it inherited. Taking the positional rung here
  rewrote a nested Bug's Tasks into PBIs ([[Nested extra type lost its pinned rank]]).
- **4b — a child's type was not on the ladder at all.** Left alone, still occupying its
  rung, so its own children carried on from there.
- **4c — a child came from outside the Base's filter.** The cascade **stopped** and skipped
  that whole branch.
- **4d — a child was a marker** ([[Milestones as their own type]]). Left alone, and the
  walk **stopped** there exactly as 4c stopped: a marker supplies no rank to descend from.
- **4e — a child sat on the OTHER ladder.** Skipped whole, by the guard nothing checked.
  This is the extension the removal is about.

## The asymmetry

**An unrecognised custom type survived this cascade as a descendant and did not survive it
as the dragged item.** `Spike` nested inside a moved subtree was left alone; `Spike`
dropped somewhere became a `Feature`. Two tests, only one of them written as a rule:
the dragged item was exempted by `isExtraType` alone, a descendant by having no
`levelIndex` — which extra types and unknown custom names both lack.

Nobody chose that, and it is now moot: no move writes a type at any depth, so the two
tests that disagreed are both gone. [[The dragged item is retyped, its descendants are
not]] holds what the argument was.

## Acceptance criteria

*Superseded by the removal. What holds now is the single line at the bottom of the list.*

- ~~Off by default; with it off, no move writes a `type`.~~
- ~~A reorder within a sibling group never re-types.~~
- ~~Declared types that occupy no rung are never re-typed, at any depth.~~
- ~~An unrecognised custom **descendant** type is never re-typed.~~
- ~~The cascade never writes to a note the Base excluded, and stops rather than skipping
  past one.~~
- ~~The whole cascade is a single undo.~~
- **No move writes a `type`, in any configuration.** A drop, an indent, an outdent,
  Alt+arrow and both parent-link menu entries write the parent and the rank and nothing
  else; a type is what the note says or what `Set type` wrote. The rule that a move may not
  change which projection draws a row survives on its own, in `keepsProjection`, which
  withholds the move rather than rewriting anything.

## Where it lives

Nowhere. The planner, the option, its resolution and the toggle were deleted on
2026-08-11; `keepsTypeOnMove`, which existed only to let the generated README name the
types this cascade left alone, went with them. The surviving rule — that a move never
re-types — is checked in `test/domain/writePlan.test.ts` ("never plans a type: a drop
writes the parent and the rank and nothing else") and in `test/domain/testLadder.test.ts`
("a move crosses no ladder").

Bugs it produced while it existed: [[Nested extra type lost its pinned rank]].
