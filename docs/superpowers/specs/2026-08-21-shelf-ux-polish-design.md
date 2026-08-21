# Shelf UX/UI polish — design

Four changes to the shelf, in one pass because they share a surface and three of them
share a stylesheet. Every number below was measured in `npm run harness` under headless
Chromium at a 1400px pane, on the demo backlog's twenty unplaced items, unless it says
otherwise.

## 1. The resize grip is not at the band's foot

**Reported**: with everything inside the shelf collapsed and a height picked, the grip sits
under the last section rather than at the bottom of the band.

**Root cause**: `position: sticky` never MOVES an element. It holds one inside its
scrollport when scrolling would carry it away, and does nothing otherwise. The grip is the
band's last flex item, so with a picked height and content shorter than it, flow puts the
grip directly under the last group and sticky has no reason to act. Measured with every
type group folded and a 400px pick: the grip's bottom sits **139px above** the band's
foot.

**Fix**, one declaration in `styles/shelfControls.css`:

```css
.pbl-shelf-sized .pbl-shelf-grip { margin-block-start: auto; }
```

Scoped to `.pbl-shelf-sized` — the class `publishShelfHeight` already puts on exactly when
it puts a height on — for two reasons, not one. An unpicked band is `height: auto`, so its
grip is already at the foot and there is no free space for an auto margin to consume; and
scoping keeps the existing `margin-block-start: calc(-1 * var(--size-4-2))` gap-cancel in
force there, so the content-sized band's measured height does not move by 8px and
extension 1e's number stands. Measured: **−139px → −5px** on the sized band (−5px is where
the grip sits when the band overflows, so the two states now agree), **219px → 219px** on
the unpicked one.

On an overflowing band the auto margin resolves to 0 and sticky pins the grip exactly as it
does today.

## 2. The iteration board's shelf carries the same picks

Today `renderIterationShelf` passes `picks: false`, and
[[Cards or a list on the shelf]] extension 1b states the reason: the keyboard path for
these controls is the card menu's shelf section, which is built for the roadmap alone. The
pickers may not appear on a board until that path does.

**What changes**

- `renderIterationShelf` (`src/view/render/iterationBoard.ts`) passes `picks: true`.
- `showTypeMenu` and `runSearch` (`src/view/render/shelfControls.ts`) resolve the shelf
  that is on screen rather than reading `host.roadmap` — the fallback `refocus` beside
  them already performs. One resolver, used by all three, so the three cannot come to
  disagree about which band they are acting on.
- `addShelfSection` (`src/view/interactions/menu.ts`) drops its
  `projection !== 'roadmap'` refusal and learns the iteration board: its card list from the
  board's snapshot, and its collapsed question from the `'backlog'` column fold rather than
  from `host.shelfCollapsed`, which is the roadmap's own bit.
- `BoardSnapshot` (`src/view/host.ts`) carries the shelf's cards beside its `shelfEl`, so
  the menu reads what was drawn instead of re-deriving it — the roadmap's snapshot already
  does exactly this.
- `renderIterationBoard` calls `syncShelfTabStops` for its own band. The board is a
  composite whenever it draws a column, which is always, so this resolves to `-1` today;
  it is called anyway because the rule is about the pane's state rather than about which
  projection is drawing, and a caller that omitted it would be one refactor from a trap.

**The picks stay one set of values**, shared by both bands, exactly as the height already
is ([[Resizing the shelf]], "one band, one value"). A search typed on the roadmap therefore
narrows the iteration board's shelf too. That is the same bargain the narrowing rule
already strikes: each narrowing says on its own face that it is one, and the board now
draws the box with the text still in it and the filter button still active.

`renderShelf`'s narrowing rule then applies the search and the hidden types on the board
because `picks` is true there — which is the rule working, not an exception to it.

## 3. The list layout draws aligned columns

Today a compact row is a content-sized flex line, so nothing lines up between rows.
Measured over twenty rows: titles begin at **4 distinct x positions**, state chips at 4,
median row height 34px.

**What it becomes** — the tree's own anatomy, which is where this codebase already keeps
its answer to "aligned columns":

- `renderCardBody`'s cells are drawn with `dropEmpty: false` in list mode, so every row
  carries a cell for every column the shelf draws and a missing value is a held-open gap
  rather than a shift. That is the TREE's rule for the same reason: a fixed-width,
  header-aligned column cannot skip a row.
- The cells take the stored `--pbl-prop-w-N` widths. `.pbl-card .pbl-prop` turns those off
  for a card, correctly — a card stacks its cells and sizes each to content — and list mode
  is the case where that argument does not hold.
- The badge takes a reserved slot of its own, so every title starts at one x.
- A hairline `border-block-end` per row, a hover background, the state chip last.
- Group headers become structure: sticky to the band's scrollport, filled, with the count
  in a pill.

