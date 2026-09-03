---
type: Issue
order: 20
parent: "[[Ranking at the focused level]]"
status: Open
priority: P2
area: design
created: 2026-08-30
source: PR review of the global-rank branch, Task 6 (the behaviour is Task 5's)
files:
  - src/domain/dropTargets.ts
  - src/view/interactions/structure.ts
  - src/view/render/rows.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A focus row can be reparented by drag, where the menu offers no Indent

## The question

Focus-level ranking opened the synthetic focus row to `before`/`after` drops. It did not
open it to `inside` drops, and it did not close them either — nobody asked the question,
so the answer came from what the code already did.

`insidePosition` (`dropTargets.ts`) builds its target from the hovered row alone and has
no `focusRoot` check and no `model.focused` branch. `dropTargetFor` then asks
`isInvalidParent` and `keepsProjection`, neither of which is about focus. A focus row is
draggable (`row.draggable = !item.outsideFilter`) and every focus row is a legal parent
for another, so **dropping one focus row onto the middle of another reparents it**, with
no confirmation and nothing said.

The keyboard and the menu refuse the same nesting outright: `indentTarget` returns null
for a `focusRoot` row, so Alt+Right does nothing and the menu draws no **Indent under
"X"** entry at all. Three inputs, one write, and they disagree about whether it is
allowed — which is the rule [[Keyboard and menu moves]] and this repository's own
"one move, three inputs" paragraph exist to keep.

## Why it is not simply a bug

Both answers are defensible, which is why this is an Issue and not a Bug:

- **Refusing the drag** matches the menu, matches [[Focus level]]'s guarantee that the
  synthetic row is not a real group, and is the smaller change: one `focusRoot` test in
  `insidePosition`. It also removes a gesture that works today, on a screen where nesting
  a PBI under another PBI is a real thing to want.
- **Offering the indent everywhere** makes the three inputs agree the other way and is
  arguably what the user means: an `inside` drop names its destination explicitly, so
  unlike a rank across the synthetic row it is not a guess about which group the row
  belongs to. It costs the menu entry, the keyboard path, and an answer to what the
  focused list should draw afterwards — the moved row leaves the focus level's rendering
  only if its type changes, which a move never writes.

Nothing measured says which one users want, and the epic that met this was building
ranking rather than reparenting. Recorded at the moment it was found rather than settled
in passing.

## What a real fix would look like

Either direction is a small change in `dropTargets.ts` plus its counterpart in
`structure.ts`, and both need the same test: the three inputs asked of one fixture,
asserting they agree. The existing "lands the same rank from the drag, Alt+arrow and the
menu" test in `test/view/focusRanking.test.ts` is the shape — what it does not cover is
the `inside` zone, which is exactly the hole this note is about.

Note that the two refusals are not even spelled the same way today: `indentTarget` tests
`item.focusRoot`, while `siblingPosition` tests membership in `model.roots` under
`model.focused`. A promoted catalog root carries the flag without any focus level being
on, so whichever direction is taken, the fix states ONE predicate and both paths ask it.

## Acceptance criteria

None yet; this is an open question rather than an accepted limitation. It becomes one or
the other when somebody decides whether a focus row may be nested by any input at all.
