---
type: PBI
parent: "[[The weighted score]]"
order: 10
status: Open
created: 2026-08-17
source: written after the first increment shipped, to describe what was built
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Writing the total back with its stamp

**As** someone who filters and sorts a backlog in Bases, **I want** the business value to
be an ordinary property on the note, **so that** the tree, the board and the roadmap can
read it without any of them learning what a dimension is.

One derivation leaves this view, and it never leaves alone: the score, the recomputed
total and the stamp of the model that produced it are one batch. Everything else — the
confidence-adjusted value, the value-to-effort indicator, whether a stored total can still
be trusted — is recomputed on every read and written nowhere.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is estimating |
| **Trigger** | Picking or clearing a score on the panel |
| **Preconditions** | The model resolves without problems, and both the value property and the stamp property are bound |
| **Guarantee** | A total and its stamp move together or not at all. No path leaves a total with no stamp, a stamp with no total, or a total the model on screen did not produce without the reader being told which. |

**Main flow**

1. The user picks a point on a dimension row.
2. The view plans one batch: the score, the recomputed total, and the stamp — the model's
   fingerprint and the coverage it rests on.
3. The batch rides the gate and lands inside one `processFrontMatter` call per note, so
   the three keys land or fail together.
4. The panel and the table redraw: the new total, its coverage, and the currency word
   `Current`.
5. Undo restores all three keys.

**Extensions**

- **1a — the point already held is picked.** The plan is `null` and nothing is written.
  The undo slot keeps the batch it had: a batch that writes nothing must not cost the user
  their undo of the change before it.
- **2a — this was the last answered dimension and it is cleared.** The score, the total
  and the stamp are removed together. Renormalizing over an empty set is not a value, it
  is a zero pretending to be one.
- **2b — some dimensions are unanswered.** The answered weights are renormalized to 100
  and the total is computed from those alone, with the coverage recorded in the stamp. The
  two alternatives are refused for stated reasons: suppressing the total hides the normal
  case, and scoring an unanswered dimension at its lowest point asserts something nobody
  said.
- **2c — the value property or the stamp property is unbound.** Scoring is not offered at
  all. The pair is refused where the model is configured
  ([[Configuring the estimation model]] 4a), so this never becomes a partial write.
- **3a — the config has problems.** The gate blocks the batch, as it blocks every other
  write in this plugin.
- **3b — the target is a note the base excluded.** The whole batch is refused. This view's
  `outsideFilter` is answered from the built model, which holds one item per result.
- **3c — a data update arrives mid-batch.** It is deferred and flushed once the batch
  settles, and the extra refresh is skipped when the flush already drew that state. The
  pane is `aria-busy` while a batch applies.
- **4a — the model has moved since the total was written.** The currency word says which
  way: `Another model` when the fingerprint differs, `Needs re-estimation` when the
  fingerprint matches but the answered set or the stored total has drifted, `Hand-written`
  when there is no stamp at all. The fingerprint is checked first, so a changed weight
  never reads as a drifted note.
- **4b — the inputs are gone.** Scores deleted in Obsidian's own property editor leave the
  total an orphan. The view reports it as `Inputs gone` and removes it only through an
  explicit cleanup action — never on a render pass, never by a sweep. A gate that writes
  while nobody is looking is a worse failure than a stale number that says it is stale.
- **4c — the effort is zero or below.** The value-to-effort line is omitted rather than
  printed: zero divides to infinity and a negative one gives a nonsense ratio. The effort
  row's own out-of-range note is where the reader is told why.

## Acceptance criteria

- A pick writes exactly three keys — the score, the recomputed total, the stamp — in one
  batch, and undo restores all three.
- Picking the point already held plans nothing, and leaves the undo slot untouched.
- Clearing the only remaining answer removes score, total and stamp together.
- A partial profile renormalizes over the answered weights, and the stamp records the
  coverage; a full profile stamps full coverage.
- A weight change makes a `Current` total read `Another model` purely on refresh — no
  write, no sweep.
- An orphaned total is reported and is removed only by the cleanup action; the action
  writes nothing when the item is not orphaned, and claims no write when neither key is
  there to remove.
- The fingerprint moves with every input the arithmetic depends on — the dimension set,
  the weights, the property each reads, its range, its direction, the output range and the
  rubric sentences — and confidence, effort and complexity reach it nowhere, because they
  reach the total nowhere.
- **Not met yet** — no check drives a write at a path the base excluded. `applySafely` is
  driven directly in `test/view/estimation/scoring.test.ts`, but always at a result.

## Where it lives

`src/domain/weightedScore.ts` (`computeTotal`, `round2`, `modelFingerprint`, `stampValue`,
`parseStamp`, `currencyOf` — the arithmetic and the five currency words, independent of
any vault) · `src/domain/estimationWritePlan.ts` (`planScoreWrite`, `planScaleWrite`,
`planOrphanCleanup` — pure functions returning the batch a pick would write, or `null`
when it would write nothing, which is also the checkmark question) ·
`src/domain/estimationItems.ts` (`buildEstimationModel` — one item per result, one cache
read per note, its answers and what scoring it fresh says about the stored value) ·
`src/storage/propertyWrite.ts` (`applyPropertyWrites` — the only module that may write
these batches: plain key/value sets, `null` removing a key, one `processFrontMatter` per
note, never under a key no property names) · `src/view/writeGate.ts` (the gate and the
undo slot, plugin-wide — ADR 0030) · `src/view/estimation/estimationView.ts`
(`performOrphanCleanup`, and the view's own guard on it).

Tests: `test/domain/weightedScore.test.ts`, `test/storage/propertyWrite.test.ts`,
`test/view/estimation/scoring.test.ts`.
