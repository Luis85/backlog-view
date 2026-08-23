---
type: PBI
parent: "[[Backlog and board]]"
order: 40
status: Open
priority: P2
created: 2026-08-07
files:
  - src/view/render/cardChildren.ts
  - src/view/viewState.ts
  - src/view/backlogView.ts
  - src/view/interactions/menu.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-07
due: ""
risk: ""
assignee: ""
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
- **4a — the user has no pointer.** The card menu offers the TOGGLE, from the same gate.
  A disclosure nobody without a mouse can reach is not a list of children. It offered one
  `Open child "…"` entry per child as well, unconditionally, until 2026-08-14; those were
  removed on request and came back the next day narrowed to the children with **no card
  of their own**, which is empty on an unfocused projection and is the whole keyboard path
  under a focus. See [[Drop the per-child entries from the card menu]], which also records
  the match-list consequence and the fix it needed. **The HORIZON board is exempt from the
  whole section since 2026-08-17** — no toggle and no entries there, asked for directly —
  and [[Drop the children section from the horizon board's card menu]] records what that
  withholds on that one board.
- **5a — the item is a context row.** It gets the disclosure like any other card. Nothing
  here writes, so the rule that governs it is not in question.

**The letters skip `1c` and `3c`**, which described the quick filter overriding collapse
state and the card's match list. Both were withdrawn with the filter itself on 2026-08-17
([[Remove the quick filter, now that Bases has its own search]]) and this note went on
stating them, as two acceptance criteria did. The letters are not renumbered: a label is
how an extension is referred to from elsewhere, and shifting one to close a gap moves every
reference that named it.

## Acceptance criteria

- A card with at least one visible direct child renders a disclosure naming them by
  count, and by type when they share one; a card with none renders no disclosure at all,
  including when its children are hidden rather than absent.
- Expanded, the card lists its direct children and only those — a grandchild never
  appears. Each entry carries the child's type badge and name, and a done child is styled
  done.
- Which children are listed is `isRowHidden`, the rule the tree and both card projections
  already share, so hiding completed work means the same thing here as everywhere. The
  card's rollup keeps counting what the list omits.
- Activating an entry opens that child, and never the card's own note — by primary click
  and by middle click, which are separate events and separately guarded. The toggle
  opens nothing on either.
- Expansion is per-path collapse state: remembered per saved view and per device, and
  unchanged by a data update. It is a bit of its OWN (2026-08-09) — independent of the
  tree row for the same note, and independent of the dated axis's own fold state
  ([[Collapsing a bar's subtree]]) — so nothing but the card's own toggle can open or
  close it: not the tree's Expand all/Collapse all, not the dated axis's chevron, not a
  data update. One scope regardless of which card projection draws the card (board,
  either roadmap axis, Deliverables), since "is this item's card open" is one question
  about the note and not one per screen that happens to draw it as a card.
- The card menu offers the toggle, on a right-click and on the menu key, and offers it on
  no surface that drew no disclosure — and not on the horizon board, whose card menus
  carry no children section at all
  ([[Drop the children section from the horizon board's card menu]]).
- Nothing in the feature writes to a note.

## Where it lives

`src/view/childrenList.ts` is pure and DOM-free, and holds what a card asks about its
children: `drawnChildren` (the level of the tree this projection puts beneath the item),
`listedChildren` (those of them the view is showing anyway), `childrenLabel` (what to call
them), `cardedPaths` (which paths this projection drew a card for) and `menuChildren` (what
the row menu may name).

**`drawnChildren` is a DESCENT and not one level of `item.children`.** A row this
projection does not draw is traversed THROUGH, so a `Release` hand-hung between a `Feature`
and its `PBI`s — drawn by no axis of the roadmap — leaves those `PBI`s on the Feature's face
rather than on no card at all. The one rule it keeps is where it STOPS: a row promoted to a
root of the rendered forest carries `focusRoot` and is drawn in its own right, so the walk
does not also carry it up.

**That stamp is read only where it is this projection's own** — `drawsForestFrom`
(`src/view/projection.ts`). `focusRoot` is set once per model build, by `collectFocusRoots`
and `projectionForest` together, so a projection drawing a population of its OWN meets it on
rows it never promoted: the iteration board's population is `iterationResults` over
`realRoots` and the Deliverables board's is `deliverableResults` off the whole unfocused
tree. Reading the stamp there took an in-sprint `PBI` off its carrier's face while the same
board went on drawing its own card for it.

**A projection that draws the forest can still be walking a row the forest never held**,
which is why the question is asked of the walk's ORIGIN rather than of the projection
alone. A grid axis of the roadmap appends `model.iterations`, and `inPlan` refuses an
`Iteration` — so the children of an undated iteration's shelf card carry `focusRoot`
BECAUSE their parent is not a member of the plan's forest. Read as a promotion the roadmap
had made, the stop emptied that card: no disclosure and no children entry in its menu. The
membership predicate is the one the forest was built with — `inCatalog` for the catalog's,
`inPlan` for the plan's — computed once by the caller and carried unchanged down the
recursion, since the rows the walk passes THROUGH are members of nothing. The walk itself
is
`drawnDescent` in `src/view/rowVisibility.ts`, because `rowHidden` needs the same descent
for the same reason — a context row is an empty scaffold only when nothing is visible below
it, and "below it" has to mean the same thing to the row and to the card. `drawnChildren` is
that walk asked with the host's own membership question, `isRowUndrawn`
(`src/view/backlogView.ts`) — membership ALONE, never `isRowHidden`, or a subtree the
completed toggle hid would come back on every card face.

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
`cardedPaths` is what lets the menu ask ONE question regardless of which projection drew
the row it is on: it reads `host.board` on the board and `host.roadmap.placed` on the
roadmap — `RoadmapModel` is not what the roadmap draws, so the register `render/roadmap.ts`
fills as it renders is what the menu reads instead. A card's face and the menu do not share
an already-listed set: the face lists what its OWN disclosure drew, while the menu asks
`host.cardChildrenShown` — because a timeline row joins that set through its fold chevron
while listing nothing on its own face. Two sentences here named `undisclosedMatches` and
`matchesFor` until 2026-08-22; both went with the quick filter on 2026-08-17
([[Remove the quick filter, now that Bases has its own search]]) and the note went on
describing them.

`menuChildren` narrows `listedChildren` rather than repeating it, and the two are the same
set only until the per-child entries are narrowed — which they were on 2026-08-15
([[Drop the per-child entries from the card menu]]): the menu names a listed child only
where it has **no card of its own**, so the wider set would name a child the reader can
already reach. `menuChildren` states that gate and that narrowing together, in
`childrenList.ts` beside the walk, so the loop that adds the entries and the answer it is
built from cannot come apart. `cardedPaths` is the one place a projection is asked which
cards it drew.

The expansion bit itself is `CARD_SCOPE` in `src/view/viewState.ts`, a prefix
alongside `TIMELINE_SCOPE`, read and written through `BacklogViewHost.isCardCollapsed`/
`setCardCollapsed` (`src/view/backlogView.ts`) — a second pair of host methods beside
`isCollapsed`/`setCollapsed` rather than a scope the existing pair infers from the
projection, because a card and the tree row for the same note now answer two different
questions and a caller has to say which one it means. `renderCardChildren`'s toggle is
the only renderer that calls the card pair; a dated-axis timeline row's own chevron
(`renderRowChevron` in `src/view/render/timeline.ts`) keeps calling the row pair, unchanged.
`menu.ts`'s `addChildrenSection` serves both from one function, so it reads
`host.roadmap`'s own `bars` to tell a card from a bar sharing the same `cardChildrenShown`
entry and picks the matching pair — the one place a caller still has to ask, because it is
the one place the same gate covers two different kinds of disclosure. `collapseNewParents`
settles a newly-seen item's card bit in the same pass as the tree's and the dated axis's,
and `seedCardScope` carries a pre-split installation's card state into the new scope once,
on first restore, from EITHER of two sources — the bare path, and a note's dated-axis key,
since `collapseKey` routed every card through `TIMELINE_SCOPE` there too before this split.
Neither key can be trusted by merely existing: `collapseNewParents` settles every parent
collapsed in every scope on every data update whether or not the dated roadmap was ever
opened, so most installations already have a `TIMELINE_SCOPE` entry for most notes
regardless. What it cannot do is falsely EXPAND one — that only ever happens through a
user's own action — so an expansion on either side is taken as the card's too, the same
call `seedTimelineScope` already makes for its own single source. Idempotent for the same
reason `seedTimelineScope` is.
Driven in `test/view/cardChildren.test.ts`, and against context cards in
`test/view/contextCardWrites.test.ts`.
