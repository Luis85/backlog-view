---
type: Bug
order: 100
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: process
created: 2026-08-02
closed: 2026-08-02
source: found while updating [[The horizon board]] for its first write feature
files:
  - docs/requirements/A third projection.md
  - docs/requirements/The horizon board.md
  - docs/requirements/The timeline.md
  - docs/requirements/Scheduling work.md
  - docs/requirements/Hierarchy on the roadmap.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Five features grew back their use-case index

## What happened

Every `Feature` note carried a hand-written `## Use cases` list until 2026-08-01, when
one was found drifted, gated for eight rounds of hardening, and then **removed
entirely** — index, gate and all — because it was a second copy of a fact `parent:`
already carries exactly ([[Check that a feature lists its use cases]]).

The five [[Product Roadmap]] features landed with the section back: `A third
projection`, `The horizon board`, `The timeline`, `Scheduling work` and `Hierarchy on
the roadmap`. Seventeen of twenty-two features had no such section; those five did.

The mechanism is the one [[Two spec branches predate the use-case gate]] describes,
in its quietest form. The roadmap epic was drafted against a base where the index was
still the house style, and `docs-check.mjs` no longer had anything to say about it —
the removal took the gate with it, deliberately, since the whole argument was that the
fact needs no second copy. So there was nothing to fail: the notes were consistent with
the convention their author had in front of them, and inconsistent with the one on
`main`. Green on both branches, wrong on the merge, exactly as that note predicts.

Nothing had gone stale yet. It would have: `The horizon board`'s index and its two
children were edited in the same commit here, which is the only reason the drift was
noticed rather than introduced.

## Fix

The section is gone from all five, and what one of them wanted to say — that a feature
is built except for a criterion no child can exercise alone — is now prose in the note
rather than an annotation on a list. Nothing else changed: Obsidian's backlinks pane
and `Product Backlog.base` read `parent:` directly, and the register's own view is the
index.

There is no test to add, and that is the finding rather than an omission. The check
that would have caught this was **deleted on purpose**, and re-adding it would re-add
the second copy it was deleted for. What is left is review — which is where the removal
note already put it.

## Lesson

**Removing a convention is a change that needs a gate as much as adding one does.** The
eight rounds went into making the index checkable; none went into making its *absence*
checkable, so the convention reverted the first time a branch drafted before the
removal landed after it. A rule enforced by a check fails loudly, a rule enforced by
review fails on the day the reviewer has not read the note that removed it — and a rule
that used to have a check is the worst of the three, because everyone remembers it as
enforced.

The narrow lesson for this register: `docs/README.md` says what a Feature holds, and it
says a Feature does **not** keep a list of its use cases. A note kind's shape is worth
re-reading before writing five of them, and that paragraph is where the answer was the
whole time.
