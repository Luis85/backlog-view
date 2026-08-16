---
type: PBI
parent: "[[Moving cards]]"
order: 40
status: Done
priority: P2
created: 2026-08-01
closed: 2026-08-02
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
  - src/domain/noteFields.ts
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - test/domain/stamps.test.ts
  - test/view/stamps.test.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: 2026-08-09
risk: ""
assignee: ""
---

# Stamp when work starts and finishes

**As** someone who will eventually want to know how long things take, **I want** the
board to record when an item started and finished as it happens, **so that** the
question is answerable later — because a transition nobody stamped is gone.

The one thing a board cannot retrofit is history. Cycle time, ageing work and the
Kanban Guide's service level expectation all read two facts — when an item started and
when it finished — and mainstream trackers recover them from an item history that notes
do not have. A state change that is not stamped at write time is unrecoverable. This
register already stamps `closed:` by hand on every note it finishes; the board can do
it on the transition, into properties the user names.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | A state write that crosses into a started state, or across the done boundary |
| **Preconditions** | The view options name a started-date or finished-date property |
| **Guarantee** | A stamp is never a second write. It rides the batch that caused it, so one undo takes back the state and its dates together, and a stamp can never overwrite another key the plugin owns. |

**Main flow**

1. The user names a started-date property, a finished-date property, and which states
   count as started.
2. A card moves into a started state; the started date is written in the same batch.
3. A card moves from not-done into done; the finished date is written in the same batch.
4. Undo takes the state and its dates back together, because they were one batch.

**Extensions**

- **1a — nothing is configured.** Nothing is written. Every part of this is opt-in, and an
  unconfigured property is not a property with a default name.
- **2a — the item enters a started state it has been in before.** The started date is
  written once and kept: the earliest start survives rework, or the measure counts the
  last restart rather than the age of the work.
- **3a — the move is done to done** (re-labelling Done as Dropped). The finished date is
  unchanged. That is not a new finish, and shifting it forward would rewrite the item's
  history to say the work took longer than it did.
- **3b — the item leaves done.** The finished date is removed, so a reopened item never
  claims a finish it no longer has.
- **4a — a stamp property names a key the plugin already owns.** It is refused by the same
  key-collision checks that gate every other write: a stamp must never overwrite the
  parent, order, type, state or tags key.
- **4b — the user expects a chart.** None ships with this. The stamps are *capture*, which
  keeps the flow measures possible rather than promising them; a metric drawn from data
  nobody has been recording is the failure this PBI exists to avoid.

## Acceptance criteria

- The view options may name a started-date and a finished-date property, and which
  states count as started; nothing configured, nothing written.
- Entering a started state writes the started date once — the earliest start survives
  rework.
- The finished date is written only when a change crosses from not-done into done, and
  kept unchanged across done-to-done moves — re-labelling Done as Dropped is not a new
  finish, and must not shift the item's history forward. Leaving done removes it, so a
  reopened item never claims a finish it no longer has.
- Stamps ride the same batch as the state write: one undo takes back the state and its
  dates together.
- The stamp properties join the key-collision checks that gate every write, so a stamp
  can never overwrite the parent, order, type, state or tags key.
- No chart ships with this: the stamps are capture, so the flow metrics stay possible
  rather than promised.

## Where it lives

**Built.** Three options in the Progress group of `src/domain/viewOptions.ts` —
`startedStates`, `startedDateProperty` and `finishedDateProperty` — resolve into
`startedStates`, `startedDateKey` and `finishedDateKey` in `src/domain/settings.ts`,
which also gained `isStartedValue` and `isDoneValue` (a state VALUE is what the stamps
ask about, and no item holds the one being written yet). Both stamp keys join
`configProblems`, and the resolved `tagsKey` joins it with them: it cannot collide with
the four it already yields to, so the only collision it can now report is a stamp aimed
at the tags property — the case the yielding rule never covered.

The decision is `computeStateWrites` in `src/domain/writePlan.ts`, which replaced
`computeStateDropWrites`: every input that changes a state now plans through it — a
drop, Alt+arrow, the board's Set state and the TREE's Set state — because a stamp that
rode only some of them would record a history whose holes depended on which projection
the user happened to be looking at. It stays pure by taking the date as an argument;
the single clock read is `todayStamp` in `src/domain/noteFields.ts`, beside
`normalizeTag` because both are the write-side format of a property value, and built
from LOCAL date parts — `toISOString` would stamp an evening transition as tomorrow for
everyone west of Greenwich.

The writes land in `src/storage/frontmatter.ts` as fields of the state's own write, in
the same `processFrontMatter` call, so one undo takes the state and its dates back
together. **Both** stamp decisions are made there rather than in the plan, against the
live note: the row that planned a write can be a refresh behind it, which is the same
reason tags travel as a delta. Write-once for the start is one half; the other is the
done boundary — the plan carries `{date, toDone}` and the writer compares it with the
state the note is actually leaving, so crossing in stamps, crossing out clears, and
done-to-done leaves it alone. Judging that from the model's idea of the old state left
a note already finished, moved to a not-done state, still claiming its finish.

Driven by `test/domain/stamps.test.ts` (the transition rules, one test per state pair),
the stamp block in `test/storage/frontmatter.test.ts` (write-once, removal, the shared
inverse) and `test/view/stamps.test.ts`, which drives all four real inputs — including
the tree's Set state, the one path that does not go through the board.
