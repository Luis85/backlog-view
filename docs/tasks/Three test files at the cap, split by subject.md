---
type: Task
order: 320
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: tooling
created: 2026-09-02
closed: 2026-09-02
source: npx eslint test --rule max-lines, over the merged tree
files:
  - test/view/roadmapSchedule.test.ts
  - test/harness/harnessEstimation.test.ts
  - test/domain/backlogReadmeWrites.test.ts
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Three test files at the cap, split by subject

## Evidence

[[Close the holes the test typecheck cannot see through]] named ten test files sitting at
the 450-line budget and asked for the ones at EXACTLY 450 to be split by subject, with the
cap left alone — raising it is the move its own comment refuses.

**Re-measured on the merged tree before acting, and the count had moved**: three files were
at 450, not ten and not four. The earlier number was true of `b99bcc2` and the mount-helper
work ([[The mount injection was a cast nothing needed]]) had since taken lines out of six
suites.

**The instrument matters here more than usual.** `max-lines` is configured
`skipBlankLines: true, skipComments: true`, so `wc -l` answers a different question — it
reported 689 for a file the rule counts as 450. What was actually run is the rule itself,
with its own maximum lowered so that every file reports its count:

```bash
npx eslint test --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}' -f json
```

## Approach

Each split is one subject moved whole, never a line-count cut at a convenient brace.

- **`test/view/roadmapMoves.test.ts` → `roadmapSchedule.test.ts`.** The dated axis's own
  move. Everything left is a HORIZON — a bucket, the shelf, the value a card carries —
  and everything moved is a span of dates. They shared no fixture, no helper and no drop
  target, only the file.
- **`test/harness/harness.test.ts` → `harnessEstimation.test.ts`.** The estimation ENTRY
  (`mountEstimation.ts` / `estimation.ts`), which mounts a different view over a different
  fixture and shared nothing with the backlog entry's blocks but the `installObsidianDom()`
  call every jsdom file makes. The layout-fix block travels with it: `ruleBody` is its
  instrument and two of its three pins are on `styles/estimation.css`.
- **`test/domain/backlogReadme.test.ts` → `backlogReadmeWrites.test.ts`.** What the
  generated README says WRITES a note — the placement actions, the backfill, the stamps a
  state change leaves — apart from what it says the backlog IS. The two halves go wrong
  differently, which is what makes it a subject boundary rather than a convenient one: a
  sentence naming an action this view does not offer sends an outside editor to write by
  hand a key the view was going to write for them.

`readme()` and `SOURCE` are spelled again in the second readme file rather than lifted into
a helper — three lines of fixture construction, and no test/ duplication gate measures
them (`duplicates.ignoreDefaults` keeps fallow's clone detection on `src/`).

## Acceptance criteria

- Every test survives the move, counted per file rather than in the total: 65 → 48 + 17,
  37 → 29 + 8, 37 → 25 + 12.
- The cap is untouched at 450.
- `npm run check` passes whole: 294 files, 4615 tests, no coverage floor moved.

## Outcome

No file in `test/` is at the cap. The three that were are now 6 files, and nothing else
changed — no assertion was edited, so nothing here was watched failing and nothing needed
to be.

## What is left

**The headroom is thin and this note is dated the moment it is written.** The next file
down is `test/domain/model.test.ts` at 448, then `restore.test.ts` and
`viewStatePersistence.test.ts` at 447 — two lines of room between the first of them and the
same problem. Re-run the command above rather than quoting these; the fix when one arrives
is another subject split, not a wider budget.
