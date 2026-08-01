---
type: PBI
parent: "[[Creating items]]"
order: 10
status: Done
---

# New item flow

A **+** on every row, a **New** button in the toolbar, and `New <type>` in the context
menu. The view writes `type`, `parent` and `order`; the user supplies a title.

## Acceptance criteria

- Where a row can hold more than one kind of item, the modal asks which, defaulting to the
  ladder's own child.
- A row with one option asks nothing.
- The modal says where the item will land before it is created.
- Creation goes through the same config gate as every other write.
