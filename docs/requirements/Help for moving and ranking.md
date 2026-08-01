---
type: PBI
parent: "[[User manual]]"
order: 20
status: Open
priority: P2
created: 2026-08-01
files:
  - src/domain/dropTargets.ts
  - src/view/interactions/dragDrop.ts
  - src/view/interactions/keyboard.ts
  - src/view/interactions/menu.ts
---

# Help for moving and ranking

The manual section on changing the structure: what a drop does depending on *where* it
lands, the three ways to make the same move, and where `order` comes from.

## What the section says

- **Between two rows re-orders; onto the middle of a row re-parents.** One gesture, two
  outcomes, distinguished only by a few pixels and an indicator — which is the single
  thing about this view most worth stating in words.
- **The strip at the bottom makes an item top-level**, and dropping a stale-link item
  there is also how a broken `parent` gets cleared.
- **The same moves without a mouse**: <kbd>Alt</kbd>+arrows move, indent and outdent in
  the tree; the context menu offers move up / down / to top / to bottom / indent /
  outdent. Neither is a lesser path — the tree is one tab stop precisely so a long
  backlog stays navigable.
- **`order` ranks siblings, and the view maintains it.** Items without an `order` sort
  last, in whatever the Base's own sort produces, until they are ranked.
- **A move does not re-type.** `Assign item type when moving` is off by default. Turned
  on, it re-types the dragged item and the **ladder-typed** items below it to match where
  they landed — untyped descendants are left untyped, a custom type keeps its name,
  `Issue` and `Bug` keep their pinned rank, and the cascade stops at a context row rather
  than retyping across a branch the Base excluded.
- **What is refused, and why it is not a rule about types**: while the quick filter is
  active drag and drop is off (visual neighbours are not real siblings), and in a focused
  view the top row has no shared ranking, so reordering, indent/outdent and the top-level
  strip are disabled there.

## Acceptance criteria

- The re-order/re-parent distinction is stated first, with the drop indicator named as
  the cue to read.
- Every move is listed in all three forms — drag, keyboard, menu — so the section doubles
  as the keyboard reference at the moment someone wants it.
- The section names the two states where dragging is deliberately unavailable, so an
  absent gesture reads as a rule rather than a bug.
- No claim about a move being refused for hierarchy reasons: the rules are advisory, and
  saying otherwise here would contradict [[A help button for the item types]].
- The re-typing cascade is described by what it **skips** — untyped, custom-typed, extra
  types, and anything past a context row — rather than as a whole-subtree rewrite.
  `README.md` currently says "the whole moved subtree"; the manual must not inherit that
  wording, and the README is worth correcting with it.

## Evidence

- `src/domain/dropTargets.ts` — the zones the two outcomes come from.
- `src/view/interactions/keyboard.ts`, `src/view/interactions/menu.ts` — the equivalents.
- [[Sibling ranking]], [[Keyboard, menu and touch]], [[Focus level]] — the built
  behaviour this section describes.
- `README.md`, sections *Using the view*, *Keyboard* and *Ranking details*.
