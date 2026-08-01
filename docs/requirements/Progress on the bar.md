---
type: PBI
parent: "[[Hierarchy on the roadmap]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/model.ts
  - src/view/render/columns.ts
---

# Progress on the bar

**As** someone reading a roadmap bar, **I want** its fill to show how much beneath it
is done, **so that** "how far along" travels with "when" instead of living in another
view.

Fill-equals-completion is the one rendering every surveyed tool shares — Linear's bars
fill by issue completion, Aha! colors progress onto releases, Jira draws progress per
epic — and the number here is already computed: the done-over-total rollup the tree
shows ([[Rollups and hiding finished work]]). The count is honest about being a count:
Jira's own community documents how one done story of two reads as half even when it was
the small one, and the trackers' answer is an estimate field this schema does not have.
Counting what exists beats estimating what does not, and a stored percentage is the
thing that drifts.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | A roadmap bar or card renders for an item with descendants |
| **Preconditions** | Roadmap mode is on |
| **Guarantee** | Progress is derived at render from the same rollups the tree shows — never stored, never counting a context row — so every projection reports the same number for the same item. |

**Main flow**

1. A parent's bar or card fills by the done share of its counted descendants, and
   carries the same done-over-total the tree's rollup column shows.
2. A done item styles done, and a fully done subtree follows "Show completed items"
   exactly as it does everywhere else.
3. Context rows pass through uncounted — the rollup walk's own rule, which the register
   already drives with an invariant test.
4. Health, where a team wants it, is a hand-set property rendered as a chip like any
   other property — the surveyed trackers treat health as a judgement, and nothing here
   computes one.

**Extensions**

- **1a — the item is a leaf.** No fill and no counts render — the tree's rule for the
  rollup column, unchanged: an empty measure is not a zero.
- **1b — the user expects story points.** Counts are what exist: the schema has no
  estimate field, and the fill says what it counts. If estimates ever arrive, the
  fill's source is one derivation to widen — the reason the trackers make the
  calculation configurable — but a measure must never imply data nobody recorded.
- **1c — no state property is configured.** There is no done to count, so no fill
  renders and no percentage is implied: the bar carries the descendant count the
  tree's rollup column shows in exactly this configuration. A fill without a workflow
  would report every subtree as unstarted, which is a claim nobody made.
- **2a — "Show completed items" is off and the subtree is done.** Bar, card and any
  context row that stood only for it hide together; restoring the option restores
  them — the two narrowings rule the board states.
- **3a — a context parent's own fill.** It describes its visible results only — stated
  once in the model's walk and inherited by every projection that reads it.

## Acceptance criteria

- A parent's fill and counts equal the tree's rollup for the same item — derived at
  render, stored nowhere, identical across projections; with no state property
  configured, no fill renders and the descendant count is the whole report, as in
  the tree.
- Leaves render no fill and no counts.
- Progress is count-based and says so; no estimate machinery is invented, and no
  percentage is ever written to a note.
- Context rows are never counted, and a context parent's fill describes its visible
  results only.
- Done styling and completed-hiding follow the same rules as the tree and board;
  health is a hand-set property chip, never computed and never required.

## Where it lives

**Nothing yet — this note is design.** The numbers are the rollup fields
`src/domain/model.ts` already assigns; the fill is a renderer over them beside the
rollup column in `src/view/render/columns.ts`, so the roadmap adds a drawing, not a
second answer to how far along anything is.
