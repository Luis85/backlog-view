---
type: Bug
parent: "[[Types beside the ladder]]"
order: 30
status: Done
created: 2026-08-01
closed: 2026-08-01
area: domain
source: automated review of PR #22
files:
  - src/domain/model.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Parentless extra type dropped from the model

## What happened

`pruneOutsideHierarchy` asked whether a note's type was one of the configured *levels*, so a
parentless note typed `Bug` or `Issue` belonged to nothing and left the model — the note
vanishing from the view moments after being typed.

Both routes were reachable, and precisely because the type rules are advisory rather than
enforced: `Set type` offers the extra types on any row, and dragging one to the top level is
deliberately not refused.

## Fix

Hierarchy membership now reads every **declared** type, levels and extra types alike — an
extra type is a work item by the same argument a level is. A type the view knows nothing
about is still pruned, which is what the scope is for. `test/domain/itemTypes.test.ts`
("keeps a parentless extra type in the model") fails against the previous commit.

## Lesson

**Membership has to read the same vocabulary the rest of the model does.** Level checks
and "is this a work item" checks are two different questions, and coding the second as a
narrower version of the first drops exactly the notes that only the second question was
ever supposed to answer. See [[What counts as a work item]], the requirement this bug
turned into an explicit rule rather than an assumption inside one function.
