---
type: Issue
order: 40
parent: "[[The write gate]]"
status: Open
priority: P3
area: design
created: 2026-08-24
source: automated review of PR #201, verified at source 2026-08-24
files:
  - src/domain/releases.ts
  - src/domain/model.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A carrier reparented into the catalog keeps its release

## The limitation

`refusesLiveMembership` (`src/domain/releases.ts`) asks the vault about the TARGET of a
release membership and no longer about its CARRIER. Reparent a `Task` — or a note with no
`type` at all, the other row whose ladder is chained rather than named — under a `Test suite`
or a `Test case` between the moment `Set release` is picked and the moment the write lands,
and the membership is written onto a note that the rebuilt model puts in the test catalog.
`membershipTarget` then reports it as an unresolved membership, and `canSetRelease` refuses
the row, so no control the view draws offers to take the key off again.

A carrier RETYPED mid-flight is still refused: `mayHoldField(liveType, 'release', …)`, asked
through `refusesLiveType` (`src/storage/frontmatter.ts`), reads the note's own live type name
and covers a marker, another release and every catalog RUNG. Only the reparent is open, and
only for the two rows whose name does not decide their ladder.

## Why it is deliberate

A live walk up the carrier's parent chain shipped for this and was removed on 2026-08-24,
because it refused writes that were never stale. **Which ladder an item is on is a model
decision, and the vault cannot answer it.** `buildModel` assigns
`item.ladder = ladderFor(item.typeName, item.parent?.ladder ?? null)` — chained off the parent
**as loaded**. With `showOutsideParents` off, a returned `Task` naming a filtered-out
`Test suite` has no parent in the model at all, so it lands on the PLAN ladder, `inPlan`
passes and `canSetRelease` correctly offers the action. The live walk followed that excluded
parent straight through the metadata cache, classified the carrier on `TEST_LEVELS` and
refused the write — an action offered and then silently refused, in a configuration users run,
with nothing stale about it.

The writer cannot tell the two apart. It has the vault and nothing else, so it cannot
distinguish "this ancestor is excluded and the model ignored it" from "this ancestor is
loaded and the model chained off it". Making the walk agree would mean giving the write path
the Base's result set, which is a second idea of what a ladder is threaded through a boundary
that has none. Narrowing the guarantee to what the check can actually reach is this
repository's own rule, so the sentence was narrowed rather than the machinery widened.

## Impact

Narrower than the false refusal it replaces. It needs a reparent onto a catalog note in the
window between an open submenu and the pick landing — the same shape as
[[A stale release or iteration target can still be committed]], and rarer, since a reparent is
a drag rather than a property edit. Nothing is corrupted: the written link resolves, and the
state it leaves is one a hand-edit has always been able to produce, which is why
`membershipTarget` reports such a carrier rather than counting it. The cost is that the key is
unclearable from the menu while it sits there — repairable by moving the note back onto the
plan, or by editing the frontmatter.

## What would lift it

Nothing at this boundary. The question belongs where the result set is known: a refusal that
compared the plan's captured item against the REBUILT model — the same correlation
[[A pick compared against the model reads as a no-op]] wants and
`docs/issues/The outcome report was built from one sentence.md` records as unsolved here —
would answer the carrier and the target at once. Do not re-add a vault walk.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly rather than rediscovered.
