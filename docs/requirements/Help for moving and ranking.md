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
iteration: ""
release: "[[Eratic Skunk]]"
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
   as ranked, which is the fastest way to move and rank in one gesture. **A FOCUSED view
   is the exception, and the section states it in the same breath**: the focus rows are one
   rung of the tree rather than one parent's children, so `dropTargetFor`'s focus branch
   restates `dragged.parent` and marks the target `parentUnchanged` — the drop writes the
   rank and nothing else. Left unqualified the entry promises the opposite of the gesture
   this epic added, which is what it did until 2026-09-02.
3. It lists the same moves without a mouse: <kbd>Alt</kbd>+arrows to move, indent and
   outdent in the tree, and the context menu's move up / down / to top / to bottom /
   indent / outdent.
4. It explains `order`: **one** number ranking every note the Base returns, maintained by
   the view rather than scoped to a parent. It says what that buys the reader — a
   between-drop takes a value between the two neighbours, so it writes the dropped note
   alone and the rows around it keep the numbers they had
   ([ADR 0034](../adrs/0034-order-is-a-global-rank.md)) — and it separates the two things
   a missing rank does, which are not the same and read as one until they are told apart.
   In a SIBLING group the unranked row sorts last, in the Base's own order. A FOCUSED list
   is all or nothing: `inRankOrder` keeps the whole list in tree order while any row lacks
   a rank or two share one, rather than sorting the odd row last, so an order set by hand
   there would not show — which is why the drag is refused there and names its remedy
   ([[Ranking at the focused level]] 2d).
5. It closes with what a move does *not* do: re-type anything, ever.

**Extensions**

- **1a — the drop is refused.** A row cannot be dropped onto itself or into its own
  subtree, and a row whose own neighbours are not all on screen takes no between-drop: a
  context row, whose real siblings were never loaded, and a row this projection promoted
  because its real parent belongs to the other one. None of these is a rule about types.
  **The focused view left this list on 2026-08-30** and the note said otherwise for one
  epic: a global rank made the focus rows a ranking destination, so a between-drop there
  is the feature rather than the refusal, and it writes the rank and never the parent.
  So did the sibling group containing a context row — nothing is renumbered any more, so
  there is no write to that row to skip.
- **1b — a quick filter is active.** *Withdrawn 2026-08-17, with the quick filter itself*
  ([[Remove the quick filter, now that Bases has its own search]]). Dragging was off
  entirely under one, because visual neighbours under a filter are not siblings, and the
  section said so. Kept as a numbered entry so 1c's account of the list growing and
  shrinking still reads against the numbers it names.
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
- **1d — the drop is accepted and then has no number.** The two rows it landed between
  hold the same rank, the gap between them is spent, or one of them is unranked. The
  view says so and names the remedy (Seed, Respace, or the set-up button); the menu and
  <kbd>Alt</kbd>+arrow ask the same question before they offer the move, so there the
  entry is withheld instead. Listed because it is the one refusal that is NOT a state the
  section can enumerate ahead of the gesture — it is a fact about the two numbers.
- **3a — the user is on a keyboard throughout.** The keyboard and menu forms are listed
  beside the drag rather than in a footnote, so the section doubles as the keyboard
  reference at the moment someone wants it.
- **3b — the view is focused on one type.** A between-drop between two focus rows ranks
  them against each other — that is what the focus level is for — while Indent and
  Outdent stay disabled there, and no longer for 1a's reason: the row HAS a previous
  sibling on screen now, and what the screen cannot answer is which parent nesting it
  under that row would mean.
- **5a — the reader expects a move to fix a mismatched type.** It does not, and the
  section says so rather than staying silent: a drop, an indent, an outdent and both
  parent-link entries write the parent and the rank, and a type is what the note says or
  what `Set type` wrote. This extension used to describe an opt-in cascade by what it
  skipped; the cascade was removed on 2026-08-11 ([[Assigning type on a move]]).

## Acceptance criteria

- The between-versus-onto distinction is stated first, with the drop indicator named as
  the cue to read, and **between** is described as sibling placement rather than as
  reordering: `siblingPosition` takes the hovered row's parent, so a cross-parent
  between-drop reparents as well as ranks — with the focused view named as the one place
  it does not, since there the same gesture writes the rank alone.
- Every move is listed in all three forms — drag, keyboard, menu — so the section doubles
  as the keyboard reference at the moment someone wants it.
- The section names every state where a drop is deliberately unavailable, so an absent
  gesture reads as a rule rather than a bug — and, since 1d, also the refusal that can
  only be known once the drop is planned, so a message on an accepted gesture reads the
  same way.
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
