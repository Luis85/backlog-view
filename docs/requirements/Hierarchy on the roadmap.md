---
type: Feature
parent: "[[Product Roadmap]]"
order: 50
status: Done
created: 2026-08-01
started: ""
finished: ""
horizon: ""
start: 2026-09-07
due: 2026-09-13
risk: ""
assignee: Sarah
---

# Hierarchy on the roadmap

The tree does not stop existing when the roadmap renders: the focus level picks which
rung becomes rows, and progress rolls up from beneath. This is the same ground the board
claimed — the thing no generic timeline over properties occupies, and the reason the mode
belongs in this plugin rather than beside it.

**Outcome** — The roadmap knows what is under what: which rung it shows is a choice, and
what sits below still counts.

What sits directly below a card is not only counted: on the horizon axis and the shelf,
where a roadmap row is an ordinary card, [[Children on the card]] is the shared
implementation this feature and the board draw on to list it. A dated-axis timeline row
uses the card shell without the body, so it draws a disclosure of its own kind instead —
[[Collapsing a bar's subtree]] folds the rows beneath it rather than listing them on its
face, off a collapse bit of its own, since a fold on the plan is not a statement about
where the reader is in the backlog.

**Closed 2026-08-15.** Every child is in a terminal state: [[Focus level picks the rows]]
and [[Progress on the bar]] are `Done`, and [[Lanes on the roadmap]] is `Dropped` — the
design was built, tried and refused, which is an answer and not a debt. The Outcome above
is what those two deliver: the focus level decides which rung becomes rows, and what sits
below still counts, in a rollup the tree and the roadmap read from one place.
