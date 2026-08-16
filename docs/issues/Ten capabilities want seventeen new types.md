---
type: Issue
order: 110
parent: "[[A view per capability]]"
status: Open
priority: P1
area: domain
created: 2026-08-16
source: review of the epics derived from the product requirements document, 2026-08-16
files:
  - src/domain/itemTypes.ts
  - styles/badges.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Ten capabilities want seventeen new types

## The question

Read together, the epics derived from the 2026-08-16 requirements document ask for
`Opportunity`, `Assumption`, `Experiment`, `Problem`, `Objective`, `Outcome`, `Theme`,
`Vision`, `OKR`, `JTBD`, `Initiative`, `Evidence`, `Release`, `Portfolio`, `Product`,
`Domain` and `Decision` — **seventeen** names. The plugin declares **eleven** types today. Nobody wrote that number
down while writing the epics, which is exactly how a vocabulary triples without a decision.

Adding a type is not one edit. It is `ALL_TYPES` and `EXTRA_TYPES` in
`src/domain/itemTypes.ts`; `LEGAL_CHILDREN` and `EXTRA` in the register's own gate; the
hierarchy table in `docs/README.md`, which that gate checks both ways; a hue in
`styles/badges.css`, where **eight** theme families already carry nine badges and one pair
shares deliberately; a per-type creation folder key in the view options; and a row in every
menu that offers a child type. Seventeen of those is not a backlog — it is a different plugin.

## Why it is not obvious

The tempting answer is that each capability owns its own types and nothing collides. It does
not hold, for two reasons the register has already met:

- **`parent` decides level, rank, rollup and focus.** A type that is not work has no business
  in that map — which is why the test catalog got a ladder of its own and why dependency,
  coverage and strategic alignment are each **a property, not a second graph**. Most of the
  seventeen are in that category: an objective is not ranked among features, and an evidence
  note is not work at all.
- **A type is a promise about colour and menus, vault-wide.** Types are not scoped to the
  view that introduced them: a vault that adds Discovery gets `Opportunity` in every type
  menu the backlog view draws, and a badge that has to be told apart from ten others.
  [[The type palette has no unclaimed hue left]] and [[A badge when the palette is full]]
  bought a second axis for exactly two new types, explicitly refusing to close the question
  as a general answer for more.

## What a decision would look like

The default this register's own precedents point at: **a type is for something the tree
ranks; everything else is a note a property points at.** Applied here, that suggests three
buckets, and the work is to place each of the seventeen in one of them rather than to argue
them one at a time:

1. **No plugin type at all** — the note is addressed only by link, the way an ADR is. Likely
   home for evidence, objectives, outcomes, JTBD, decisions, portfolio levels: they are
   pointed at, never ranked.
2. **A type on a ladder of its own**, rooted at the top level, the way `Test suite` →
   `Test case` is. The discovery lifecycle is the only candidate that plausibly earns this,
   because a discovery item is walked as a list and has children.
3. **A new extra type beside the ladder**, paying the full cost above. `Release` is the one
   that may deserve it, since work points at it *and* it draws on the roadmap.

Whatever the split, the count that lands in bucket 3 is the number that has to answer the
palette question — and answering it once, as a rule, is the thing
[[A badge when the palette is full]] says a lone type must not do by itself.

## Acceptance criteria

- Each of the seventeen names is placed in one of the three buckets, in writing, before any of
  them is added to `ALL_TYPES`.
- The number reaching bucket 3 is stated, and the palette rule for that number is decided
  once rather than pair by pair.
- No capability epic ships a type until its bucket is recorded here — a view that needs one
  and does not have it is blocked on this issue, which is the honest order.
