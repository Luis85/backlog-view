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
priority: ""
iteration: ""
---

# Cycle time between two states

The elapsed time between two transitions, computed from the stamps those transitions wrote,
over the items that carry both. Items missing either stamp are excluded and counted, because
a duration averaged over the items that happened to be stamped is a fiction.

**A pair is any two date keys this view names**, each with the label it should carry on
screen, defaulting to the two the board already writes — entering a started state, and
crossing the done boundary. The view does not ask what wrote a stamp, only where it is: a
vault stamping its own transitions, by hand or with another plugin, gets those durations by
naming the keys, and discovery to validated is that case rather than a special one. Fixing
the list to the board's two would suppress a measurement whose ends both exist, which is a
different failure from the one below and no better.

**What it will not do is offer a pair it cannot compute.** This view writes nothing and
cannot reconstruct a transition nobody recorded, so a pair with an unbound key is not
offered, and a bound key nothing has ever written produces the empty sample the first
paragraph reports rather than a duration. No Discovery requirement here stamps its lifecycle
transitions yet — that is work for the view that owns them, and until it exists a vault
supplies the stamp or the figure stays empty and says so.

**Outcome** — How long things take can be measured wherever the vault recorded the two ends,
with its sample size on screen and no pair offered that nothing stamps.
