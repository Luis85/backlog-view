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
empty state, a config warning naming every problem, and the placeholder frame a
configured model draws until the table exists) · `src/view/estimation/register.ts`
(`registerEstimationView`, the view's own registration — ADR 0030).

The table this note is named for is not built yet: what exists so far is the frame it
will render into, and the states it falls back to before a model is fit to score with.

Tests: **`test/view/estimation/states.test.ts`**, `test/view/estimation/register.test.ts`.
