---
type: Feature
parent: "[[Product Backlog]]"
order: 10
status: Done
---

# Work item hierarchy

What a backlog *is* here: notes linked by a `parent` property, ranked by `order`, and
levelled by `type`. Everything else in the product reads this structure.

The shape is a **fixed ladder** — `Epic → Feature → PBI → Task` — plus
the types that sit beside it. A note with no `type` still shows a level, implied from its
parent, so a backlog works before anyone has tidied it.

**Outcome** — A folder of notes reads as a levelled, ordered tree — before anyone has
tidied a single property.

## Use cases

- [[Parent, order and type properties]] — the three frontmatter properties that carry the
  whole model.
- [[Level ladder and implied types]] — the fixed `Epic → Feature → PBI → Task` ladder, and
  levels implied from position.
- [[Types beside the ladder]] — `Issue` and `Bug`: pinned rank, any parent, Tasks only.
- [[Folder note hierarchy]] — reading the hierarchy from folder notes, for vaults already
  organised that way.
