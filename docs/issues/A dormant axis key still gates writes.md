---
type: Issue
order: 10
parent: "[[Horizons or dates]]"
status: Open
priority: P3
area: design
created: 2026-08-02
source: review of PR #46
files:
  - src/domain/settings.ts
  - src/domain/roadmap.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A dormant axis key still gates writes

## The limitation

`configProblems` registers the horizon key whenever a horizon **property** is named,
without asking whether the bucket axis is configured. So this configuration —

```yaml
horizonProperty: note.start
horizonValues: ""        # cleared: no bucket axis
startProperty: note.start
```

— reports `The horizon and start properties share the key "start".` and, because that
report gates every batch, blocks **all** writes in the view: reordering, state changes,
scheduling, creation. Nothing in the plugin reads or writes that horizon key while the
values list is empty: the roadmap draws guidance rather than buckets, the row menu
withholds Set horizon and Clear horizon ([[Horizon and dates from the row]]), and the
backfill skips the key. The collision is real and inert at the same time.

## Why it is deliberate

The alternative — registering the key only while `hasHorizonAxis` holds — hides a
mistake until it becomes load-bearing. The user would point two properties at one key,
see nothing, and have every write stop the moment they typed a first horizon value,
with the explanation arriving one edit after the cause. A collision between two
configured properties is worth naming **when it is made**.

It is also the narrower reading of what `configProblems` is for. The function's own
sentence — "configuration mistakes that would corrupt writes" — argues the other way,
and that is the honest tension here rather than a settled question. What tips it is
reachability: the state the report blocks is a misconfiguration a user made on purpose,
the message names both properties, and clearing either one lifts it in a click.

The precedent that does NOT apply is `tagsKey` yielding to the four core keys. That
exists to protect views that worked before the tags option existed
([[Persisted keys stay as written]]); the axis options are new and have no such views
to protect, which is why [[Horizons or dates]] gives them a collision report rather
than a yield.

## What would lift it

Gating the horizon registration on `hasHorizonAxis` — the predicate the roadmap and the
row menu already share — plus a rule saying when a report is owed for a property that
is set but unused. The second half is the part worth designing: `focusLevel` naming a
level nothing carries, and a state property in a base with no states, are the same
question, and answering it once for all of them beats answering it here for one.

## Impact

Reaching this state needs two deliberate acts — aiming the horizon property at a key
another configured property already uses, **and** clearing the values list — so it is
not on any ordinary path. The cost when it happens is a fully blocked view, which is
severe; the exit is one property picker away, and the warning names it.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly rather than rediscovered. If it
is ever taken up, the sibling questions above come with it.
