---
type: Feature
parent: "[[Product Kanban]]"
order: 40
status: Active
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

What sits directly below a card is not only counted: [[Children on the card]] is the
shared implementation both this feature and the roadmap's own hierarchy draw on to list it.
