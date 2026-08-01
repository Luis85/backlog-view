---
type: Feature
parent: "[[Product Backlog]]"
order: 10
status: Done
---

# Work item hierarchy

What a backlog *is* here: notes linked by a `parent` property, ranked by `order`, and
levelled by `type`. Everything else in the product reads this structure.

The shape is a **ladder** — `Epic → Feature → PBI → Task` by default, configurable — plus
the types that sit beside it. A note with no `type` still shows a level, implied from its
parent, so a backlog works before anyone has tidied it.
