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
way the backlog's own model is) · `src/view/estimation/renderTable.ts` (the header, one
row per item with its total, coverage, confidence, effort and currency word, and the
delegated click and keyboard that set `EstimationView.selectedPath` —
[[Why this item scored what it scored]]'s panel reads it next) ·
`src/view/estimation/init.ts` (`runEstimationInit`, the guided empty state's own setup
action: bind every suggested property nobody has touched, then stub the bound keys onto
every result — one gated batch, so it is a single undo).

Sorting by column is not built yet: the header's labels are plain text this round, not
controls, so nothing here claims a column the reader cannot yet click.

Tests: **`test/view/estimation/states.test.ts`**, `test/view/estimation/register.test.ts`,
`test/view/estimation/table.test.ts`, `test/view/estimation/init.test.ts`.
