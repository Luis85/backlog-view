---
type: PBI
parent: "[[The horizon board for stakeholders]]"
order: 20
status: Done
priority: ""
created: 2026-10-18
source: user request
started: 2026-10-18
finished: 2026-10-18
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: ""
---

# Progress per bucket

**As** a stakeholder looking at the roadmap, **I want** each horizon to say how much of it is
done, **so that** I know what to expect from Now without counting cards.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading the horizon board |
| **Trigger** | A bucket that holds at least one result |
| **Preconditions** | A horizon property; a state property for anything to be done |
| **Guarantee** | Read-only. Counted over the plan, not the screen: the completed toggle never changes the numbers. Results only. |

**Main flow**

1. Under each bucket's header, a thin stacked bar — resolved, then in progress — and the
   text `2 of 5 done`.
2. The count is `iterationProgress` over the bucket's RESULT population, built with the
   same membership and focus as the board and with the completed toggle IGNORED.
3. The first bucket, the nearest horizon, carries an accent top border: it is where the
   priority is now.

**Extensions**

- **1a — the bar is decoration.** It is `aria-hidden`; the text carries the number. Its
  markup is the iteration header's (`renderProgressBar`), shared rather than copied.
- **1b — an empty bucket.** No progress line: `0 of 0 done` says nothing.
- **1c — a folded bucket.** No progress line; the fold says itself in the name and the
  count, as before.
- **2a — finished work hidden.** The bucket's own count drops and its progress does not:
  hiding finished work must not read as nothing finished.
- **2b — a context row in a bucket.** Not counted (`iterationProgress` skips it).
- **2c — in progress.** A state that is neither done nor one of `iterationOpenStates` —
  the iteration board's rule. With no open states declared, every unfinished state counts
  as in progress on the bar; the text compares done with the total and is unaffected.

## Acceptance criteria

- Each bucket with results says how much of it is done, results only.
- Hiding completed items leaves the done count unchanged.

**Checked by** `test/view/horizonHeader.test.ts` — "says how much of each bucket is done, results only"

**Checked by** `test/view/horizonHeader.test.ts` — "counts the finished work the completed toggle is hiding"

## Where it lives

`bucketProgress` and `renderBucketProgress` in `src/view/render/horizonHeader.ts` count
and draw it — `bucketProgress` builds the horizon roadmap a second time with
`isRowUndrawn` as its predicate — and `renderBucket` in `src/view/render/roadmap.ts`
places it. The bar is `renderProgressBar` in `src/view/render/iterationHeader.ts`; the
bucket's layout and the accent edge are in `styles/horizonHeader.css`.
