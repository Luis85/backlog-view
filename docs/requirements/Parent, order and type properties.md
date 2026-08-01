---
type: PBI
parent: "[[Work item hierarchy]]"
order: 10
status: Done
---

# Parent, order and type properties

Three frontmatter properties carry the whole model, and each is configurable:

- **`parent`** — a wikilink to the parent note. Absent means top level.
- **`order`** — a number ranking an item among its siblings.
- **`type`** — the level name.

## Acceptance criteria

- Parent links resolve through wikilinks, bare names and aliases, and survive a rename.
- A missing `order` sorts last, in the Base's own result order.
- A parent value that resolves to nothing marks the item an **orphan** rather than hiding it.
- Property keys are configurable; a collision between two of them blocks writes loudly
  rather than corrupting notes.
