---
adr: 10
title: Load excluded ancestors as context rows
status: Accepted
date: 2026-07-31
area: domain
---

# ADR 0010 — Load excluded ancestors as context rows

## Context

A Base filtered to `tag: sprint-12`, or to one level, returns the matches **without their
parents**. Rendered as a tree, that is a flat list of orphans: every match sitting at top
level, its place in the hierarchy gone. The filter that was supposed to narrow the question
has destroyed the structure that made the answer mean anything.

This problem is created by [ADR 0001](0001-build-on-the-bases-custom-view-api.md) — the
Base owns the query, and a useful backlog view must survive it being narrow.

## Decision

Walk each match's parent chain through the **metadata cache** and load the missing
ancestors from the vault. They render as **context rows**, flagged `outsideFilter`.

And one rule governs the whole feature:

> An `outsideFilter` row is never a write target, never a ranking peer, and never a source
> of anything derived from the Base's results.

It renders, it parents, and that is all.

## Consequences

- The tree keeps its real shape under any filter. This is the feature.
- **The view never writes to a note the Base excluded**, enforced structurally: the gate
  refuses the **whole batch** if any write targets one. It rejects rather than filters —
  dropping the offending write alone would apply the rest and leave the hierarchy
  half-updated.
- "Never a ranking peer" means never **written to** — but its `order` is still **read**,
  because the row is on screen and a rank that ignored it would place an item above
  something the user can see. That distinction, read-but-never-written, is the subtlest
  thing in this codebase, and [ADR 0032](0033-order-is-a-global-rank.md) sharpened it
  rather than softening it: a RANKED context row is a legal ANCHOR at the focus level, so
  a row may be dropped or moved by keyboard immediately before or after one and take a
  rank against its number. Nothing about it is written. What is still refused everywhere
  is moving the context row ITSELF, and the reason is unchanged — its real siblings were
  never loaded, so no reparenting can be aimed. An UNRANKED one is skipped instead of
  refused beside, since it constrains nothing and no command could ever give it a number.
- "Derived from the results" includes numbers computed *while walking the tree*: a rollup
  traverses **through** a context row and never counts it, so an excluded note's own state
  can neither skew a progress bar nor keep a finished subtree on screen.
- The UI withholds every control that would produce such a write — the state chip renders
  as static text, and Set type, Set state and the parent-link actions leave the menu.
- **Undo is the one deliberate exception.** Its authorization comes at *capture* time, not
  replay time, because the write being undone may be what moved a note out of the filter
  ([ADR 0015](0015-undo-by-captured-inverses.md)).
- Every past bug in this feature was a place that forgot the rule, never a new rule. So the
  test is written from the rule: one suite drives **every** write entry point against a
  fixture with context rows above, beside and between results, so a new write path fails
  without anyone predicting the surface.
- A context row is **not always an ancestor**: a filter returning an Epic and its PBI but
  not the Feature between them puts one *below* a result, so any subtree walk can meet one.
- The cost is that a large share of this codebase's complexity is this rule, and every new
  feature must be asked the question.

## Alternatives

- **Render matches flat.** Honest about what the query returned, and useless: a backlog
  without its tree is a list, which Bases already does better.
- **Widen the query to include ancestors.** Not ours to widen — the filter is the user's
  configuration, and silently returning rows they excluded would break every other thing
  reading that Base.
- **Load ancestors and treat them as ordinary rows.** The obvious version, and it writes to
  notes the user filtered out. Every guarantee above exists to prevent exactly this.
- **Make it optional and default off.** It is optional (`showOutsideParents`) and defaults
  **on**, because the flattened tree is not a lesser view — it is a wrong one.

## Revisit when

Bases can express "and their ancestors" in a filter, which would move this from the plugin
to the query where it arguably belongs.
