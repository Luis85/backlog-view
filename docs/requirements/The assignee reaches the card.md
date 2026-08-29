---
type: PBI
parent: "[[Assignment]]"
order: 20
status: Done
priority: P2
created: 2026-08-12
source: user request
files:
  - src/view/render/board.ts
  - src/view/render/columns.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-12
due: 2026-08-12
risk: ""
assignee: ""
iteration: ""
---

# The assignee reaches the card

**As** someone reading a board rather than a list, **I want** to see who is on an item
without opening its row in tree mode, **so that** switching to a board costs me nothing
about who has the work — the same promise [[What a card shows]] already makes for a
plain property and a tag.

[[Setting the assignee on an item]] gave the row its chip; [[What a card shows]] gave a
card every plain value and every tag the same row draws, but drew no chip of any kind,
bundling the assignee in with state and horizon under one argument that only fit two of
the three. Reading who is assigned is exactly the kind of thing a board reader wants
without switching modes — the same case a state COLUMN already makes, just for a
property no column position can say by itself.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner reading a board or a roadmap |
| **Trigger** | The board or roadmap renders a card |
| **Preconditions** | An assignee property is named, and it is one of the Base's visible columns |
| **Guarantee** | The card's chip shows what the row's chip shows and opens the identical menu — one builder behind both, so they cannot disagree about who is on the item or what picking a name would do. |

**Main flow**

1. The board or roadmap places the item's card.
2. The card renders its assignee chip, from the same resolved column list the row reads —
   `renderCardBody` now keeps the `assignee` kind beside `value` and `tags` where it once
   dropped every chip kind.
3. The chip names who the note says, or invites a name where nobody is assigned yet.
4. Pressing it opens **Set assignee** — the row's own builder — with the item's current
   name checked.
5. Picking a name writes it exactly as the row's chip does: one batch, one undo.

**Extensions**

- **1a — the assignee property is unconfigured, or not a visible column.** No chip, on
  the card or the row alike — the same absence [[Setting the assignee on an item]]
  extension 7a already gives the row, asked of the one resolved list both projections
  share.
- **2a — state or horizon is also a visible column.** Neither draws a chip on the card;
  only the assignee crosses over. A board card's column already IS its state and a
  bucket already IS its horizon, so either chip there would repeat what the card's own
  position says — the assignee has no such equivalent on any projection
  ([ADR 0027](../adrs/0027-label-chips-with-no-positional-meaning-also-draw-on-cards.md)).
- **3a — nobody is assigned.** The chip is dashed, reading "Assignee" — the row's own
  invitation, not an absence, so it draws exactly as it would on the row and is never
  mistaken for an empty cell with nothing to show ([[What a card shows]] extension 3c).
- **3b — the card is a context card, outside the Base's filter.** The chip is static,
  showing the name if there is one and nothing at all if there is not — the row's own
  rule for an excluded item, asked of the card instead.
- **4a — the pane is a card projection with no keyboard focus on the chip.** The card
  menu carries **Set assignee** too, the documented keyboard path every other per-card
  control already has.

## Acceptance criteria

- With an assignee property named and visible, every card — board, roadmap bucket, and
  the shelf, since all three share `renderCardBody` — draws the assignee chip, and
  pressing it opens the same list, with the same entry checked, the row's own chip
  offers.
- State and horizon still draw no chip of any kind on a card; only the assignee crosses
  from the row.
- An unassigned item's card draws the dashed invitation chip, never an empty cell and
  never nothing.
- A context card shows the assignee statically where it has one, and nothing where it
  does not.
- **Checked by** `test/view/columns.test.ts` — "draws no state, horizon or risk chip on
  a card, but does draw the assignee chip" and "keeps the assignee's own dashed
  invitation chip on a card — unset is not empty".
- **Not checked here:** how the chip reads in a themed vault. The jsdom suite asserts
  markup; the browser harness draws it without asserting.

## Where it lives

`renderCardBody` in `src/view/render/board.ts`, which every card-drawing caller shares
(`src/view/render/roadmap.ts`'s buckets, `src/view/render/shelf.ts`'s shelf) — one filter
change reaches all three. The chip itself is unchanged: `renderLabelChip` in
`src/view/render/columns.ts`, the same renderer and the same `Set assignee` builder
(`src/view/interactions/labels.ts`) the row already used. The architectural argument for
crossing this one chip kind over while leaving state, horizon and risk where they were is
[ADR 0027](../adrs/0027-label-chips-with-no-positional-meaning-also-draw-on-cards.md),
which also owns the empty-cell rule this PBI's extension 3a leans on.

Driven in `test/view/columns.test.ts`, beside the suite's other card-vs-row filter
assertions.
