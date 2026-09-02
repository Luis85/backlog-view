---
type: Task
order: 10
parent: "[[Joining a release dates the work]]"
status: Done
priority: P2
area: storage
created: 2026-09-02
closed: 2026-09-02
source: decomposition of [[Joining a release dates the work]], 2026-09-02
files:
  - src/domain/writePlan.ts
  - src/view/interactions/labels.ts
  - src/view/host.ts
  - src/view/cardMoves.ts
  - src/storage/frontmatter.ts
  - src/storage/writeKeys.ts
  - test/domain/releaseWrites.test.ts
  - test/storage/releaseWrite.test.ts
  - test/storage/restore.test.ts
  - test/storage/dependsOnRestore.test.ts
  - test/storage/liveTypeKeys.test.ts
  - CHANGELOG.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Dates ride the release join

## Evidence

[[Joining a release dates the work]] is the whole of this task's brief, and it is **one**
task rather than two because the halves cannot ship apart. The planner alone leaves the
guarantee broken — `applyAxis` overwrites what the plan asked it to preserve. The writer
alone is a flag nothing sets, which `npm run analyze` correctly calls dead code. Neither
half delivers anything; the pair delivers the use case.

`computeReleaseWrites` today plans the membership link and nothing beside it, which
[[Setting an item's release]] records as the difference from
[[An iteration's timeframe schedules its items]]. The consequence is the one the PBI is
about: an item committed to a release draws no bar on the dated axis.

**Two review rounds on the PBI (Codex, PR #242) found four defects in the specification
before a line was written, and every one of them was the same mistake** — a rule stated at
the planner that only the writer can keep. That is the shape to hold on to while building
this: the planner knows two values and nothing else.

## Why it matters

An item committed to a release draws no bar on the dated axis, so the release's scope is
invisible on the one screen that shows time. Committing work to a version today means
opening the item and typing two dates.

## Approach

**The planner carries. It decides nothing.**

`computeReleaseWrites` takes `today` as an argument — `src/domain/writePlan.ts` is pure
domain and reads no clock, the way `promptCreateItem` and `renderRoadmap` already pass
`todayCivil()` in from their callers. On a join it carries **both candidates, unfiltered**:
the release's own date, off `BacklogItem.releaseDate` (already read and populated — see
`readReleaseDate` in `src/domain/readItems.ts`), and today. It filters neither against the
captured item, because an end the planner drops is an end the writer cannot reinstate.

Both ride the **same** `ItemWrite` as the link, as an `AxisWrite`, for
`computeIterationWrites`' own reason: two records naming one file capture two inverses, and
an undo could then return the link and keep the dates.

**The write decides, against the note as it stands.** The `AxisWrite` gains a fill-only
flag, answered in `plannedAxis`/`suppressedAxis` (`src/storage/writeKeys.ts`) — **not inside
`applyAxis`**, which receives the entries already decided and keeps only the `sameCivil` skip
it always made. Three live questions per end:

- Does the note still hold that end? Skip it if so.
- Would writing it reverse the span against the end that stands? Skip it if so — in both
  directions.

**Decide BOTH ends from one snapshot, taken before any axis write lands.** This is the
trap, and the rule reads correct while the obvious implementation inverts it:
`AXIS_FIELDS` is `['horizon', 'start', 'target']` (`src/domain/optionalProperties.ts`), so a
check written inside `applyAxis`'s existing loop reads, at `target`, a start it wrote itself
one iteration earlier. An undated item joining a release whose date has passed then gets
today as a start — nothing stood to forbid it — and the due is suppressed against that new
start. That is the precise inverse of extension 4b, which wants the past due copied and no
start invented. Read both live values first, decide both, then write. Its test is an
initially empty item joining a past release: due copied, no start. Found by review
(Codex, PR #242).
- Is this pick still a join? The membership must be read **before** `applyLinks` overwrites
  it, the way `leaving` already captures the departing state — and read with the **same
  semantics the planner uses**, which is the part an implementer will otherwise get wrong.

  `computeReleaseWrites` asks `!item.releaseMultiple && item.releaseEntry?.file?.path ===
  target.file.path`: **resolved path, and cardinality beside it.** A raw-text comparison
  fails in both directions, and its own comment says why one of them was a shipped defect. An
  alias or a differently-spelled relative link to the picked release reads as a non-match, so
  the write calls it a join and tops up the dates on a note that was already a member. A
  `release: [R, E]` whose first entry IS the target reads as a match, so the write calls it a
  no-op — but that note must still be repaired to the one value a membership is, and the
  repair IS the join. Its race test must drive both shapes, not only the plain one, or an
  implementation passes the stated test while violating 2a. Found by review (Codex, PR #242).

**The flag is never `applyAxis`'s default.** That function is shared with the horizon drag,
the timeline resize and the iteration join, and the iteration join overwrites always by
decision ([[An iteration's timeframe schedules its items]] 2a). It is not an `AxisField`
either, so `axisEntries` in `src/storage/writeKeys.ts` neither emits it as an entry nor lets
it disturb `touchedKeys`.

**Two callers, three lines.** `addReleaseItems` in `src/view/interactions/labels.ts` and
`performReleaseMove` (`src/view/host.ts`, implemented in `src/view/cardMoves.ts`) pass
`todayCivil()`. `labels.ts` also carries a comment saying this plan has ONE component; that
stops being true, while the checkmark rule it justifies stays true, because an unchanged
link still plans nothing.

Nothing is drawn, no sentence is added, no stylesheet partial is touched, and
`move.releaseAnnounced` is left alone: the view cannot know whether the dates landed, and a
sentence claiming a schedule it cannot verify is worse than one that only claims the
membership.

[ADR 0033](../adrs/0033-a-stale-rule-is-decided-at-the-writer.md) is the decision this task
carries out, and it stays at `status: Proposed` when this task lands. **Do not flip it.**
This note said the opposite for one commit, which was a contradiction with the ADR's own
`## Consequences`: that record names the reverse membership race as a case this task does
NOT fix, assigning it to [[A pick compared against the model reads as a no-op]], so a named
example still violates the decision after this work is done. `docs/adrs/README.md` reserves
`Accepted` for a record the code follows, and it would not yet. The increment that moves the
last stale check is the one that accepts the ADR (Codex, PR #242).

`CHANGELOG.md` gains its `[Unreleased]` entry in the same pull request, per `RELEASING.md`.

## Acceptance criteria

The PBI's acceptance criteria are the list. Three of them cannot be reached from the
planner and belong at the writer, each as plan-then-edit-then-apply:

- A due typed onto the note after the row was drawn stands, and no start lands after it.
- A captured past due removed before the batch lands still gets today as a start — the end
  a pre-filtering planner would have dropped.
- A membership joined by another view before the batch lands leaves the dates unwritten.

Two more are category invariants and are asked of the thing itself rather than of the paths
someone thought of: **no plan this module produces ever names a state key**, asked of the
planner; and **the horizon drag, the timeline resize and the iteration join still
overwrite**, each driven against a note already holding the end being written, so a
fill-only default leaking into `applyAxis` fails in the suite rather than in a vault.

**The files, named rather than left to search.** The planner's assertions go in
`test/domain/releaseWrites.test.ts` (node, 112 effective lines, which already owns this
planner). The three races and the two overwriting-path invariants go in
`test/storage/releaseWrite.test.ts` (node, 52 effective lines — the emptiest storage file
this work touches, and the one already about this write). The one-batch undo goes in
`test/storage/restore.test.ts`, which already holds that shape for every other write.

**The first failing test is the planner's**, and it is the cheapest red: drive
`computeReleaseWrites` with a fixed `today` against an item whose captured dates would
suppress each end in turn, and assert the batch carries **both** candidates anyway. It fails
today because the function takes no `today` and carries no axis at all.

**The two invariants are watched failing**, per root `CLAUDE.md`: revert the fix, run,
see red, restore. They are the state-key assertion on the planner, and the three overwriting
paths against `applyAxis`'s default.

**Coverage.** `vitest.config.mts` carries `statements: 99.04`, `branches: 95.72`,
`functions: 99.92`, `lines: 99.78`. Do not hand-edit them to a measurement:
`scripts/coverage-floors.mjs` runs after the coverage run and answers how many covered units
the tree can lose before a floor fails, and a floor pinned to what one run measured fails on
the next — the register has that open as
[[The coverage figure is not reproducible to a hundredth]]. Raise a floor only where that
script reports the headroom to do it, and below the one-fewer figure.

What none of it reaches is Obsidian itself — the real `processFrontMatter`, the note's own
date spelling, and the redraw — which is
[[Making a release, and putting work in one]]'s to answer.

## Risks

**`src/storage/frontmatter.ts` has almost no room left.** Measured 2026-09-02 at roughly 393
effective lines against `max-lines`' cap of 400 (`skipBlankLines`, `skipComments`), so the
live check almost certainly will not fit and lint will refuse it. **Measure before writing,
and plan the extraction as step one rather than meeting it as a surprise.** The natural cut
is the live-decision helper itself — the three questions above — into a module `storage/`
already reaches, beside `writeKeys.ts`. `src/domain/writePlan.ts` is at roughly
326 and has room; `src/view/interactions/labels.ts` at 153 does too.

**The live join check is where a correct-looking implementation goes wrong.** The Approach
above states both directions and the planner's own predicate; the risk is an implementer
reading only the first sentence of that bullet and writing a raw-text compare that passes a
plain-shaped race test.

**A `Test case` is not this task's to close.** [[Making a release, and putting work in one]]
is a walk in a live vault, and nothing in this run can perform it.

## Outcome

Done, in the two halves the note said could not ship apart.

**The planner.** `computeReleaseWrites` takes `today` as a fourth argument and, on a join,
carries an `AxisWrite` beside the link: `start` is today, `target` is the release's own
`releaseDate` where it states a readable one, and the write is marked `fillOnly`. It filters
neither against the captured item and gates neither on a key — `axisEntries` already drops an
unconfigured one, which is 4d kept where the note is. `addReleaseItems` reads the clock once
for the whole menu and `performReleaseMove` per move.

**The writer.** `plannedAxis` (`src/storage/writeKeys.ts`) answers which axis entries a write
actually lands, and `applyAxis` now takes that list rather than the write. For everything but
a release join it is every entry the write names, which is what keeps overwriting the default
for the horizon drag, the timeline resize and the iteration join. For a fill-only write it
asks the three live questions from ONE snapshot taken in `applyInto` before `applyLinks` runs:
is this pick still a join (resolved path plus cardinality, the planner's own semantics), does
the note still hold that end (a readable date, so a backfilled `start: ''` is filled), and
would writing it reverse the span against the end that stands (both directions, the standing
due being the item's own where 3a kept it and the release's otherwise).

**The extraction the Risks called for.** `frontmatter.ts` measured 393 effective lines against
the 400 cap before a line was written, so the live decision went into `writeKeys.ts` — a module
`storage/` already reaches, already named in the PBI's `## Where it lives`, and already the
answer to "which keys does this write touch". Handing `applyAxis` the decided entries rather
than a skip set is what paid for itself: `frontmatter.ts` came out at **394**, one line up on
where it started. `writeKeys.ts` is 97.

`test/storage/restore.test.ts` was at 447 of its own 450-line budget, so the one-batch undo
went in only after `describe('dependency inverses')` moved to
`test/storage/dependsOnRestore.test.ts` — its own subject, the identity rule
`src/storage/CLAUDE.md` gives a section to. 261 and 229 effective lines.

**Watched failing, both.** Making the planner name a state reddened two of the four
state-key cases (the join and the release-to-release move; the removal and the agreeing
re-pick plan nothing, correctly). Turning the fill-only test in `suppressedAxis` into
`if (!write.axis)` — the flag as the writer's default — reddened exactly the three
overwriting paths and nothing else.

**Not done, and not this task's.** ADR 0033 stays `Proposed`;
[[Making a release, and putting work in one]] stays open, since nothing here can walk a live
vault; and 5d's silent departure is still [[The outcome report was built from one sentence]]'s.
