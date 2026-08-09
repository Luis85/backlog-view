---
type: PBI
parent: "[[The timeline]]"
order: 70
status: Done
priority: P2
created: 2026-08-08
files:
  - src/domain/bars.ts
  - src/view/collapseState.ts
  - src/view/backlogView.ts
  - src/view/render/timeline.ts
  - src/view/render/rows.ts
  - src/view/render/roadmap.ts
  - src/view/render/toolbar.ts
  - src/view/render/toolbarControls.ts
  - src/view/interactions/menu.ts
  - styles/tree.css
  - styles/timelineFurniture.css
---

# Collapsing a bar's subtree

**As** someone reading a plan of several epics, **I want** to fold a bar's children away
and open them again, **so that** the grid shows the level I am asking about instead of
every note in the backlog at once — the summary a parent's rolled-up bar already draws
being worth nothing while its children are drawn beneath it regardless.

Every Gantt in the survey does this: MS Project, Jira Plans and GanttPRO all fold a
summary task's rows into the summary bar. It is also the tree's own disclosure, on the
projection that was drawing a flat list of every dated result — the same CONTROL as
[[Children on the card]]'s, over a bit of its own: folding rows off a plan and opening a
node in the backlog are two questions about one item, and one bit answering both made
reading the plan move the reader's place in the tree (2026-08-08).

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Clicking a timeline row's chevron, picking its menu entry, or the toolbar's Expand all / Collapse all |
| **Preconditions** | Roadmap mode is on with the dated axis, and a drawn bar has another drawn bar somewhere below it |
| **Guarantee** | Nothing is written to a note. The state is the dated axis's own per-path bit — per saved view, per device — so folding a row here changes the grid and nothing else, and the quick filter overrides it as it overrides the tree's. |

**Main flow**

1. A row with another bar below it draws the tree's chevron in its lead column — a real
   button off the tab order, carrying `aria-expanded` and a name; a row with none draws
   the leaf placeholder, a plain spacer, so every badge starts at the same x.
2. The reader collapses the row.
3. Every bar below it leaves the grid, whatever its depth, and the row's own bar stays —
   which for a parent with no dates of its own is the span rolled up from exactly the
   children it just hid ([[Spans roll up the tree]]).
4. Expanding puts them back one level at a time: a child that is itself collapsed opens
   shut, because its own bit was never touched.
5. The state comes back across a reopen, per saved view per device, like every other
   collapse — and the tree is where the reader left it, the fold above having been a
   statement about the plan rather than about the backlog.

**Extensions**

- **1a — the parent between the row and its dated descendants has no bar of its own.**
  An undated Feature sits on the shelf, not on the grid, and the Epic above it still
  discloses the PBIs below: ancestry is walked through rows the grid did not draw, or a
  gap in the middle of the tree would strand everything under it with nothing to fold it
  away.
- **1b — nobody has ruled on the row yet.** It opens collapsed, the tree's rule and for
  the tree's reason: a backlog of any size opens readable. The toolbar's Expand all is
  one click from the whole plan.
- **2a — a milestone is among the rows hidden.** It goes with them, and so does the
  full-height line it draws: the line belongs to a row, and nothing stands in for it —
  a marker's date is never evidence, so it cannot roll up into the bar above it the way
  work does. The date is one expand away, which is what makes this a fold rather than a
  loss.
- **2b — the reader has no pointer.** The row's menu carries the same toggle, named for
  what it will do, and it is the keyboard path for a control that is deliberately not a
  tab stop — the same answer the tree gives for its add button and the card gives for
  its own disclosure.
- **2c — the quick filter is running.** It overrides collapse state, so the chevron
  writes nothing and the menu offers no toggle at all: a write there would read back as
  expanded and then take effect once the filter cleared.
