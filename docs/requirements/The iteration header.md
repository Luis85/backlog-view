---
type: PBI
parent: "[[The iteration board for the daily]]"
order: 10
status: Done
priority: ""
created: 2026-10-18
source: user request
started: ""
finished: 2026-10-18
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: ""
---

# The iteration header

**As** a team at its daily stand-up, **I want** the iteration board to open with the
sprint's name, its goal, where its timebox stands and how far its work has got, **so that**
the first questions of the meeting are answered before anybody asks them.

The header replaces the one goal line [[A board scoped to one iteration]] drew (its
extension 6a). The name and the goal become the largest text on the board, and two facts
join them that the board could not say before: which day of the sprint it is, and how many
of its cards are resolved.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner, or the team at a stand-up |
| **Trigger** | Opening the board scoped to one iteration |
| **Preconditions** | Board mode is on and the scope resolves to an `Iteration` note in the model |
| **Guarantee** | The header writes nothing and adds no control that edits the iteration. Its counts are this sprint's RESULT cards — the population and the bucket reading the columns use — so a context row never moves a number. |

**Main flow**

1. The board draws a header band above the shelf and the columns: a small uppercase
   `Iteration` kicker, then the iteration note's title as an `h2`.
2. If the iteration carries a goal, a small accent `Goal` label draws, then the goal as
   large text. It is text and nothing else.
3. A timebox line reads the iteration's own start and target against today: the span, the
   day of the sprint (`Day 6 of 14`), and the days left (`8 days left`). Both ends count, so
   a one-day sprint is `Day 1 of 1`.
4. A progress line draws a bar of two lengths — resolved, then in progress — and
   `4 of 18 resolved`, then the count in each of `Open`, `In progress` and `Resolved`.
5. The Daily / Planning switch sits at the end of the title row ([[Daily or planning]]),
   and the person row under the progress line
   ([[Walking the board one person at a time]]).

**Extensions**

- **1a — the scope is `Product` or `Deliverables`, or the stored scope is stale.** No
  header: there is no iteration to describe, and a stale scope reads as the product board
  everywhere ([[A board scoped to one iteration]] 2a).
- **2a — the goal is blank, or the goal property is not configured.** No label and no goal
  line draw — never an empty line, never a placeholder that invites a value. The same
  refusal the old line made.
- **2b — the goal's emphasis.** The spec gave the goal an accent rule at its start. The
  build draws no coloured side border: the design checks flag a thick side rule as a
  cliché, so the accent goes on the small `Goal` label above and the goal is prominent by
  size and weight alone. Decided in the build, recorded here.
- **3a — today is before the start.** `13 Oct – 26 Oct · Starts in 3 days`, with no day
  count.
- **3b — today is after the target.** `13 Oct – 26 Oct · Ended 2 days ago`.
- **3c — today is the target day.** The day count, then `Last day` in place of `0 days
  left`.
- **3d — only one end is stated.** That end alone — `Starts 13 Oct` or `Ends 26 Oct` —
  and no day count, because a count needs both ends.
- **3e — no end is stated.** No timebox line.
- **3f — the target is before the start.** An invalid span, read as the target alone
  (3d): a day count over it would be a negative number of days.
- **4a — the sprint holds no cards.** `0 of 0 resolved` and an empty bar. The line stays,
  because the board's own empty state already explains the board.
- **4b — a card is a context row** (an excluded ancestor drawn to place a carrier). It is
  not counted: the context-row rule says a context row is never a source of a count.
- **4c — a column is folded.** The counts do not change: progress reads the sprint's
  population, not the drawn cards — it is about the sprint, not about the screen.
- **4d — progress is not a burndown.** It reads the current states and stores no history.
  The 2026-08-15 design's "no burndown, velocity or capacity" is narrowed by exactly this
  and no further ([[The iteration board for the daily]]).

## Acceptance criteria

- The iteration board draws the kicker and the iteration's title as an `h2`; the product
  board draws no header.
- A goal draws under a `Goal` label; no goal, a blank goal or an unconfigured goal property
  draws neither.
- Every timebox branch is DECIDED as stated — before, running, last day, after, one end, no
  ends, and a target before its start — in `test/domain/iterationDaily.test.ts`. The drawn
  line is checked for a running sprint, an ended one and no dates; the other drawn strings
  rest on the same catalog keys and are not asserted one by one.
- Progress counts this sprint's result cards by the columns' own bucket reading, never a
  context row, and is unchanged by a fold.
- Every word in the header — kicker, goal label, timebox, progress, switch and chip
  tooltips — comes from the catalog; only titles, the goal, names and counts are data.

**Checked by** `test/i18n/iterationDaily.test.ts` — "leaves nothing but titles, names, values and counts unmarked"

**Checked by** `test/view/iterationHeader.test.ts` — "counts progress over the sprint, never over a context row"

**Checked by** `test/view/iterationHeader.test.ts` — "leaves progress unchanged by a folded column"

## Where it lives

`src/domain/iterationDaily.ts` holds the pure questions: `timebox` turns the iteration's
two dates and an injected `today` into one of six shapes, and `iterationProgress` counts a
population by `bucketFor`, which is the bucket reading `iterationBuckets` in
`src/domain/board.ts` uses. Nothing in it reads a clock — the view passes `todayCivil()`.
`src/view/render/iterationHeader.ts` draws the header (`renderIterationHeader`), the goal,
the timebox and the progress, with its dates through `formatDate` in `src/i18n/t.ts` and
its words in `src/i18n/en.ts` under `iteration.*`. `src/view/render/iterationBoard.ts`
calls it in place of the removed `renderIterationGoal`. The look is
`styles/iterationHeader.css`. Domain rules in `test/domain/iterationDaily.test.ts`; the
drawn header in `test/view/iterationHeader.test.ts`. The browser harness opens it with
`?scope=12%20-%20Iteration.md`, on the demo sprint `test/helpers/fixtures.ts` holds.
