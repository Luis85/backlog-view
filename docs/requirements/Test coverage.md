---
type: Feature
parent: "[[Test Management]]"
order: 20
status: Open
created: 2026-08-08
source: user request
started: ""
finished: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: P3
iteration: ""
horizon: ""
---

# Test coverage

A user-named property on the test names the backlog items it covers. The test does the
naming, so adding coverage writes to the note the user is acting on and never to the one
they merely pointed at; the entries are read tolerantly and resolved against the same item
set `parent` resolves against; an entry that becomes no edge is marked and never repaired.
Read the other way round, the same edges answer the question the epic exists for: **which
work has nothing checking it.**

**Outcome** — A test states what it is for on its own note, that statement is reachable
from either end, and a PBI nobody wrote a test for is visible as such instead of being
discovered at release.

## Use cases

- [[Coverage as a property]] — the key, the tolerant read, and what a broken entry does.
- [[Linking a test to what it covers]] — the menu path that adds one and removes one.
- [[Untested work names itself]] — the count on the requirement row, and the gap it makes
  visible.

## Why this is the dependency shape again

[[Dependencies as a property]] answered every general question this feature would
otherwise re-open, eight days before it: a user-named optional key, unbound meaning the
feature is absent; a list read tolerantly, blanks and repeats collapsed; resolution
against the Base's results plus the ancestors the parent walk loaded, with **nothing
loaded to make an entry resolve**; damage marked in the model and never rewritten on disk;
✨ binding the key and backfilling nothing. All of that is restated here as inherited
rather than argued again, and where this feature differs from it, the difference is
stated at the point it occurs.

There are two such differences and they are worth naming up front. The first is
**direction**: a prerequisite list is read for the arrow it draws between two items on one
axis, while coverage is read once forward (a test says what it covers) and once backward
(a requirement counts the tests naming it). The backward read is new, and it is the only
reason [[The test catalog projection]] has to put both families in one result set.

The second is that a coverage edge **always starts on a test**. The property is read from
the test types and from nowhere else, so a work item can never declare coverage of another
work item — which is what keeps this from becoming a second hierarchy, since an edge any
item could declare about any other would eventually be used as one. The far end is not
restricted the same way: a test may name another test, which is legal, uncommon and
harmless, and [[Coverage as a property]] says exactly what follows from allowing it.

## What this feature will not do

**It never writes to the item being covered.** The count on a requirement row is derived
at read time from the tests that name it. Nothing is stamped onto the PBI, which is what
keeps a test's existence from being a fact two notes can disagree about.

**It rolls nothing up.** A Feature does not acquire its PBIs' coverage. A parent shown as
covered because one child is would be the most confident wrong number this view could
report — and the direction that matters, an uncovered child, is exactly what the rollup
would hide.

**It refuses nothing.** No write is blocked because coverage is missing, no test is
required before a PBI may be marked done. The rules here decide what is *shown*, never
what is *allowed*, which is how every advisory rule in this plugin already behaves.
