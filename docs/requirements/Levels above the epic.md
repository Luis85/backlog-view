---
type: Feature
parent: "[[Product Portfolio]]"
order: 10
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
priority: ""
iteration: ""
---

# Levels above the epic

A vault may declare grouping levels above its work ladder — portfolio, product, domain —
each an ordinary note, each optional.

**Two relationships, and each one is the plainest available.** The grouping notes hold each
other with `parent`, among themselves, exactly as strategy notes and test suites do: a domain
is a child of a product, a product of a portfolio, and a note with no parent is a top-level
grouping. Work reaches that ladder through **one property naming its innermost grouping** —
never through `parent` — and the view walks up from there, so an epic filed under a domain
rolls into that domain's product and portfolio without anybody restating the path on the
item.

**Membership descends the work tree, and the nearest statement wins.** An item with no
grouping of its own belongs to the innermost grouping named by its nearest ancestor that
names one, so filing an epic under a domain files everything beneath it — which is the point
of the property, and the alternative is the restating this note just refused. An item that
names its own grouping overrides its ancestors for itself and everything below it, because a
feature genuinely belonging to another product is the case the override exists for. An item
whose ancestors name nothing belongs to no grouping and is reported as unplaced rather than
filed under a default.

That makes every item's grouping exactly one, which is what keeps a rollup honest: an item
is counted at its own grouping and at every grouping above it, once each, and never twice
because two ancestors disagreed — the nearer one is the answer.

A vault that declares no grouping levels sees no portfolio anywhere.

Grouping notes are ordinary notes, so a backlog base that returns them draws them: keeping
them out of the tree is the base's own filter, on the terms [[A view per capability]] states
for every family that is not work.

The second half of that is not a preference. `Epic` is a root by position in this plugin's own type map,
and `parent` is what decides level, rank, rollup, focus and what a drag means; hanging epics
under a product would give every existing vault a new depth, renumber nothing correctly, and
make a portfolio note compete with features for order. It is the shape the register has now
settled on three times for exactly this reason — [[Dependencies as a property]], what a test
covers, and strategic alignment — and this is the fourth: **one more property, not a second
ladder.**

**Outcome** — Higher-order structure exists for the vaults that have it, for no others, and
the backlog's own hierarchy is unchanged by having it.
