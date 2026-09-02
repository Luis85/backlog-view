---
type: Task
order: 10
parent: "[[Joining a release dates the work]]"
status: Open
priority: P2
area: storage
created: 2026-09-02
source: decomposition of [[Joining a release dates the work]], 2026-09-02
files:
  - src/domain/writePlan.ts
  - src/view/interactions/labels.ts
  - src/view/host.ts
  - src/view/cardMoves.ts
  - src/storage/frontmatter.ts
  - src/storage/writeKeys.ts
  - test/domain/releaseWrites.test.ts
  - test/storage/restore.test.ts
  - test/view/contextRowWrites.test.ts
  - test/view/contextCardWrites.test.ts
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

## What to do

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
flag, honoured in `applyAxis` beside the `sameCivil` skip already there. Three live
questions per end:

- Does the note still hold that end? Skip it if so.
- Would writing it reverse the span against the end that stands? Skip it if so — in both
  directions.
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
carries out, and it stands at `status: Proposed` because `docs/adrs/README.md` reserves
`Accepted` for a record the code follows. **Flipping it to `Accepted` is part of this task's
definition of done**, in the same commit as the work — nothing else will, and an ADR left
`Proposed` after its own implementation lands understates the rule that now binds.

`CHANGELOG.md` gains its `[Unreleased]` entry in the same pull request, per `RELEASING.md`.

## How it is checked

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

Coverage floors in `vitest.config.mts` only ever go up, and `npm run check` is the gate.
What none of it reaches is Obsidian itself — the real `processFrontMatter`, the note's own
date spelling, and the redraw — which is
[[Making a release, and putting work in one]]'s to answer.

## Outcome
