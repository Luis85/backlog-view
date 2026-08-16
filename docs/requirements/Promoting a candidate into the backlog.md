---
type: Feature
parent: "[[Product Discovery]]"
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

# Promoting a candidate into the backlog

A validated opportunity is promoted into an epic, a feature, a PBI or whichever backlog
type the vault configures. The promotion creates the backlog note through the one write
boundary, links it back to the discovery item, and leaves the discovery item where it is.

**"Validated" there describes the normal case; it is not a precondition, and nothing is
gated on it.** The action is offered on any discovery item — the one thing it cannot do
without is the source-link key below. Two reasons, and the second is the deciding one:
[[Discovery readiness]] already states that nothing is refused for failing its checklist, so
a promotion that refused would be the same view blocking on the evidence it just said it
would only report; and a gate would need this view to hold a list of validation values that
justify commitment, which is a judgement about somebody's product decision rather than a fact
about their data. A team that commits to an inconclusive opportunity is doing something
ordinary and often deliberate. The validation state stays where it was written, visible in
discovery and unchanged by the promotion.

**A type is not a position, so promotion goes through the creation flow rather than around
it.** A promoted feature needs a parent and a rank among its siblings; a promoted epic needs
a rank among the roots. Both are what creating an item already decides — the parent picked or
implied, the order taken from the end of that sibling group — so promotion reuses that path,
prefilled with the type and the source link, instead of writing a note with a type and
nothing to hold it. An item created with no position is the orphan the backlog view spends
its own rules avoiding.

**The source link is a key this view names**, like every other property it writes, and it is
the one promotion cannot do without: without it the promotion is an ordinary creation and the
record of what a piece of work came from is gone. So promotion is offered only once that key
is bound — the guided empty state offers to bind it, as it does for the rest — rather than
proceeding silently unlinked and leaving a discovery item nothing points back to.

**"Advanced" is not a rule, so the state is named.** The lifecycle is the vault's own and
may be renamed, reordered or extended, and the default has two states after `validated` —
so "the next one" and "the last one" are different answers and neither is inferable. This
view names the **promoted state** it writes, one value from its own lifecycle, in its own
options. With none named the promotion writes no state at all: it creates the backlog note
and the link, and the reader moves the card if they want it moved. Guessing which column
somebody meant is how a promotion quietly files a validated opportunity as planned.

**Outcome** — Committed work names the opportunity it came from, the discovery record
survives the commitment, and its state changes only to a value somebody chose.
