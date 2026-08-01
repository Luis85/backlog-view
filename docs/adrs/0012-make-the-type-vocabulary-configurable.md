---
adr: 12
title: Make the type vocabulary configurable
status: Superseded
date: 2026-08-01
area: domain
superseded-by: 13
---

# ADR 0012 — Make the type vocabulary configurable

> **Superseded by [ADR 0013](0013-fix-the-type-vocabulary-at-six-names.md)** on the same
> day it shipped. Kept because why it was reversed is more useful than the reversal.

## Context

The ladder shipped as `Epic → Feature → PBI → Task`, which is one team's vocabulary.
Others say Initiative, Story, Sub-task; Scrum says Product Backlog Item where Azure DevOps
says User Story. Making the names a setting looked like the obvious courtesy — the same
courtesy the property *keys* already get, which can be pointed anywhere.

When `Issue` and `Bug` were added
([ADR 0014](0014-rank-extra-types-by-type-not-by-position.md)), the question came up again
for the new list, and the same answer was given: a view option, `Extra types`, defaulting
to `Issue, Bug`.

## Decision

Two view options — `Levels` (the ladder, in order) and `Extra types` — read into
`settings.levels` and `settings.extraTypes`, with the shipped values as defaults.

## Consequences

These are what killed it. Every one of them was real, and all of them arrived within a day:

- **Every level rule had to hold for any list a user could type.** A three-rung ladder, a
  one-rung ladder, an empty one. Every clamp, every "one below the parent", every focus
  target.
- **Collision rules between the two lists.** A name in both is meaningless; a name in
  neither is an unknown custom type with different behaviour. Deduplication, case rules,
  and a decision for each conflict.
- **"What folder does a name nobody chose get?"** Per-type folders
  ([[Where new items are filed]]) need a default per type. A type invented at runtime has
  no shipped default and no icon, so it fell through to a rotation colour and a neutral
  glyph — a first-class-looking badge for something the view knew nothing about.
- **The options schema had to be generated per view**, because the type list was itself an
  option, which made the schema depend on the config that the schema defines.
- Two P2 bugs in one day traced straight to it: a user-named type read off
  `Object.prototype` (twice, in two different tables) because the vocabulary was now
  arbitrary user strings.

And what it bought, in full: **a rename**.

## Alternatives

The one that won: fix the vocabulary and be opinionated.

## Revisit when

Never in this form. If naming becomes a real request, the shape to consider is a **display
alias** — a label shown instead of `PBI` — which changes what the user reads and nothing
about what any rule must hold for. That is a different decision and would get its own
record.
