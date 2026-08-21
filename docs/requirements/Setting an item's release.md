---
type: PBI
parent: "[[Putting work in a release]]"
order: 10
status: Open
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Setting an item's release

**As** a backlog owner, **I want** to put an item in a release, or take it out, from wherever
the item already is, **so that** committing one thing to a version does not mean opening
another screen to do it.

Nothing yet. The write is a label property, so it is the same shape
[[Moving between horizons]] and [[Moving a card between slices]] both specify: one host
method, three inputs, one gated batch.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Picking a release from an item's context menu, from the keyboard, or dropping the item on a release |
| **Preconditions** | The membership property is configured, and the item is **plan work** the Base returned |
| **Guarantee** | Exactly one value is written to the item's own membership property, through the same gate as every write, undoable as one batch. Nothing else about the item changes — not its parent, not its order, not its state. |

**Main flow**

1. The user picks a release for the item.
2. The one host method plans the one write: the picked release, into the membership property.
3. The gate applies it, and the item renders with its new membership on the write's own
   refresh.
4. The move is announced once, from that method.
5. Undo takes it back as one batch.

**Extensions**

- **1a — the item is already in the picked release.** No write is planned and the undo slot is
  not consumed. The menu entry is checked exactly when picking it would write nothing — asked
  of the plan, never of a comparison beside it.
- **1b — the user picks "no release".** The key is removed rather than written empty, because
  an empty string is a value and an item in no release has none.
- **1c — the user cannot drag.** The keyboard and the context menu offer the same releases and
  write the identical batch.
- **1d — the target release note is outside the Base's filter.** It is not offered, and a batch
  naming it is refused whole.
- **1e — the item is outside the Base's filter.** No such action is offered on it, and a batch
  naming it is refused whole — the context rule, at the entry point and again at the gate.
- **1f — the row is not plan work** — a `Milestone`, an `Iteration`, another `Release`, or a
  note from the test catalog. The action is not offered and a batch naming it is refused, the
  same eligibility `Set iteration` already applies. **The membership reader refuses it too**:
  a release property hand-written onto a marker does not put the marker in the scope, because
  a release holds work and those notes are not work. Refusing at only one of the two ends
  would let a hand-edit do what the menu will not.
- **2a — the membership property is not configured.** The action is absent from every menu
  rather than present and inert, and the release view's empty state says which option to bind.
- **2b — several items are selected.** One batch names them all, planned by the same method,
  and it is refused whole if any of them is outside the filter — which is
  [[Bulk edits on a selection]]'s rule, not a second one here.
- **3a — the write takes the item out of the Base.** A filter may name the membership
  property, so a legitimate write can make its own row vanish. That is the open question
  recorded in [[The outcome report was built from one sentence]], and this use case does not
  reopen it.

## Acceptance criteria

- The menu, the keyboard and the drag produce byte-identical batches.
- The batch names the membership property alone: `parent`, `order` and the state key are
  unchanged by it.
- Picking the release the item is already in plans nothing and leaves the undo slot untouched.
- Picking "no release" removes the key; it never writes an empty value.
- A target release the Base excluded is not offered, and a batch naming it — or naming an
  excluded item — is refused whole rather than partly applied.
- No release action is offered on a `Milestone`, an `Iteration`, a `Release` or a test-catalog
  note, and such a note carrying a membership value by hand is in no release's member count.
- Two releases whose notes share a basename are distinguishable in the picker and resolve to
  the file that was picked — a fixture with `Releases/2.4` and `Archive/2.4` writes a link
  that resolves to the chosen one.
- With the membership property unconfigured, no release action appears in any menu.

## Where it lives

One host method in `src/view/host.ts` over `src/view/cardMoves.ts`, reached from
`src/view/interactions/menu.ts`, `src/view/interactions/keyboard.ts` and
`src/view/interactions/cardDrag.ts`. The write is a **link**, not a label:
the plan carries the target `TFile` and `src/storage/frontmatter.ts` spells it with
`wikilinkTo` from the editing note's own path, exactly as it already does for the iteration —
a plain string would let Obsidian resolve two same-named release notes to the wrong one. It is
planned in `src/domain/writePlan.ts` and applied over the gate in `src/view/writeGate.ts`; the
eligibility predicate is `src/domain/itemTypes.ts`, and the selection case reuses
`src/view/selection.ts`.
