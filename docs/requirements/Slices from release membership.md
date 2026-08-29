---
type: PBI
parent: "[[Slices across the map]]"
order: 10
status: Open
created: 2026-08-19
source: backlog breakdown of [[Storymaps]], 2026-08-19
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

# Slices from release membership

**As** someone deciding what ships, **I want** the map's rows to be the releases, **so that**
the picture I show and the scope I committed to are the same fact.

The rows come from the release-membership property [[Release Management]] already specifies, so
this use case stores nothing new. What it owns is the row *order* and the rule that the map
reads that property without ever becoming a second place it is decided.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading the map |
| **Trigger** | The map drawing its slice rows |
| **Preconditions** | The release-membership property is configured |
| **Guarantee** | A slice row is a release note the results point at, and a card appears in exactly one row. Drawing the slices writes nothing, and no release note is edited to draw it. |

**Main flow**

1. The view collects the releases the map's cards point at.
2. It orders those rows by each release note's own `order`.
3. It draws one row per release, labelled with the release note's name, and places each card
   in the row its property names.

**Extensions**

- **1a — the membership property is not configured.** The map draws its backbone and cards
  with no slice rows at all, and the empty state offers what to bind. Rows are absent, not
  empty.
- **1b — a release note the cards point at is not in the results.** The row still draws,
  labelled from the link, and it is never a write target — the context rule, applied to a row.
- **2a — two releases share an `order`.** The tie is broken by a stable second key, so the rows
  do not reorder between renders.
- **2b — a release note has no `order`.** Its row draws after every ordered one rather than
  being read as zero.
- **3a — a release has no cards on this map.** Its row is absent. The map draws the rows its
  cards need, not every release in the vault.

## Acceptance criteria

- With the membership property unconfigured, no slice row is rendered — absent, not empty.
- Row order follows the release notes' `order`, is stable across renders, and puts an
  order-less release last rather than first.
- A release row whose note the base excluded draws and accepts no write; a batch targeting it
  is refused whole.
- No release note is written to by anything in this use case, asserted by a spy on the write
  path rather than by reading the vault after.
- A release with no cards on the map produces no row.

## Where it lives

The rows are derived in this epic's projection module in `src/domain/`, from the membership key
that `src/domain/optionalProperties.ts` holds and `src/domain/viewOptions.ts` surfaces.
`src/view/render/lanes.ts` is the precedent for a labelled band and `styles/lanes.css` for its
layout. Nothing here reaches `src/storage/` at all, which is the guarantee.
