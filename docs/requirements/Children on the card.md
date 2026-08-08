---
type: PBI
parent: "[[Backlog and board]]"
order: 40
status: Open
priority: P2
created: 2026-08-07
files:
  - src/view/render/cardChildren.ts
---

# Children on the card

**As** someone reading a board of epics, **I want** to open a card and see what is
directly under it, **so that** I learn which features an epic holds without leaving the
projection I am working in.

A rollup says three of eight are done. It never says which three. Azure DevOps cards
carry a child checklist and GitHub Projects a sub-issue list for the reason
[[What a card shows]] already cites — on a board, the hierarchy has to travel on the
card — and a count is the half of it that cannot be acted on.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Expanding a card that has children |
| **Preconditions** | A card projection is showing, and the item has at least one child the view is not hiding |
| **Guarantee** | The disclosure shows exactly the direct children the tree would show, reaches every one of them without a pointer, and writes nothing to any note. |

**Main flow**

1. The card renders a disclosure naming its visible direct children by count and, when
   they share one, by type.
2. The user opens it.
3. The card lists those children — type badge and name — one level deep.
4. Activating an entry opens that child's note.
5. The state is remembered, per saved view and per device, like every other collapse.

**Extensions**

- **1a — the item has no visible direct children.** No disclosure renders. A card whose
  children have all hidden is a leaf, exactly as such a row is: a chevron opening onto
  nothing is a lie its rollup already covers for.
- **1b — the card is a timeline row.** No disclosure of THIS kind. A dated-axis row is
  the card *shell* in a bar-grid layout, and a list of children inside that geometry is
  its own question; the row grew a different answer to it —
  [[Collapsing a bar's subtree]] folds the rows below it instead of listing them on its
  face, off a collapse bit of its own — what a plan shows and what a card lists are two
  questions, and one bit answering both moved the reader's place in one projection every
  time they read the other. What the two share is the register of what was drawn
  (`cardChildrenShown`) and therefore the row menu's section, which is why that gate is
  the render's own record rather than the projection's name.
- **1c — the quick filter is running.** It overrides collapse state, so every listed
  card shows its children and the toggle is disabled — it would otherwise write state
  that reads back as expanded and took effect once the filter cleared.
- **1d — what the disclosure is announced AS.** Open, and shared with the timeline's
  row: this toggle is a `<button aria-expanded>` inside a `role="option"` card, and
  `option` has presentational children, so a user agent may flatten it and drop both.
  What is certain is the card's own name (which the toggle's count joins) and the card
  menu's entries. See [[A disclosure nested in an option role]] — no criterion below
  claims more than that.
- **3a — a child is done.** Listed, styled done. Hiding finished work is the option that
  says so, not this.
- **3b — a child already has a card of its own.** Still listed. The disclosure answers
  what is under this item, and that does not change with where else the item is drawn.
- **3c — a child matched the quick filter.** The card's match list stops naming it, since
  the disclosure does. One card cannot say the same thing twice.
- **4a — the user has no pointer.** The card menu offers the same children, from the same
  list. A disclosure nobody without a mouse can reach is not a list of children.
- **5a — the item is a context row.** It gets the disclosure like any other card. Nothing
  here writes, so the rule that governs it is not in question.

## Acceptance criteria

- A card with at least one visible direct child renders a disclosure naming them by
  count, and by type when they share one; a card with none renders no disclosure at all,
  including when its children are hidden rather than absent.
- Expanded, the card lists its direct children and only those — a grandchild never
  appears. Each entry carries the child's type badge and name, and a done child is styled
  done.
- Which children are listed is `isRowHidden`, the rule the tree and both card projections
  already share, so hiding completed work and the quick filter mean the same thing here
  as everywhere. The card's rollup keeps counting what the list omits.
- Activating an entry opens that child, and never the card's own note — by primary click
  and by middle click, which are separate events and separately guarded. The toggle
  opens nothing on either.
- Expansion is per-path collapse state: remembered per saved view and per device, and
  unchanged by a data update. It is the TREE's bit on the tree, the board and the horizon
  axis, so one bit means "this node is open" across the three. On the dated axis it is
  that axis's own — a card on the shelf beside a plan is on the plan's screen, and the
  working position kept is the screen's ([[Collapsing a bar's subtree]]).
  While the quick filter runs the toggle is disabled.
- The card menu offers the same children, on a right-click and on the menu key, and does
  not offer them on a surface that drew no disclosure.
- Nothing in the feature writes to a note.

## Where it lives

`src/view/childrenList.ts` holds three functions, pure and DOM-free: `listedChildren`
(the visible direct children), `childrenLabel` (what to call them), and
`undisclosedMatches` (the quick-filter matches a card should still name once its
disclosure already lists some of them — one card cannot say the same thing twice).
Living here, rather than in `src/view/render/cardChildren.ts` below, is what lets that
render module and `src/view/interactions/menu.ts` share one answer without the cycle
that importing from each other would close. `src/view/render/cardChildren.ts` imports
`listedChildren` and `childrenLabel` and adds `renderCardChildren` (the disclosure, and
the list when it is open), called from `renderCardBody` in `src/view/render/board.ts`
so every card projection gets one implementation and timeline rows, which use the card
shell without the body, get none of THIS list — they draw their own disclosure over the
rows below them instead ([[Collapsing a bar's subtree]]). The render module also records
which paths it drew a
disclosure for, and so does that one; the view publishes the set as
`BacklogViewHost.cardChildrenShown` and
`menu.ts`'s `addChildrenSection` reads it — the same list and the same gate, reached
through `buildItemMenu` on both the pointer path (`showItemMenu`) and the keyboard path
(`showContextMenuFor`) — so neither re-derives an answer the screen already has.
`undisclosedMatches` is read the same way, by `renderCardMatches` in
`src/view/render/board.ts` for the card face and by `addMatchSection` in `menu.ts` for
its menu, so the two surfaces cannot both name a match the disclosure already listed.
Driven in `test/view/cardChildren.test.ts`, and against context cards in
`test/view/contextCardWrites.test.ts`.
