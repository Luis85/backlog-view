---
type: Feature
parent: "[[Test Management]]"
order: 10
status: Open
created: 2026-08-08
source: user request
---

# A catalog of tests

`Test suite` and `Test case` join the declared vocabulary as a two-rung ladder of their
own: a suite is a root by nature, a case hangs from a suite, and a case holds `Task`s the
way every other non-rung type does. They file into their own folders and they are created
from the same **+** every other type is created from, scoped to the projection that can
show them.

A new case also **opens**, alone among created items, because its body is the item and a
case whose steps are never written is not a test. Once [[Item Templates]] is built — it is
design today, `status: Open` — it opens onto the skeleton a test needs, preconditions,
numbered steps and expected result. Until then it opens empty, which is the smaller half
and the half worth having first.

**Outcome** — A vault can hold a test catalog that the view understands as a hierarchy:
suites in an order somebody chose, cases in an order somebody chose, and each case a
document a stranger could execute.

## Use cases

- [[Test suite and test case as a ladder of their own]] — the two types, their rungs,
  their roots, and what a move may and may not do to them.
- [[A badge when the palette is full]] — the tenth and eleventh types on an eight-hue
  palette that nine types already share, and the second axis that answers it.
- [[A template for a test case]] — the note that opens ready to write, and the instruction
  skeleton that arrives with [[Item Templates]] once that feature is built.

## Why this is a ladder and not two extra types

`Issue`, `Bug`, `Idea` and `Deliverable` are *extra types*: pinned at `EXTRA_TYPE_RANK`,
takeable under any rung above the deepest, children always `Task`
([[Types beside the ladder]]). That category cannot express what is wanted here, for the
same reason it could not express a fifth level: an extra type's children are `Task`s, full
stop, so a suite could not hold cases. A suite → case pair is a rung and the rung below
it, which is what a ladder is.

What it is *not* is a second ladder someone can drag items between. The two ladders never
touch: no drop re-types a work item into a test or a test into a work item, because the
type cascade only ever assigns the child of the rung an item landed under, and a test
suite is a root that nothing lands under.

## What this feature will not do

**It will not make `Test suite` a legal child of anything.** A suite is a root by nature,
like [[Milestones as their own type]]'s marker and unlike an `Epic`, which is a root by
position. A suite belonging to an epic would be the tree relationship this epic already
refused, arrived at from the other end.

**It will not invent a status vocabulary.** A test being drafted, ready or retired is
exactly what `status` already says on every note in this register, and a second word for
the same idea is a second thing to keep in sync.
