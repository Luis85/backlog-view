---
type: Epic
order: 201.25
status: Open
area: product
created: 2026-08-08
source: user request
started: ""
finished: ""
risk: ""
assignee: Alex
start: ""
due: ""
---

# Test Management

**A catalogue of end-to-end tests, kept as work items beside the work they check.** A
`Test suite` holds `Test case`s, a case carries its instructions as ordinary markdown —
preconditions, steps, expected result — and a user-named property on the case names the
backlog item it covers. The tests are their own list, not a branch of the plan, and the
link between the two is a property rather than a parent.

**Outcome** — Someone who has never used the product can open a suite, walk its cases
from the top, and know at each step what should have happened. Someone looking at a PBI
can see whether anything checks it, and a release can be walked rather than remembered.

## Why the tests are not children of the work they test

The obvious shape — a `Test case` hanging under the PBI it verifies — is refused, and
the reason is that it makes one relationship do two jobs. `parent` is the tree: it
decides level, rank, order, rollup, focus and what a drag means. A test that hangs from a
PBI is *inside* that PBI's progress, competes with its Tasks for order, disappears when
the PBI's subtree is collapsed, and moves when the PBI moves. None of that is what a test
is: a suite is walked in its own order, and one case routinely covers work that lives in
three different places.

So the tests get a ladder of their own, rooted at the top level, and coverage is an edge
beside both trees — the shape [[Dependencies as a property]] settled on 2026-08-08 for
the same reason, in the same words: *it is one more property, not a second graph.* What
is different here is only the direction the edge points and what reads it.

This is also what makes the register itself the worked example. [[Smoke test the tree]]
and its two siblings are already test management written as prose — test scripts wearing
use-case frontmatter, because there was no test type to give them. This epic is the type
they should have had.

## What this epic will not do

**It records no results.** No pass, no fail, no run history, no date of last execution. A
test case says what to do and what should happen; whether it passed on Tuesday is a fact
about a run, and a run is a second item family this epic deliberately does not build. The
regression story here is the one the smoke test catalog already relies on: a
checklist that exists and is walked catches what an unwritten one cannot.

**It runs nothing.** These are manual end-to-end tests from the user's perspective. The
plugin has no way to drive an application and no business acquiring one.

**It parses no note bodies.** The instructions are markdown and stay markdown; the model
reads frontmatter, as it does for every other item. A case is read by opening it.

## The blocker it inherits

Two new declared types need two badge slots and there are none. `ALL_TYPES` holds **nine**
declared types against Obsidian's **eight** chromatic families, so the Ladder Rule has
already run out and been bent once: `styles/badges.css` puts Idea and Task on the same
yellow, deliberately and with the pairing written down, and `Deliverable` wears green.
Tests are the tenth and eleventh, and the question is whether each new type takes its own
sharing decision — which is how Idea and Deliverable both reached for green on branches
that could not see each other — or whether one rule covers them.
[[A badge when the palette is full]] is where that is answered, before either type ships,
since a type with no badge is a row the reader cannot classify. What that PBI inherits is a
**decision**, not a recount: the issue's figures predated `Deliverable` and were corrected
against the CSS while this epic was being written, which is the only reason the paragraph
above can state them.

## Features

- [[A catalog of tests]] — the two types, their badge, and how a case gets written.
- [[Test coverage]] — the property that names what a test checks, and the gap it makes
  visible.
- [[The test catalog projection]] — where the tests are shown, and how the plan stays free
  of them.
