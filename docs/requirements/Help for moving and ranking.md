---
type: PBI
parent: "[[User manual]]"
order: 20
status: Done
priority: P2
created: 2026-08-01
files:
  - src/domain/dropTargets.ts
  - src/view/interactions/dragDrop.ts
  - src/view/interactions/keyboard.ts
  - src/view/interactions/menu.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-01
due: 2026-08-10
risk: ""
assignee: ""
---

# Help for moving and ranking

**As** someone reshaping a backlog, **I want** to know what a drop will do *before* I let
go, **so that** a gesture separated from another by four pixels stops being a guess.

The manual section on changing the structure: what a drop does depending on *where* it
lands, the three ways to make the same move, and where `order` comes from.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Opening the manual on the moving section, from the **?** button or from a link in another section |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | The section describes only moves the view actually performs, and names every state in which a move is deliberately unavailable — so an absent gesture reads as a rule rather than a bug. |

**Main flow**

1. The section states the distinction the gesture turns on: dropping **between** two rows
   places the item as their sibling; dropping **onto** the middle of a row makes it a
   child. The drop indicator is named as the cue that says which is about to happen.
2. It notes that a between-drop is a *reorder* only when the item is already in that
   group — drop it between two rows under a different parent and it is reparented as well
   as ranked, which is the fastest way to move and rank in one gesture.
3. It lists the same moves without a mouse: <kbd>Alt</kbd>+arrows to move, indent and
   outdent in the tree, and the context menu's move up / down / to top / to bottom /
   indent / outdent.
4. It explains `order`: a number ranking siblings, maintained by the view, with unranked
   items sorting last in whatever the Base's own sort produces.
5. It closes with what a move does *not* do: re-type anything, ever.

**Extensions**

- **1a — the drop is refused.** A row cannot be dropped onto itself or into its own
  subtree, and a group with no shared ranking takes no between-drop: the top row of a
  focused view, and a context row, whose real siblings were never loaded. None of these
  is a rule about types.
- **1b — a quick filter is active.** Dragging is off entirely, because visual neighbours
  under a filter are not siblings. The section says so, since a row that will not lift is
  otherwise indistinguishable from a broken one.
- **1c — the move would change which screen the row is on.** A `Task`, or a note with no
  `type`, reads its level from whatever it hangs from, so moving one between the plan and
  the test catalog would take it off the screen it was moved on. `dropTargetFor`,
  `outdentTarget` and the parent-link actions all withhold it. Listed because 1a's
  enumeration read as complete and was one short: it promised a move worked "except
  throughout a focused view", and this is a second exception. The enumeration has since
  been one item LONG as well, when the drop on the tree background it named was deleted
  (2026-08-11) — the list is per gate that asks `keepsProjection`, and it is rebuilt from
  that call rather than edited. It is not a rule about types — every other type keeps its own ladder wherever it
  lands, and a backlog with no tests in it is refused none of this.
- **3a — the user is on a keyboard throughout.** The keyboard and menu forms are listed
  beside the drag rather than in a footnote, so the section doubles as the keyboard
  reference at the moment someone wants it.
- **3b — the view is focused on one type.** Indent and outdent are disabled at the top
  row, for the same reason a between-drop is: no shared ranking.
- **5a — the reader expects a move to fix a mismatched type.** It does not, and the
  section says so rather than staying silent: a drop, an indent, an outdent and both
  parent-link entries write the parent and the rank, and a type is what the note says or
  what `Set type` wrote. This extension used to describe an opt-in cascade by what it
  skipped; the cascade was removed on 2026-08-11 ([[Assigning type on a move]]).

## Acceptance criteria

- The between-versus-onto distinction is stated first, with the drop indicator named as
  the cue to read, and **between** is described as sibling placement rather than as
  reordering: `siblingPosition` takes the hovered row's parent, so a cross-parent
  between-drop reparents as well as ranks.
- Every move is listed in all three forms — drag, keyboard, menu — so the section doubles
  as the keyboard reference at the moment someone wants it.
- The section names every state where a drop is deliberately unavailable, so an absent
  gesture reads as a rule rather than a bug.
- No claim about a move being refused for **type compatibility** — those rules are
  advisory — and no claim that nothing is refused at all. Both would contradict
  [[A help button for the item types]], in opposite directions. The projection boundary
  (1c) is not that claim and must not be written as one: it turns on which screen the row
  is drawn on, so the section gives the row leaving that screen as the reason, names the
  two rows it reaches, and says in the same breath that every other type keeps its own
  ladder wherever it lands.
- The re-typing cascade is described by what it skips — untyped, custom-typed, extra
  types, and anything past a context row — rather than as a whole-subtree rewrite.
  `README.md` currently says "the whole moved subtree"; the manual must not inherit that
  wording, and the README is worth correcting with it.

## Where it lives

`src/view/manual/sections.ts` — the moving section's own entries. The behaviour it
describes is `src/domain/dropTargets.ts` (the zones and the refusals),
`src/view/interactions/dragDrop.ts` (the indicator) and
`src/view/interactions/keyboard.ts` with `src/view/interactions/menu.ts` (the same moves
without a mouse), plus `src/domain/writePlan.ts` (`computeDropWrites`, which is where the
section's closing claim — that a move writes the parent and the rank and nothing else —
is either true or not).
