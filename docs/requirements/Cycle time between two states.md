---
type: Feature
parent: "[[Product Analytics]]"
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

# Cycle time between two states

The elapsed time between two transitions, computed from the stamps those transitions wrote,
over the items that carry both. Items missing either stamp are excluded and counted, because
a duration averaged over the items that happened to be stamped is a fiction.

**The selectable pairs are the boundaries something actually stamps**, which today means the
two the board writes: entering a started state, and crossing the done boundary. This view
writes nothing and cannot reconstruct a transition nobody recorded, so a pair like discovery
to validated is not offered — it needs a stamp at that transition first, which is work for
the view that owns the transition, not a figure this one can promise. Offering the pair and
returning nothing would be the same fiction one line up, dressed as a feature.

**Outcome** — How long things take can be measured wherever the vault recorded the two ends,
with its sample size on screen and no pair offered that nothing stamps.
