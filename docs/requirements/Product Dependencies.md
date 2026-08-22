---
type: Epic
order: 4.6875
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

# Product Dependencies

**What has to happen first is a fact about the plan, and today it is invisible.** This view
reads the dependency edges the notes already carry, draws them, says which items are
blocked and why, finds the cycles, and highlights the chains that reach something with a
date or a commitment — a release, an objective, high-priority work, a dated item. Not a
milestone: nothing points at one, so no chain can be shown to reach it, and
[[Chains that reach a release]] says why in full.

**Outcome** — Sequencing stops being something a person holds in their head while looking
at a backlog that cannot show it.

## Why it is its own view

The register settled the shape of a dependency once already: it is **one more property, not
a second graph**, stored in one canonical direction and read from both. What is new here is
a surface for it. A graph, a blocked-item rule and cycle detection are not a tree with
extra lines — they answer a different question, need their own filters and their own idea
of what counts as ready, and none of that belongs in a backlog's options.

## Definition of done, for anything under this epic

- One canonical direction is stored. The opposite reading is derived, never written twice.
- Blocked is a rule the vault configures, not a state anybody maintains by hand.
- A cycle is reported, never resolved automatically, and reported in a way that names every
  item in it.
- Nothing here writes to an item except the dependency property itself.

## What this epic will not do

- **Schedule from dependencies.** No critical path, no automatic ordering, no dates
  inferred from a chain.
- **Refuse a dependency.** A cycle is a fact about the plan and is shown as one; the plugin
  does not decide which edge was wrong.
