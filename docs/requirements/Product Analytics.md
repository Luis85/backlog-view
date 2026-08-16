---
type: Epic
order: 180
status: Open
area: product
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

# Product Analytics

**Counting what the backlog already knows.** How much work of each kind there is, how old
it is, what nobody has touched, how much gets finished per month, how long things take
between two states, and how estimates are distributed — all of it derived from properties
the notes already carry.

**Outcome** — Questions about the shape and pace of the work get answered from the vault
instead of from memory.

## Why it is its own view

Every number here is a count over the same items other views draw, and none of them helps
anyone read a tree. Its settings are its own and complete: the periods, the buckets, the
state property and its states, every date key it reads — created, meaningful change,
started, finished — and **a key for every other property any of its figures counts by**:
the estimate, the objective, the release, the owner, the tags, the horizon. The rule rather
than the list is what matters, because the list was short by two the first time it was
written and by four the second: **every property this view reads is a key this view names**,
each defaulting to the same suggestion every other view starts from, and a figure whose key
is unconfigured is not drawn rather than guessed. Analytics that had to read a board's options
could not run in a base without a board, and would silently change meaning when somebody
reconfigured one. It writes nothing at all.

The honesty rule is the whole epic: **a metric states what it counted.** A throughput chart
built from notes that carry no completion date is a chart of what the vault happens to have
stamped, and saying so is the difference between a measurement and a decoration.

## Definition of done, for anything under this epic

- Every figure names its population, its unit and its period, and reports what it could not
  measure rather than counting it as zero.
- Nothing is inferred from file modification times where a property exists to say it, and
  where one does not, the view says the number rests on the file system.
- Nothing here writes anything.

## What this epic will not do

- **Product telemetry.** This is analytics about the backlog, never about the product's
  users.
- **Forecast.** No velocity extrapolation, no predicted completion dates.
