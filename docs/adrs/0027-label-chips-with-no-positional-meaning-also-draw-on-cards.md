---
adr: 27
title: Label chips with no positional meaning also draw on cards
status: Accepted
date: 2026-08-12
area: architecture
---

# ADR 0027 — Label chips with no positional meaning also draw on cards

## Context

[[Setting the assignee on an item]] gave the assignee the row's own chip — a button
that shows who is on an item and opens the same menu **Set assignee** does. Cards never
drew it: `renderCardBody` filters `host.columns` to `value` and `tags` before handing
the list to `renderPropCells`, so every chip kind — state, horizon, risk and now the
assignee — was excluded from the board's and the roadmap's cards alike, all by one line
[ADR 0023](0023-columns-are-the-bases-property-order.md) wrote for two of them.

That line bundled four kinds under one argument, and the argument only holds for two of
them. A board card's column already IS its state and a bucket already IS its horizon —
drawing either chip on the card would repeat what the card's own position says, which
ADR 0023's "Draw the chips on cards too" alternative rejected on exactly that ground.
Risk and the assignee have no such equivalent: nothing about a card's position, on any
projection this plugin draws, says what level a risk is judged at or who is on the item.
ADR 0023 rejected showing them anyway, but on a DIFFERENT ground — "a per-projection
skip list to keep in step with every new projection" — which describes a rule that has
to ask what a NEW projection expresses, not the rule this plugin actually ships: a fixed
set of KINDS, decided once, that either carry positional meaning everywhere or carry it
nowhere. State and horizon are the first kind; risk and the assignee are the second, and
nothing about them varies by projection.

A user asked for the assignee to reach the card directly — reading a board is reading
who has the work as much as reading what stage it is in — and reported that a plain
value cell rendered even when a note carried none, a hole the size of
`padding-inline-end` on every empty cell. Both landed in the same change: fixing the
second is what makes the first look right, since an unjudged item's dashed "Assignee"
invitation chip is meant to be the one honest gap on the card, not one gap among several
empty property cells nobody can tell apart from it.

## Decision

**A chip kind draws on a card exactly when nothing about the card's position, on any
projection, already says what the chip would say.** State and horizon fail that test —
ADR 0023's reasoning for excluding them is unchanged and this record does not revisit
it. The assignee passes it, so `renderCardBody`'s column filter
(`src/view/render/board.ts`) now keeps `assignee` beside `value` and `tags`; risk also
passes it but stays excluded here, because only the assignee was asked for — the rule
above is what a future PBI for risk would cite, not a reason to add it unasked.

A card's property cell is also dropped WHOLE when it has nothing to show, which the
tree's never was: the tree's columns are fixed-width and share a header, so an empty
cell holds its column's place or every cell after it shifts — a rule
`src/view/CLAUDE.md` already states and this record does not touch. A card has no
header to stay aligned with; its cells wrap and size to content (`styles/cards.css`),
so an empty one is not a value that happens to be blank, it is a chip-shaped gap with
nothing in it. `renderPropCells` in `src/view/render/columns.ts` gains a `dropEmpty`
option for exactly this — off for the tree's own call, on for the card's — and asks each
cell renderer's own answer to "did you draw anything" rather than re-deriving it by
reading the DOM the renderer just built, the mistake ADR 0023's Consequences already
names once (the tag menu drifting from what the tree renders because two derivations of
"what is on screen" disagreed). The WRAPPER around the cells (`.pbl-props`) goes too when
every one of them did: it is itself a flex child of `.pbl-card`'s own column layout and
its own `gap`, so an empty wrapper left standing is the identical gap moved up one
level — a card whose only configured column is empty, or a context card with nothing on
any of its cells, is not an edge case of the cell-level rule but the same rule applied
one level higher. Found by an automated review the first version of this change missed
(Codex, PR #132) — the fix is one more condition in the same function, tracking whether
anything was drawn across the whole pass rather than per cell.

## Consequences

- **A card can now show four kinds of cell** — plain values, tags, and the assignee
  chip — up from two, and an item nobody is assigned draws the same dashed invitation
  chip the row does rather than nothing. Risk stays a fifth kind that never reaches a
  card, an asymmetry this record states rather than resolves.
- **Every property cell's renderer states whether it drew anything**, not only the
  assignee's: `renderValue`, `renderTagCell`, `renderStateChip`, `renderHorizonChip` and
  `renderLabelChip` all return `boolean` now, and `renderCell` passes the answer through
  rather than choosing one kind to trust. State and horizon never reach a card today, so
  their answers are exercised by the tree's own tests only — correct because it is asked
  uniformly, not because either path is drop-tested.
- **A context (`outsideFilter`) card with nothing to show on a plain-value or tags cell
  now renders no cell at all**, where before it rendered an empty one — the same
  "nothing to show, show nothing" rule the label and horizon chips already gave an
  excluded row, extended to the two kinds that hadn't needed it because the tree's fixed
  columns made it invisible there.
- **ADR 0023's own decision is otherwise unchanged.** The properties menu is still the
  one source of what is a column and in what order, columns still drop from the end
  under a narrow pane, a dropped column is still absent rather than clipped, and state
  and horizon still stay off cards for the reason that ADR gives. Nothing here
  supersedes it; this narrows one bullet of it for the two kinds that bullet's own
  argument never covered.

## Alternatives

- **Show every chip kind on the card, state and horizon included.** This is exactly the
  first half of ADR 0023's already-rejected alternative, and nothing about the assignee
  changes that argument for the other two: a board card in the *Active* column would
  carry an *Active* chip, saying nothing a reader does not already know from where the
  card sits.
- **Add risk alongside the assignee, for symmetry.** They are in the identical
  position — a label chip with no positional meaning on any projection — and the
  argument in this record's Decision covers both equally. Left out anyway, because scope
  should match what was asked rather than what an argument would also justify; a PBI
  that wants risk on a card can cite this record and change one filter.
- **Keep the plain-value cell for the assignee instead of its chip.** Reachable, but
  read-only where every other property with a chip is a write surface from the card —
  and it would need its OWN emptiness rule, since `renderValue`'s "empty" already means
  something specific (no text either the value or `renderTo` produced), while the
  assignee chip's unset state is a deliberate invitation, never absence. Reusing the
  chip is one rule for both surfaces instead of two.
- **Give cards their own emptiness rule instead of asking the renderer.** A DOM read —
  `cell.textContent.trim() === ''` — looked equivalent and was not: a checkbox or an
  icon-only Bases value renders no text and is still a value to show, a distinction
  `renderValue` already makes, and a card-side re-derivation would have to make that
  distinction a second time or silently drop values on some fields. Asking the renderer
  its own answer is the one rule that cannot disagree with what it just drew.

## Revisit when

A second label-chip kind (risk, or a future one) is asked for on a card. The Decision's
rule already covers it — nothing changes but the one filter in `renderCardBody` — so
this section names the trigger rather than a design question still open.