**The band publishes its own geometry, and this is the correction that matters.** The first
draft said the row would read the tree's `--pbl-meta-col` and `--pbl-prop-w-N`, which is
wrong twice over (Codex, PR #187).

`renderTree` (`src/view/render/reconcile.ts`) is the ONLY publisher of `--pbl-prop-w-N`, and
`renderPass.ts` runs it for `tree` and `catalog` alone. `.pbl-tree` is built once in the
constructor and only emptied per pass, so its inline style outlives every render: a saved
view opened straight into roadmap or iteration mode has no such variables at all and every
cell falls back to 132px, while one that visited the tree first inherits whatever that pass
left. Geometry that depends on projection history. The harness measurement did not catch it
because the harness mounts into the tree and `?view=` switches afterwards — the numbers are
real and the mechanism behind them was not what this said.

So `renderShelf` publishes `--pbl-prop-w-N` on the BAND, per render, from
`columnWidth(host, column.prop)` — the same function and the same stored value the tree
publishes from, so a column resized in tree mode agrees here rather than being a second
reading. The publish loop is extracted so there is one statement of it and the two cannot
drift.

`--pbl-meta-col` is not borrowed at all, which is the second half. Its width is
`metaColWidth(chars)` — a reservation for the ROLLUP LABEL, not for the badge — so reusing
it would size the shelf's badge column by a number that means something else, and by the
TREE population's rollup at that. The band reserves `--pbl-shelf-badge` instead, from the
widest label in `ALL_TYPES`: a fixed vocabulary rather than the band's current cards, so the
slot does not resize when the last Deliverable leaves and shift every row with it. A badge
whose type is outside that vocabulary truncates inside the slot rather than pushing its own
title.

**Narrow panes are answered by controlled shrinkage** (also Codex, PR #187): `columnFit` is
cleared for every card projection, so no column is ever dropped here, and a fixed width per
cell would hand the band the horizontal scrollbar [[The shelf, organized]] removed. The
cells are `flex: 0 1 var(--pbl-prop-w)` with `min-width: 0`, and the title's basis is **0**
rather than `auto` — with `auto` the basis is the title's own text width, so two rows
resolve their cells differently under one deficit and the alignment holds at a wide pane
and comes apart as it narrows. At basis 0 every row's flex configuration is identical and so
is every resolved column, at any width. The title's existing `min(16ch, 40%)` floor still
decides who yields first. This is measured across 1400/760/480/380px before the change
lands, not argued.

Measured on that layout: **median row height 34px → 28px**, title x positions **4 → 1**.

Two alternatives were mocked and rejected against the same fixture. A muted second meta
line took the row to **80px**, which is not a list. Revealing the property cells on hover
alone read beautifully at rest and puts the data out of reach of a touch device and of a
screenshot.

**Not subgrid.** It was the first attempt and it cannot work here: `.pbl-card` carries
`content-visibility: auto`, which forces an independent formatting context, and a grid
container in one has `grid-template-columns: subgrid` computed to `none`. Measured — the
card reported a single 1272px track and every row stacked. Recorded so the next reader
does not spend the same hour.

## 4. Children on a list row

**What is wrong**, three things rather than the indent alone:

1. The disclosure is a line of its own even while shut, so a parent row is 48px where
   every other row is 28px — the rhythm breaks on exactly the rows carrying the most.
2. It sits flush with the card's left edge, further left than the badge column of the row
   it belongs to, which is what makes it read as a sibling.
3. `margin-top` separates it from its own row, and nothing connects the children back up.

**What it becomes**: the chevron and its count move onto the line, into a leading fold slot
before the badge — the tree's idiom, and the reason a tree row costs one line whether or
not it has children. The expanded list stays the card's own child and falls beneath,
indented so a child's badge begins at the parent's title, with the tree's own 1px indent
guide down the group.

`renderCardChildren` gains one optional element, `toggleEl`, saying where the disclosure
goes when that is not the wrapper — the same shape and the same reason as `renderCardBody`'s
existing `kidsEl`. The shelf's compact row is its only caller: the summary takes the
toggle, the card keeps the list. Nothing about a card-grid card changes; both parameters
resolve to the same element there.

Every list row reserves the slot, occupied or not, so the badges stay on one x. Measured:
leaf rows 29px, parent rows 29px, badges at **1** x position.

The count keeps its own text in the slot as a bare number, and the sentence
(`childrenLabel`) stays the toggle's tooltip and its accessible name, which is what
`aria-labelledby` points the list at.

## Testing

`npm run check` is the gate; what is added under it:

- **The grip.** A jsdom test cannot lay out, so the assertion is on the stylesheet's own
  rule for the sized band, and the geometry is the harness measurement recorded above.
  Watched failing with the declaration removed.
- **The picks on the board.** `test/view/iterationShelf.test.ts` gains: the header draws
  the four controls, the search and the type filter narrow that band, and the card menu's
  shelf section opens on an iteration board card. The last one is the keyboard path, and
  without it the feature would ship pointer-only.
- **`dropEmpty` in list mode.** `test/view/shelfLayout.test.ts` — a row with no value for a
  configured column still carries that column's cell. Watched failing.
- **Children.** `test/view/cardChildren.test.ts` — in list mode the toggle is inside the
  summary and the list is not; in card mode both are in the wrapper, unchanged.

Appearance in a themed vault is not a question this repository can answer (ADR 0020), so
the live-vault sweep is still owed for all four.

## Register

- [[Resizing the shelf]] gains an extension for the sized band whose content is shorter
  than it, and a bug note records the sticky misreading.
- [[Cards or a list on the shelf]] extension 1b is rewritten: the iteration board's shelf
  now draws the picks, and the note states the keyboard path that made it possible.
- [[The shelf, organized]] states that the picks are one set of values across both bands.
- The list layout's own acceptance criteria move from "one line whatever it carries" to
  the aligned-column guarantee, with the two rejected alternatives and the subgrid
  refusal recorded.
