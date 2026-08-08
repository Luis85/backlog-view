---
type: PBI
parent: "[[The timeline]]"
order: 70
status: Done
priority: P2
created: 2026-08-08
files:
  - src/domain/bars.ts
  - src/view/render/timeline.ts
  - src/view/render/rows.ts
  - src/view/render/roadmap.ts
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
projection that was drawing a flat list of every dated result, and the bit it toggles is
already there — [[Children on the card]] settled that one node means one thing in every
projection, and this is the third surface reading it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Clicking a timeline row's chevron, picking its menu entry, or the toolbar's Expand all / Collapse all |
| **Preconditions** | Roadmap mode is on with the dated axis, and a drawn bar has another drawn bar somewhere below it |
| **Guarantee** | Nothing is written to a note. The state is the tree's own per-path collapse bit — per saved view, per device — so folding a row here folds the same row in the tree, and the quick filter overrides both. |

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
   collapse.

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
- Collapsing a row removes its whole subtree from the grid, not only its children, and
  the row keeps its own chevron: which rows have children is asked of the bars derived
  before any were hidden, or a collapsed row's disclosure would vanish the moment it was
  used.
- Expanding reveals one level: a descendant that is itself collapsed stays shut.
- The bit is the tree's own, shared with the row and the card, remembered per saved view
  per device, and never written to the `.base` or to a note.
- While the quick filter runs the chevron writes nothing and the menu offers no toggle.
- The chevron opens nothing: neither a primary nor a middle click on it reaches the row's
  own open behaviour.
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

**Not built: indentation.** The rows are still a flat list with a chevron in it — the
badge names the level and nothing draws the ancestry. Showing that on the roadmap is
[[Lanes on the roadmap]]'s design, which makes a parent a region rather than an indent,
and a per-row indent added here would be a second answer to the same question.
