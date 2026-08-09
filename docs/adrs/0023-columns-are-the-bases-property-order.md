---
adr: 23
title: Columns are the Bases property order
status: Accepted
date: 2026-08-09
area: platform
---

# ADR 0023 — Columns are the Bases property order

## Context

Two things decided what a backlog row showed, and they disagreed about what "shown"
means.

The resolver read `config.getOrder()` — the Bases properties menu — and **subtracted**
the four properties this plugin renders specially: the requirements state key, the
resolved Deliverable state key, the horizon key and the risk key. Those four came back
as fixed columns pinned after the properties in a fixed order, each gated on its own
settings predicate rather than on the base's visibility. A `showProperties` view option
sat over the plain half alone as a third switch.

So a state chip rendered because `stateKey` was configured, in a position no user chose,
whether or not the property was visible in the base — and "which properties does this
view show" had two answers, of which the one the user was looking at was not
authoritative. The same split decided the drop order under a narrow pane: a hardcoded
usefulness ladder (properties, then the rollup, then horizon, then state) that the
header's own left-to-right order contradicted.

## Decision

**The Bases properties menu is the single source of what a row renders and in what
order** — plain properties and special ones alike. `resolveColumns` in
`src/view/render/columns.ts` walks `config.getOrder()`, drops only the ids that are the
view's own machinery (`file.name`, and the parent, order and type keys — the tree is the
parent column, the badge is the type, the title is the name), and tags each survivor
with a **kind**. The kind decides what is drawn *inside* a cell; it never decides whether
there is one.

Four rules follow from that one, and each is the answer to a question the old split
answered twice:

- **Configured is not shown.** A state, horizon, risk or tags property draws its chip
  when the menu shows it, in the position the menu gives it, and draws nothing anywhere
  when it does not.
  **Checked by** `test/view/columnKinds.test.ts` — "draws nothing for a configured property the properties menu does not show"
- **Narrowing is a count, not a ranking.** Columns drop from the END of the user's order:
  that order is the user's own statement of what matters, so a ranking of ours beside it
  is a second opinion about it. The rollup is not in the order — it is pinned past its
  end, so "last" would always pick it first — and drops after every column instead.
  **Checked by** `test/view/columns.test.ts` — "drops columns from the end of the order, keeping the rollup to the last"
- **A dropped column is not rendered**, rather than clipped. This is an accessibility
  decision, not an implementation detail: `overflow: hidden` clips a cell visually and
  leaves it in the accessibility tree, and the cells in question are exactly the ones
  with controls in them — an ordinary Bases value can render a native control, and the
  chips are `tabindex="-1"` buttons assistive technology reaches by design. Both would
  stay reachable inside a column the view claims to have dropped, and focusing one would
  scroll the strip out from under its header. The `display: none` ladder this replaces
  did not have that hole, so clipping would have been a regression introduced by the fix.
  **Checked by** `test/view/columns.test.ts` — "leaves nothing of a dropped column for a keyboard or a screen reader to find"
- **Cards draw the plain kinds only** — `value` and `tags`, filtered from the same
  resolved list rather than resolved a second time. A board card's column already IS its
  state and a bucket already IS its horizon.

## Consequences

- **A configured property draws nothing until the base shows it, and the plugin cannot
  fix that for the user.** This is the accepted cost of one authoritative source, and it
  lands hardest on first run: ✨ (`runInit`) binds a state, horizon, risk or tags
  property and stubs it onto every note, and the view still shows no chip. The only
  pointer is a clause in that action's success Notice — *add them in the properties menu
  to show them as columns.* A sentence is a weak fix for a missing half of a loop, and it
  is the strongest one available (see **Alternatives**).
- **Two state columns became legal**, because two visible state properties are two
  entries in the order. Each draws a chip only on rows whose own workflow it names and an
  empty cell on the others, and each takes its own property's display name — so
  `stateColumnLabel` and its "call it *State* when the two keys differ" fudge are gone.
  The fudge existed because one column held two properties; it no longer does.
- The change is net subtraction: `showProperties`, three chip-column width constants and
  the three CSS custom properties behind them, four of the five `pbl-hide-*` rules,
  `hasStateColumn` and `stateColumnLabel`. What is left is one width, one count and one
  boolean.
- **A saved base breaks**, in the small way
  [ADR 0016](0016-break-compatibility-freely-before-1-0.md) sanctions: a view that had
  `showProperties` off shows its visible properties again, recoverable in one click from
  the menu this change points the feature at.
- What got harder: a chip's absence now has two causes rather than one, and they look
  identical on screen. "My state chip vanished" is either an unconfigured `stateKey` or a
  property hidden in the properties menu, and only the second is a thing the user did to
  themselves recently. The view says nothing to tell them apart.
- One asymmetry was left rather than smoothed over, and is recorded as an open question
  in [[The rollup is hidden by class and headed by verdict]]: the rows still draw
  `.pbl-meta-col` from the configuration and let `pbl-hide-meta` hide it, while the
  header asks `columnFit.rollupDropped`.

## Alternatives

- **Keep the four specials settings-gated, and take only their POSITION from the menu.**
  Two rules where the point of the change is to have one: "is it shown" would still be
  answered by the settings and "where" by the menu, so hiding a state property in the
  menu would still leave its chip on every row. It also keeps the header order and the
  drop order free to disagree, which is the defect that made the old ladder confusing.
- **Keep the usefulness ranking for narrowing** (properties, then the rollup, then the
  horizon chip, then the state chip). Rejected because the ranking is an opinion about
  the user's own declaration: they put the columns in an order, and dropping from
  somewhere other than its end tells them that order was not what they meant. Dropping
  from the end also needs no list to maintain when a kind is added.
- **Draw the chips on cards too**, either all of them or all-minus-what-the-projection-
  expresses. The first repeats the card's own position as a chip inside it — a board card
  in the *Active* column carrying an *Active* chip. The second is a per-projection skip
  list to keep in step with every new projection, which is the kind of second opinion
  this whole record exists to remove.
- **Seed the visible order from the plugin**, so ✨ could show what it just bound and a
  scaffolded base would draw its chips immediately. Refused because the API does not
  offer it: `BasesViewConfig` exposes `getOrder()` and no setter, and `set()` is
  documented for the view's own options — checked against the 1.13.1 typings rather than
  assumed. Writing an `order:` list into the scaffolded `.base` from
  `storage/baseFile.ts` is the one variant not ruled out, and it is unanswerable here:
  whether Bases keeps an order entry naming a property no note carries yet is a
  live-vault experiment.

## Revisit when

Bases exposes a way to set or seed a view's visible property order. That is the one
refusal above resting on "cannot" rather than on "costs more than it is worth", and it is
what would turn the ✨ Notice's closing sentence into a write.
