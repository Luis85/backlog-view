---
adr: 14
title: Rank extra types by type, not by position
status: Accepted
date: 2026-08-01
area: domain
---

# ADR 0014 — Rank extra types by type, not by position

## Context

`Issue` and `Bug` were asked for with a shape the ladder cannot express: both may hang
from an `Epic`, a `Feature` **or** a `PBI`, and both may hold only `Task`s.

Every level rule in the codebase is "one rung below the parent". That shape ties an item's
position to its contents — and here they are independent. A Bug holds Tasks whether it was
raised against an Epic or a PBI. A fifth rung would have to be *three* rungs at once.

## Decision

An **extra type** is a declared type that is **not a rung** **and holds the deepest level**.
Its rank is a property of the type:

> It ranks at `EXTRA_TYPE_RANK` — the rung whose children are the deepest level — always,
> and it has no `levelIndex`.

Everything asked for falls out of those two properties, which is why this framing beat a
table of legal parent/child pairs:

- **Children are always Tasks** — the rank is pinned, so the child level is the deepest one
  under an Epic exactly as under a PBI.
- **Nothing re-types it by position** — `levelIndex === -1` already means "not a rung", and
  the auto-type cascade has always left those alone as deliberate user data.
- **It may hang from Epic, Feature or PBI** — the child-type offer includes it under any
  real rung above the deepest, and not under a Task or another extra type, both of which
  hold only Tasks.

## Consequences

- No new rule was needed for "where may a Bug go" or "what may it hold". Two properties
  answered three requirements, and the offering logic is one function.
- The contrast that keeps it honest: an **unknown** custom type still takes its parent's
  next slot, so `Feature > Bugfix > implied Task` still works. **Declared pins, undeclared
  inherits.**
- The pin has to be applied at **every node of a walk**, not just at the item being moved.
  Applying it only at the root left a nested Bug untouched while its Tasks were rewritten
  to PBIs — the item correctly skipped, its children silently corrupted. Recorded as
  [[Nested extra type lost its pinned rank]].
- Anything that matches on `levelIndex` has to know extra types exist. Focus mode did not,
  and focusing the PBI rung made every Bug vanish rather than rank beside the level it
  sits level with.
- Membership tests must read **every declared type**, not just the ladder. Reading only
  levels dropped a parentless Bug out of the model — the note vanishing moments after being
  typed ([[Parentless extra type dropped from the model]]).
- One arbitrariness, accepted: an extra type ranks with the second-lowest level, so
  rollups, the level breakdown and hiding completed work treat it as that level. Right for
  a Bug beside a PBI; arbitrary in principle.
- Nothing is enforced. The rules decide what is *offered*; a drag may still put a Bug
  anywhere ([ADR 0009](0009-the-type-rules-are-advisory.md)).
- **Amended 2026-08-02 (Milestones).** "A declared type that is not a rung" is the
  **genus**, not the species. A marker is one too, and it occupies no rank at all — so the
  definition as first written classified a milestone as the very thing it is not, and
  pinned it at `EXTRA_TYPE_RANK` by that classification alone. The amendment is one
  clause: what makes an extra type an extra type is the **pinned rank whose children are
  Tasks**, and everything this record decides about `Issue` and `Bug` stands unchanged.
  The pin-at-every-node consequence above holds for markers in the opposite direction —
  the cascade **stops** at one, because there is no rank to descend from.

## Alternatives

- **A fifth rung.** Cannot express "three legal parents", which was the requirement.
- **A rules table of legal parent/child pairs.** Would have worked, and it is a table to
  maintain, to keep consistent with the ladder, and to consult from every site that asks a
  level question. Two properties beat a table because they *compose* with rules that
  already existed.
- **No new types; use tags.** A Bug is a work item that holds Tasks and needs a rank. A tag
  gives it neither.

## Revisit when

A third extra type is wanted with a *different* rank — the design assumes one rank for all
of them, and that is where it would first strain.
