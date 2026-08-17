---
type: Test case
order: 20
parent: "[[Smoke test the board]]"
status: Dropped
priority: P3
area: verification
created: 2026-08-02
closed: 2026-08-17
source: Feature Test epic
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Board card carrying hidden matches

Dropped: the thing it checked no longer exists.

## Why this existed

Under the plugin's own quick filter, a card could be the only visible ancestor of a match
the board drew no row for — a card, unlike a tree row, has no nested rows to show the
match in place. The card carried a marker saying so, asserted by class in jsdom and never
read by a human, which is what this case was for: whether the marker was visible,
distinguishable from the card's own state chip, and legible at the card's default size.

## Why it is dropped rather than kept open

The quick filter was withdrawn on 2026-08-17
([[Remove the quick filter, now that Bases has its own search]]), and the marker, the
match links on a card's face and the `Open match` menu entries went with it. There is no
narrowing left that a card can be the only visible ancestor under: a Base's own search
narrows the RESULTS, and the ancestors those results need are loaded around them, so the
tree re-forms rather than leaving a match with nowhere to be named.

It is kept rather than deleted because the appearance question it asks is the one that
would come back with the affordance. The task note above records what a replacement would
have to be built against — the Base's own search rather than a box of ours — so this case
is the check that would be reopened, not rewritten from nothing.

## Acceptance criteria

None; there is nothing on screen to check. It reopens if a hidden-match affordance ever
returns.
