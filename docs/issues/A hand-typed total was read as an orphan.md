---
type: Issue
parent: "[[Writing the total back with its stamp]]"
order: 10
status: Done
area: domain
priority: P1
created: 2026-08-21
closed: 2026-08-21
source: code review of claude/plugin-refactor-brainstorm-av0s6j, finding B1 — read against the epic's own definition of done
files:
  - src/domain/weightedScore.ts
  - test/domain/weightedScore.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A hand-typed total was read as an orphan

## The guarantee that was not kept

[[Business value estimation]]'s definition of done states the vocabulary in one sentence:
"A different stamp means another model produced it; an absent one means it was written by
hand or by something else." The paragraph under it gives the orphan its own separate
meaning — "a total whose inputs are gone is reported, and removed by an action" — so the
two words answer two different questions, and only one of them offers to delete anything.

`currencyOf` (`src/domain/weightedScore.ts`) asked those questions in the wrong order:

```ts
if (item.storedTotal === null) return 'none';
if (item.result === null) return 'orphan';      // asked first
if (item.storedStamp === null) return 'handwritten';
```

`computeTotal` returns `null` when nothing is answered, so **"nobody has answered a
dimension" and "the answers behind this total were deleted" both arrive as
`result === null`** — and the stamp is the only thing that tells them apart. Asked in that
order, a note carrying a value typed straight into Obsidian's property editor, with no
dimension scores at all, reported `Inputs gone`; and because the panel offers the orphan
cleanup on exactly that currency, the view offered to **delete the number a person had
typed**. The written total is the one thing this view puts in the vault for other views to
read, so the action that removes it is the one that had to be unreachable by accident.

## How it stayed invisible

The suite was green, and the note beside the code claimed the fixed behaviour: the line
read `// A stored total whose inputs are gone is an orphan`, which is what the code would
have done had the stamp been asked first. [[A comment that states a rule is not a check]] is the general case; this is another instance of it.

The reachability check was made after the fix rather than assumed: **no fixture in
`test/domain/weightedScore.test.ts` encoded the broken combination at all.** Every orphan
case in it carried a stamp, so nothing in the suite ever asked the question the ordering
got wrong — the defect was not covered and passing, it was uncovered.

## The fix, and the check under it

The `storedStamp === null` test moves above the `result === null` test. Nothing else
changes, and the swap changes exactly **one** combination: a non-null `storedTotal` with
`storedStamp === null` and `result === null` now reads `handwritten` where it read
`orphan`. `orphan` now requires `storedStamp !== null && result === null` — which is what
its own comment always claimed.

**Checked by** `test/domain/weightedScore.test.ts` — "reads a total with no stamp and no answers as hand-written, never as an orphan"

**Checked by** `test/domain/weightedScore.test.ts` — "still reads a STAMPED total with no answers as an orphan"

The second is the half that matters as much as the first: an ordering fix is a swap, and a
swap is undone by a later reader who sees only one of the two tests. Both were watched
failing — the first against the old order, the second against a fix that went too far.

This ordering is now load-bearing for something else: `planRestamp`
(`src/domain/estimationWritePlan.ts`) refuses a `handwritten` total precisely because a
person's own number is not an automated action's to overwrite, and that refusal only ever
sees a hand-typed total because `currencyOf` asks the stamp first.

## Acceptance criteria

- ~~A stored total with no stamp reads `handwritten` whatever its inputs say.~~ Met.
- ~~`orphan` is reachable only from a **stamped** total whose inputs are gone, so the
  cleanup action can never be offered against a number nobody derived.~~ Met.
- ~~Both directions of the swap are asserted, so restoring the old order fails the
  suite.~~ Met, both watched failing.
