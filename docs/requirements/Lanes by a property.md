---
type: Feature
parent: "[[Product Roadmap]]"
order: 70
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

# Lanes by a property

Lanes group by **one property the reader picks**, not only by parent — an objective, a
release, a product, a team, or whatever key the vault names — so the same roadmap answers
"how is that objective tracking" and "what is this team shipping" without a second view.

[[Lanes on the roadmap]] already groups by `parent` and [[The resource timeline]] already
bands by assignee; this generalizes the first and subsumes neither. What it adds is the pick:
the lane key is one more thing the view options carry, defaulting to the parent, and the
lanes are the distinct values that key holds among the results, ordered as
[[Rolling a portfolio up]] orders a categorical: a declared order where the vault gave one,
the values as written where it did not.

**A lane is only a write target where its property is one a move can set.** Parent lanes
reparent on crossing, which is the rule that note states; a lane over a release or an
objective moves that property instead, one write, through the same gate and the same undo.
Where the key is one this view does not write — anything another capability owns — crossing
is refused with the reason rather than silently ignored, which is what a drag that appears to
work and changes nothing would be.

**An item with no value for the lane key gathers in a trailing lane**, the rule the board and
`Lanes on the roadmap` both keep: a row with nowhere to go is a row that disappears. An item
whose key holds several values — a link property with two targets — is drawn in each of them
and counted once per lane, with the repetition named on the lane header, because hiding a
row that legitimately belongs to two lanes is worse than showing it twice where the header
says so.

**Outcome** — A roadmap groups by the thing the reader is asking about, and the gesture that
moves a row between groups writes the property the grouping was made of.