- **2d — the disclosure held focus when it was pressed.** The rebuild destroys it, and a
  browser drops focus to the document body — where the pane's arrows and menu keys do
  nothing until the reader finds their own way back. Focus goes to the PANE, never to the
  replacement chevron: the pane's key handler ignores any event whose target is not the
  pane itself, so focusing a `tabindex="-1"` control inside the composite would look
  right and silently kill the arrows. Focus that was somewhere else is left there.
- **3a — the hidden rows were what stretched the grid.** The window is the drawn spans,
  so it narrows to what is left, exactly as it already does when hiding completed work
  removes a bar. A collapse is a change of what is on the grid, not a change of scale.
- **3b — an item on the shelf hangs under the collapsed row.** It stays on the shelf.
  The shelf is a statement about what the axis could not place, and a row hidden behind
  a disclosure has not become unscheduled.

## Acceptance criteria

- A timeline row draws a chevron exactly when another drawn bar hangs below it — at any
  depth, through parents the grid did not draw — and the leaf placeholder otherwise.
- The expanded state is on the CONTROL and never on the row: `createCard` gives a card
  row `role="option"`, which does not support `aria-expanded`, so the chevron is a real
  `<button tabindex="-1">` carrying the state and a name worded exactly as the menu
  entry, and the row carries no such attribute. The leaf placeholder is a plain div — a
  button opening onto nothing would be announced as a control that does nothing.
- What a screen reader is promised here is the row's NAME and the menu's entry, and not
  more: `option` has presentational children, so a user agent may flatten the button and
  drop its role and state. The label is therefore worded as the state ("Show children" /
  "Hide children") so the fact flips inside the name that survives.
  [[A disclosure nested in an option role]] holds the two redesigns that would settle it,
  neither of which belongs in this increment.
- Collapsing a row removes its whole subtree from the grid, not only its children, and
  the row keeps its own chevron: which rows have children is asked of the bars derived
  before any were hidden, or a collapsed row's disclosure would vanish the moment it was
  used.
- Expanding reveals one level: a descendant that is itself collapsed stays shut.
- The bit is the dated axis's OWN, remembered per saved view per device beside the tree's
  and never written to the `.base` or to a note. Folding a row on the grid leaves that
  item where the reader left it in the tree and on a card, and opening it there leaves the
  grid folded — driven both ways round, because one scope writing into the other's key
  only shows from the side that was written.
- A row nobody has ruled on opens collapsed on the grid too: the two scopes are settled
  from one pass over the model, so the projection not on screen is never left unsettled
  and then opened whole the first time it is shown.
- The scope is the PROJECTION's, so the shelf and context cards drawn beside the grid keep
  their disclosures with the axis as its rows do — one working position per screen, rather
  than one per control.
- An entry stored before the split holds one bit per note, and it is the bit both
  projections were reading, so it is COPIED into the new scope on the first restore that
  finds no scoped key. The upgrade leaves a reader's plan where they left it instead of
  shutting every row on it, and running again cannot undo that, since the copy it made is
  what stops it.
- While the quick filter runs the chevron writes nothing and the menu offers no toggle.
- The chevron opens nothing: neither a primary nor a middle click on it reaches the row's
  own open behaviour.
- A fold that destroys the control holding focus hands focus to the PANE, so the arrows
  and menu keys keep working; a fold pressed while focus was elsewhere leaves it there.
- The row menu offers the toggle wherever the row drew one, and offers it on no row that
  drew none.
- The toolbar's Expand all and Collapse all are live on a dated axis that drew a
  disclosure, and disabled on one where no bar hangs under another.

## Where it lives

`timelineRows` in `src/domain/bars.ts` is the whole rule, pure and asked of the bars
alone: it walks each bar's ancestors that are themselves drawn (`barAncestors`, which
steps through a shelved or context parent rather than stopping at one), drops any bar
under a collapsed one, and reports per surviving row whether anything hangs below it —
computed BEFORE the drop, which is what keeps a collapsed row's chevron on screen. The
collapse state itself is never read there: the predicate is passed in, so
`src/view/render/roadmap.ts` supplies `host.isCollapsed` and the quick filter's override
of it comes for free.

