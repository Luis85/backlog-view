---
type: Feature
parent: "[[Business value estimation]]"
order: 50
status: Open
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The prioritized list

The items and their numbers as a table — rank, item, value, effort, confidence, score,
state — sorted by whatever the reader picks. Sorting this table is reading; it writes no
order to the backlog.

**Outcome** — The comparison this view exists for is one screen.

## Where it lives

`src/view/estimation/estimationView.ts` (the Bases view itself — loading, the guided
empty state, a config warning naming every problem, and now the table for a configured
model) · `src/view/estimation/register.ts` (`registerEstimationView`, the view's own
registration — ADR 0030) · `src/domain/estimationItems.ts` (`buildEstimationModel`, one
item per result — its own answers, what is already stored on it, and what scoring it
fresh says about that stored value — read off the vault the same one-cache-read-per-note
way the backlog's own model is) · `src/view/estimation/renderTable.ts` (the header —
six real, clickable buttons now, one per column, `aria-sort` on whichever is active —
one row per item with its total, coverage, confidence, effort and currency word, and
the delegated click and keyboard that set `EstimationView.selectedPath` —
[[Why this item scored what it scored]]'s panel reads it next) ·
`src/view/estimation/init.ts` (`runEstimationInit`, the guided empty state's own setup
action: bind every suggested property nobody has touched, then stub the bound keys onto
every result — one gated batch, so it is a single undo).

A click sorts a COPY of the model's own items, never the Base's own order underneath it;
a second click on the same column flips direction, and a number column's first click is
descending while the title's is ascending — the useful first look either way. A row with
nothing to show for the active column sorts after every answered row, whichever direction
is active: absence is not a low value. The currency word sorts by a fixed reading rather
than alphabetically (current, stale, foreign, handwritten, orphan, none — declared in
`renderTable.ts`'s `CURRENCY_ORDER`), the order a reader hunting for rows that need
attention wants. The pick is retained per saved view exactly like the roadmap's axis and
the shelf's own sort (`storage/viewStateStore.ts`'s `estimationSort` pref, resolved
through the same `resolveViewIdentity` the backlog's tree restores by), and it is
session-only wherever that identity cannot be resolved.

Tests: **`test/view/estimation/states.test.ts`**, `test/view/estimation/register.test.ts`,
`test/view/estimation/table.test.ts`, `test/view/estimation/init.test.ts`,
`test/view/estimation/sort.test.ts`.
