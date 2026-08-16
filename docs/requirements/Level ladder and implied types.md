---
type: PBI
parent: "[[Work item hierarchy]]"
order: 20
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
---

# Level ladder and implied types

**As** someone who already has a folder of notes, **I want** them to read as a levelled
hierarchy before I have typed a single one, **so that** I can see the shape of my backlog
first and tidy the properties afterwards, rather than the other way round.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The view assigns each item a level while building the tree |
| **Preconditions** | Items have been linked into a parent/child tree |
| **Guarantee** | An implied level is never written to disk by rendering it. It is a display until the user asks for it — see [[Backfill missing properties]]. |

**Main flow**

1. `type` names a rung on a fixed ladder: `Epic → Feature → PBI → Task`.
2. An item whose `type` is a rung takes that rung.
3. An item with no `type` takes the rung **one below its parent's**, clamped at the
   deepest — so a child of a PBI is a Task, and so is a child of that Task.
4. The implied badge renders dashed, and its tooltip says the level was implied from
   position and how to write it for real.

**Extensions**

- **2a — `type` names something that is not a rung** (`Spike`, `Chore`). The item keeps
  its own name on the badge and occupies its parent's next slot, so the ladder carries
  on beneath it. Nothing rewrites it: not rendering — the view does not know what the user
  meant, and a view that renames unrecognised things is worse than one that carries them —
  and no longer any write path either. One did until 2026-08-11: an opt-in cascade
  preserved an unknown type everywhere *except* on the item the user had just dragged. The
  asymmetry was recorded rather than defended, and then removed rather than resolved
  ([[Assigning type on a move]]).
- **3a — the item has no parent.** It is an `Epic`: the top of the ladder is the only
  level a root can imply.

**Guarantees**

- Level maths chains down the **parent's** level, never down visual depth. Focus mode
  re-roots depth, so the two are not the same number, and taking the wrong one re-types
  half a backlog. This is a lint rule, not a convention.

## Acceptance criteria

- Level maths chains down the parent levels, never down visual depth (focus mode re-roots
  depth) — enforced by lint.
- An unknown custom type keeps its name and occupies its parent's next slot, and nothing
  rewrites it — not rendering, and not any move. `Set type` and the backfill on a note
  carrying no type are the only things that write a `type` at all.
- The ladder is **not configurable**, on purpose: every rule here would otherwise have
  to hold for any list a user could type, and the reward was a rename.
- An implied level is visibly implied, and says how to make it real.

## Where it lives

`src/domain/itemTypes.ts` (the ladder, `childLevelIndex`) ·
`src/domain/model.ts` (`computeLevel`) · `src/view/render/rows.ts` (the badge).
Tests: `test/domain/itemTypes.test.ts`, `test/domain/model.test.ts`,
`test/view/rendering.test.ts`.
