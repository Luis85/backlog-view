---
adr: 8
title: Rank siblings with fractional orders
status: Accepted
date: 2026-07-30
area: domain
---

# ADR 0008 — Rank siblings with fractional orders

## Context

The rank lives in the notes ([ADR 0002](0002-keep-the-hierarchy-in-frontmatter.md)), so
every reorder is a write to disk. A backlog is reordered constantly and can hold hundreds
of items in one sibling group.

If rank were an index, moving one item to the top of a group of two hundred would rewrite
two hundred notes — two hundred lines in the vault's history, two hundred files for a sync
client, every time someone changes their mind.

## Decision

**`order` is a fractional rank within a sibling group**, not an index. A drop between two
items takes the **midpoint** of their two orders. New orders are spaced (not consecutive)
precisely so midpoints exist.

When a gap closes below a minimum, **the whole group renumbers** to spaced values. That
branch is expensive and rare, and it is the price of the common branch being one write.

## Consequences

- The common case — any single move — is **one note changed**. That is the whole point.
- The vault's history stays readable: a reordering session shows as the moves that
  happened rather than as churn.
- Renumbering exists, so no code may assume orders are stable across a drop, and undo has
  to be able to take a whole-group rewrite back
  ([ADR 0015](0015-undo-by-captured-inverses.md)).
- Orders are **sibling-scoped**, so two items in different groups may hold the same number
  and it means nothing.
- A missing `order` sorts last, in the Base's own result order — so an unranked backlog
  still renders in whatever order the user's Bases sort gives, and adopting the plugin does
  not require ranking everything first.
- Renumbering is **refused** when the group holds a row the Base excluded, because its real
  siblings were never loaded; the item is appended instead
  ([ADR 0010](0010-load-excluded-ancestors-as-context-rows.md)).
- A known limitation follows from that same partial knowledge: in a filtered base, an
  insert can compute an order equal to an excluded sibling's. Equal orders fall back to
  the result order, and the group self-corrects on the next renumbering drop. Recorded in
  [[Duplicate orders in a partially filtered group]].
- Rounding matters: orders are rounded to four decimals, well past the gap that triggers
  renumbering, so repeated midpoints cannot drift into float noise.

## Alternatives

- **Integer index per sibling.** Simple, verifiable, and it rewrites the group on every
  move — the exact cost this design exists to avoid.
- **A linked list** (`after: [[note]]`). One write per move and no renumbering ever — and
  reading the order becomes a graph walk that a broken link severs, sorting cannot be done
  by Bases, and a dangling `after` silently loses everything behind it. The failure mode is
  catastrophic where a bad number is merely wrong.
- **LexoRank / fractional strings.** No renumbering at all, and the rank stops being a
  number a human can read or a Bases sort can order. Both matter more here than avoiding a
  rare batch write, because the rank is in the user's own notes.
- **Rank held outside the notes.** Contradicts [ADR 0002](0002-keep-the-hierarchy-in-frontmatter.md).

## Revisit when

Renumbering is observed firing often enough to be noticed — the spacing constant is the
dial, and it has never needed turning.
