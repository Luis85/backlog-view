---
type: Epic
order: 120
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

# Product Strategy

**A backlog that cannot say what it serves is a list of requests.** This view holds the
strategic entities a vault chooses to keep — objectives, outcomes, themes, initiatives,
jobs to be done — shows which work supports each of them, and names the work that supports
none.

**Outcome** — Someone reviewing the plan can see which objectives it advances, how much of
the effort each one is getting, and what is in the backlog for no stated reason.

## Why it is its own view

Strategy is a second hierarchy over the same notes, and it is not the backlog's. An
objective does not rank among features, does not roll up into a parent's progress, and does
not move when work is reordered — so it must not be a rung on the ladder `parent` already
decides. The link from work to strategy is a **property**, the shape this register settled
on twice before: for a dependency, and for what a test covers.

Read forward it says what a feature serves. Read backward it answers the question the view
exists for — which objectives nothing is being done about, and which work answers to
nothing.

## Definition of done, for anything under this epic

- The strategic types are configuration. A vault that keeps objectives only, or JTBD only,
  gets a working view.
- Alignment is one property naming a note, resolved the way every other link property is.
- Coverage numbers count work the base returned, never notes it excluded, and say what they
  counted.
- Nothing here changes a backlog item's rank, parent or state.

## What this epic will not do

- **Score strategy.** Whether an objective is worth having is not a number this view
  computes.
- **Own OKRs.** A vault that tracks key results tracks them in notes; this view reads the
  link, not the methodology.