WHICH bit that predicate lands on is `collapseKey` in `src/view/backlogView.ts`, the one
place the scope is decided: on the dated axis the path is prefixed with `TIMELINE_SCOPE`
(`src/view/collapseState.ts`), and everywhere else it is the path itself. Both host
methods route through it, so the chevron, the row menu, the keyboard and the toolbar's
bulk controls follow the projection without any of them asking what they are looking at —
a second pair of host methods would have made every one of those callers choose, and the
next caller choose again. `CollapseState` therefore holds KEYS rather than paths:
`notePath` strips the scope back off for the two operations that are about the note rather
than about the question — pruning a key whose file is gone, and following a rename — and
`collapseNewParents` settles both scopes in one pass over the model, since it runs on a
data update rather than per projection and an unsettled scope would open a whole backlog
the first time it was shown. `seedTimelineScope` is the upgrade: on a restore that finds
no scoped key it mirrors the stored bits into the new scope, because a pre-split entry's
one bit per note is the bit both projections were reading — and its own copy is what
keeps it from firing twice.

The control itself is the tree's, extracted rather than copied: `renderChevron` in
`src/view/render/rows.ts` is now the one statement of what a chevron is — the icon, the
leaf placeholder, the click that flips the bit, and the three guards a copy would have had
to rediscover (the filter override, the real `disabled` flag, and the middle click that
never fires `click` and so never meets the first guard). Two things are the caller's: what
the flip REDRAWS, and **who says the row is expanded**, which the ROW's role decides
rather than preference — a `treeitem` carries `aria-expanded` itself and gets the plain
div, while a card row's `option` role does not support it, so passing a label makes the
chevron a real button carrying the state. `styles/tree.css` strips Obsidian's button
chrome off that form, by the recipe `cardChildren.css` already states for the same
problem on the same role.
`renderRowChevron` in `src/view/render/timeline.ts` supplies `host.render()` rather than
the tree's targeted `refreshSubtree` — what changes here is which rows the grid holds, and
its window, gridlines and full-height marks are all derived from that set — and registers
the path in `RowContext.cardKids`, which is what makes the toolbar's bulk controls live
and the row menu's section appear. The extraction changed the TREE by one behaviour: a
middle click on its chevron no longer opens the note in a new tab, which was the same
defect the card's own toggle had already fixed for itself. `addChildrenSection` in
`src/view/interactions/menu.ts` carries the keyboard path, leading with the toggle
because on this projection the disclosure is the feature rather than a list on a card's
face. The chevron's own styling is the tree's; the row's separator and selection, whose
paint layers the disclosure sits in, are `styles/timelineFurniture.css`.

Driven in `test/domain/bars.test.ts` (the four rules, each watched failing against the
implementation broken back) and `test/view/timelineCollapse.test.ts` (the chevron, the
menu, the filter's override, the marks that go with a hidden row), with
`test/view/toolbarCollapse.test.ts` asking the bulk controls both ways.

The toolbar's own two bulk actions this feeds — `expandAll`, `collapseAll`, the
`collapseButton` that wires them and the `collapseCtlsDisabled` question behind their
`disabled` flag — moved out of `src/view/render/toolbar.ts` into
`src/view/render/toolbarControls.ts` ahead of the toolbar-zones work (2026-08-08), a
pure extraction with no behaviour change: `render/toolbar.ts` still decides what
appears where and calls the moved functions unchanged, driven by the same
`test/view/toolbarCollapse.test.ts` above. The rest of that module — the shared control
vocabulary, the projection-zone dispatch and the `⋯` overflow — is
[[A toolbar that fits one row]].

**Not built: indentation.** The rows are still a flat list with a chevron in it — the
badge names the level and nothing draws the ancestry. Showing that on the roadmap is
[[Lanes on the roadmap]]'s design, which makes a parent a region rather than an indent,
and a per-row indent added here would be a second answer to the same question.
