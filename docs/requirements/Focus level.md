---
type: PBI
parent: "[[Finding work]]"
order: 20
status: Done
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
| **Guarantee** | **Only the rendering is re-rooted.** No item's real parent changes, and nothing is written. Clearing the focus restores the full tree. |

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
- **3a — the user tries to rank, indent or outdent across the synthetic top row.**
  Refused. Those rows are *not* a real sibling group — they are items from all over the
  tree that share a level — and treating them as siblings would write ranks that mean
  nothing when the focus clears.

**Guarantees**

- Depth in a focused tree is not level. Everything that computes a level chains down the
  **parent's** level rather than visual depth, which is exactly the bug focus mode would
  otherwise cause and is now a lint rule ([[Level ladder and implied types]]).

## Acceptance criteria

- Items keep their real parents; only the rendering is re-rooted.
- Ranking, indent and outdent are disabled across the synthetic top row, which is not a
  real sibling group.
- Types that rank with the focused level appear beside it rather than vanishing.
- Ranking always runs over the real roots — enforced by lint ([[Sibling ranking]]).

## Where it lives

`src/domain/model.ts` (`collectFocusRoots`) · `src/domain/itemTypes.ts` (`focusTarget`) ·
`src/view/render/toolbar.ts` (the control).
Tests: `test/domain/model.test.ts`, `test/view/toolbar.test.ts`,
`test/domain/itemTypes.test.ts`.
