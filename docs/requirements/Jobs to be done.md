---
type: Feature
parent: "[[Product Strategy]]"
order: 60
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

# Jobs to be done

A JTBD note gathers what relates to it from both directions: the opportunities exploring
it, the features serving it, and the evidence behind either. It is what connects discovery to
the plan without either one owning the other.

**A job is a strategic entity, so the link is the alignment link and there is no second
key.** A JTBD note carries one of the strategic type values
[[Work with no strategy behind it]] declares, joins the strategy tree by `parent` like an objective or an initiative, and
work names it with the one alignment property — which is what keeps
[[Coverage per objective]]'s "one strategic note per item" true rather than making it a
special case. A feature serving a job and an objective at once does not need two links:
the job hangs under the objective in the tree, and coverage rolls up through it, so one link
answers both questions. This note said "a different property" until 2026-08-16, which would
have been a second alignment graph beside the first and two answers to what an item serves.

**The evidence hop is a key this view names for itself**, like every hop that leaves the
relationships an epic owns — Strategy owns alignment, and reads evidence only because it was
told which property holds it. Unconfigured, the evidence column is not drawn and the rest of
the read still works: the opportunities and features are found through Strategy's own
alignment link and need nobody else's settings.

**Outcome** — A job someone is trying to get done can be traced through whichever links the
vault has configured, and a missing one costs that column rather than the view.
