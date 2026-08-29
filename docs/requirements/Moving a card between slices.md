---
type: PBI
parent: "[[Moving a card on the map]]"
order: 20
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

# Moving a card between slices

**As** someone deciding what ships, **I want** to drag a card into another release row, **so
that** changing the scope of a release is one gesture on the picture I am already looking at.

A vertical move writes one value into one user-named property — the same write shape
[[Moving between horizons]] and [[Drag a card to a new state]] both specify, on the release
property [[Release Management]] owns. One host method, three inputs.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dropping a card in another slice row, or picking the release from the keyboard or the context menu |
| **Preconditions** | The release-membership property is configured, and the card is a result |
| **Guarantee** | A slice move writes exactly one value to the card's own release property, through the same gate as every write, undoable as one batch. The card's step, and therefore its column, does not change. |

**Main flow**

1. The user drops a card in another slice row.
2. The one host method plans the one write: the target release, into the membership property.
3. The gate applies it, and the card renders in its new row on the write's own refresh.
4. The move is announced once, from that method.
5. Undo takes it back as one batch.

**Extensions**

- **1a — the drop lands in the row the card is already in.** No write is planned and the undo
  slot is not consumed.
- **1b — the user cannot drag.** The keyboard and the context menu offer the releases and write
  the identical batch. A menu entry is checked exactly when picking it would write nothing —
  asked of the plan, never of a comparison written beside it.
- **1c — the target row's release note is outside the base's filter.** The row draws and the
  move to it is withheld.
- **1d — the card is outside the filter.** No move is offered, and a batch naming it is refused
  whole.
- **2a — the membership property is not configured.** No slice rows exist, so no such move can
  be started; the empty state offers what to bind.
- **2b — the target is the unsliced row.** The key is removed rather than written empty, which
  is [[Cards with no slice]]'s flow rather than a second rule here.
- **3a — the write takes the card out of the base.** A filter may name the release property, so
  a legitimate move can make its own card vanish. That is the open question recorded in
  [[The outcome report was built from one sentence]], and this use case does not reopen it.

## Acceptance criteria

- The drag, the keyboard and the menu produce byte-identical batches.
- The batch names the release property alone; the card's `parent` and `order` are unchanged, so
  a slice move never changes the column.
- The menu's checkmark is derived from the plan being empty, and a fixture whose card holds a
  release the reader refuses does not show the unsliced entry as current.
- A drop in the card's current row plans nothing and leaves the undo slot untouched.
- A move whose target release note the base excluded is not offered, and is refused whole if
  constructed.

## Where it lives

The same shared half as the step move — `applyCardMove` in `src/view/cardMoves.ts`, one host
method in `src/view/host.ts`, three inputs in `src/view/interactions/cardDrag.ts`,
`src/view/interactions/keyboard.ts` and `src/view/interactions/menu.ts`. The write is a label
property, so it is planned in `src/domain/writePlan.ts` against
`src/domain/optionalProperties.ts` and applied by `applyLabels` in
`src/storage/frontmatter.ts`, over `src/view/writeGate.ts`. The checkmark is asked of the plan
in `src/view/interactions/menu.ts`.
