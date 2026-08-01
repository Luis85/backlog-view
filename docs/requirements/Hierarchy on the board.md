---
type: Feature
parent: "[[Product Kanban]]"
order: 40
status: Open
created: 2026-08-01
---

# Hierarchy on the board

The tree does not stop existing when the board renders: the focus level picks which
rung becomes cards, lanes group cards under their parents, and creation lands new notes
in the right place with the right state. This is the ground no generic property board
occupies, and the reason the mode belongs in this plugin rather than beside it.

**Outcome** — The board knows what is under what. Which rung it shows is a choice, what
sits below a card still counts, and a card created on the board lands where it belongs
in the tree.

## Use cases

- [[Focus level picks the cards]] — which rung becomes cards.
- [[Swimlanes by parent]] — one level of ancestry, and the board's second write axis.
- [[New cards in place]] — created in the column, parented by the lane.
