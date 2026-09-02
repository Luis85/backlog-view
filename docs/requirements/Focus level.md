---
type: PBI
parent: "[[Finding work]]"
order: 20
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Focus level

**As** someone planning at one altitude, **I want** the tree to start at that level, **so
that** I get the Features backlog or the PBI backlog on their own — the way Azure DevOps
gives each level its own board — without the levels above them taking up the screen.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Picking a type from the toolbar's focus control |
| **Preconditions** | The tree has rows |
| **Guarantee** | **Only the rendering is re-rooted.** No item's real parent changes, and nothing is written — not the notes, and not the `.base` either: the pick is working position, stored in the view-state store ([[Collapse persistence]]). Clearing the focus restores the full tree. |

**Main flow**

1. The user picks a type — say `Feature` — from the focus control.
2. Every item of that level becomes a top-level row, its own children beneath it.
3. Everything above that level stops rendering.
4. The user clears the focus with **Show all types**, and the whole tree returns.

**Extensions**

- **2a — types that rank *with* the focused level.** An `Issue` or a `Bug` ranks at the
  PBI rung wherever it hangs ([[Types beside the ladder]]), so focusing PBIs shows them
  beside the PBIs rather than making them vanish. A backlog view that hides work because
  of how it was classified is worse than no filter.
- **2b — an item of the focused level whose parent is also of that level.** It renders
  where it really is, not twice.
- **3a — the user tries to indent or outdent across the synthetic top row.** Refused.
  Those rows are *not* a real sibling group — they are items from all over the tree that
  share a level — and a reparent there is a question about parentage that nothing in this
  screen answers. RANKING them is no longer refused: since
  [ADR 0032](../adrs/0034-order-is-a-global-rank.md) every item shares one rank, so rows
  from different parents can be ordered against each other and a focus-level drag writes
  a number that still means something when the focus clears. That is its own use case —
  [[Ranking at the focused level]] — including the price: one rank, so ordering the
  focused list also orders each item inside its own sibling group.
- **4a — the view is closed and reopened before the focus is cleared.** It comes back
  focused on the same type, from **vault-scoped local storage** rather than the `.base` —
  per saved view, per device. Focus is one person's altitude for the afternoon, not
  configuration the base publishes to everyone it syncs to. The price is the one
  [[Collapse persistence]] already pays: it does not sync, and a `.base` written by an
  older version carries a `focusLevel` key that is now ignored.

**Guarantees**

- Depth in a focused tree is not level. Everything that computes a level chains down the
  **parent's** level rather than visual depth, which is exactly the bug focus mode would
  otherwise cause and is now a lint rule ([[Level ladder and implied types]]).

## Acceptance criteria

- Items keep their real parents; only the rendering is re-rooted.
- The pick is never written to the `.base`: it is working position, and it survives a
  reopen from local storage instead.
- Indent and outdent are disabled across the synthetic top row, which is not a real
  sibling group. Ranking is not: it writes the one rank every item shares
  ([[Ranking at the focused level]]).
- Types that rank with the focused level appear beside it rather than vanishing.
- No rank is computed from the rendered roots — enforced by lint in the two files that
  produce one ([[Sibling ranking]]).

## Where it lives

`src/domain/model.ts` (`collectFocusRoots`) · `src/domain/itemTypes.ts` (`focusTarget`) ·
`src/view/render/toolbar.ts` (the control) · `src/view/viewState.ts` (the stored
pick, beside the collapse sets) · `src/view/backlogView.ts` (`setFocusLevel`, and the
restore that has to precede the model build).
Tests: `test/domain/model.test.ts`, `test/view/toolbar.test.ts`,
`test/domain/itemTypes.test.ts`, `test/view/viewStatePersistence.test.ts`.
