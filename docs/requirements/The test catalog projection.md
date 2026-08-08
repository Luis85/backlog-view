---
type: Feature
parent: "[[Test Management]]"
order: 30
status: Open
created: 2026-08-08
source: user request
---

# The test catalog projection

A toolbar toggle of its own, showing the test ladder and nothing else — and, in return,
the backlog tree, the board and the roadmap showing everything else and no tests. One
base returns both families; which projection you are in decides which one you are looking
at.

**Outcome** — The test catalog is a place you go to, not a thing that grows through the
middle of the plan. A backlog owner who never opens it sees no difference in the tree they
had before this epic.

## Use cases

- [[A projection for the tests]] — the toggle, the tree it draws, and what it says when
  there is nothing there yet.
- [[Tests stay out of the plan]] — the exclusion from the other three projections, and
  what a test looks like when it is only an ancestor.

## Why one base and not two

The tempting shape is a second `.base` file filtered to the test types, and it fails on
one fact: **a Bases view only ever sees its own result set.** [[Dependencies as a
property]] settled that nothing is loaded to make a link resolve, and the reasoning
applies unchanged here — a coverage count on a PBI row can only be computed from tests the
view was handed. Two bases means the requirements view never sees a test, so
[[Untested work names itself]] cannot exist at all, and the epic loses the half that
answers "catch regression".

So both families arrive together and the projections divide them. That is not a new
mechanism either: [[A Deliverables board]] already does exactly this, with the same
justification and the same edge case — a `Deliverable` is excluded from the requirements
board's cards, its count and its columns, while still surfacing there as a context row
when a visible descendant needs a parent to hang from.

## What this feature will not do

**It is not a board and not a roadmap.** A test catalog is a tree: suites in order, cases
in order under them. There are no columns to put a case in, because this epic records no
results, and no dates to draw it on. If a run ever becomes an item, that is the increment
that earns a second projection here — not this one.

**It adds no filter of its own.** The quick filter, the focus level and the collapse state
behave as they already do; what changes is which items are in the projection to be
filtered. Whether a focus level means anything on a two-rung ladder is
[[A projection for the tests]]' question, answered there rather than assumed here.
