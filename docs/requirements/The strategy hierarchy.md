---
type: Feature
parent: "[[Product Strategy]]"
order: 20
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

# The strategy hierarchy

The strategic entities draw as their own tree — an objective holding outcomes holding
initiatives — built from **the same `parent` link every note here uses**, among strategy
notes only. That is the test catalog's arrangement exactly (`Test suite` → `Test case`): a
ladder of its own, rooted at the top level, using the one relationship the vault already
understands rather than inventing a second one nothing else can read.

**The tree stops where the work starts.** An epic is never a child of an initiative — it
names the strategic entity it serves in an alignment property, and this view reads that link
backward. So `parent` never crosses between the two ladders, which is what keeps strategy out
of the backlog's rank, rollup and focus while still giving strategy a shape.

Absent that link a strategic note is a root, which is the ordinary answer for a vault
keeping objectives and nothing else: a flat list of objectives is a working strategy view.

Because these are ordinary notes with a `parent`, a backlog base that returns them draws them
too — keeping the two lists apart is the base's own filter, on the terms
[[A view per capability]] states for every family that is not work.

**Outcome** — Strategy has a shape a reader can navigate, and the backlog's ranking is
untouched by it.
