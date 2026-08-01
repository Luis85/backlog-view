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

- **Between two rows places the item as their sibling; onto the middle of a row makes it
  a child.** One gesture, two outcomes, distinguished only by a few pixels and an
  indicator — which is the single thing about this view most worth stating in words. A
  between-drop is a *reorder* only when the item is already in that group; drop it between
  two rows under a different parent and it is reparented too, which is the fastest way to
  move an item and rank it in one gesture.
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
- **What is refused, and why none of it is about types**: a row cannot be dropped onto
  itself or into its own subtree; a group with no shared ranking takes no between-drop
  (the top row of a focused view, and a context row, whose real siblings were never
  loaded); and while the quick filter is active dragging is off entirely, because visual
  neighbours are not real siblings. Indent/outdent and the top-level strip are disabled in
  a focused view for the same ranking reason.

## Acceptance criteria

- The between-versus-onto distinction is stated first, with the drop indicator named as
  the cue to read, and **between** is described as sibling placement rather than as
  reordering: `siblingPosition` takes the hovered row's parent, so a cross-parent
  between-drop reparents as well as ranks.
- Every move is listed in all three forms — drag, keyboard, menu — so the section doubles
  as the keyboard reference at the moment someone wants it.
- The section names every state where a drop is deliberately unavailable, so an absent
  gesture reads as a rule rather than a bug.
- No claim about a move being refused for **type** reasons — those rules are advisory —
  and no claim that nothing is refused at all. Both would contradict
  [[A help button for the item types]], in opposite directions.
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
