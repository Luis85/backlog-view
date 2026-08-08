---
type: Feature
parent: "[[Product Roadmap]]"
order: 50
status: Open
created: 2026-08-01
---

# Hierarchy on the roadmap

The tree does not stop existing when the roadmap renders: lanes group rows under their
parents, the focus level picks which rung becomes rows, and progress rolls up from
beneath. This is the same ground the board claimed — the thing no generic timeline over
properties occupies, and the reason the mode belongs in this plugin rather than beside
it.

**Outcome** — The roadmap knows what is under what: which rung it shows is a choice,
what sits below still counts, and crossing a lane is a real reparent through the real
gate, never a visual shuffle.

What sits directly below a card is not only counted: on the horizon axis and the shelf,
where a roadmap row is an ordinary card, [[Children on the card]] is the shared
implementation this feature and the board draw on to list it. A dated-axis timeline row
uses the card shell without the body, so it draws a disclosure of its own kind instead —
[[Collapsing a bar's subtree]] folds the rows beneath it rather than listing them on its
face, off the same collapse bit. Neither is lanes: both fold one item's own subtree,
while a lane is a REGION naming a parent, which is still design.
