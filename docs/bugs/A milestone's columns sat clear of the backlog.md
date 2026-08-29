---
type: Bug
parent: "[[Property columns]]"
order: 10
status: Done
area: styling
priority: P2
created: 2026-08-08
closed: 2026-08-08
source: User report — "the columns of a milestone are not aligned with the rest of the backlog, every column is displaced to the right"
files:
  - src/view/render/rows.ts
  - src/view/render/columns.ts
  - styles/columns.css
  - test/view/rendering.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A milestone's columns sat clear of the backlog

## What happened

Every column on a milestone row sat one add-button's width to the right of the same
column on every other row — the horizon chip, the state chip and the rollup all
displaced together, so the row read as indented from the backlog it belongs to.

The cause is not in the columns and not in markers. A row's trailing strip is anchored to
the row's **end**: `.pbl-row-spacer` takes the slack, and everything after it is
fixed-width. `renderRowTrailing` renders the row's add button last, and returns *early*
for a row that can hold nothing — which is right for the control (a marker holds no
children, and `New undefined` opening a modal with no type to pick is the failure that
early return exists to prevent) and wrong for the layout, because the element it skips was
also holding a place. Absent from an end-anchored strip, the button does not leave a gap
where it was: everything before it slides into its width.

A milestone is the only row that takes that branch today, so the defect presented as a
milestone defect. It is a property of the branch — any future type that holds nothing
would arrive misaligned the same way.

## Fix

`renderAddSpacer` (`src/view/render/columns.ts`) draws the reservation without the
control: an `aria-hidden` div carrying the same `clickable-icon` box around the same
sized icon, so the width is the button's *by construction* rather than by a number
restating Obsidian's padding somewhere it could drift from. `renderRowTrailing` renders
it on the branch that renders no button, and the column header — which is not a row and
was already reserving the same width inline — now calls it too, so there is one statement
of what the slot is.

The stylesheet hides it with `visibility: hidden`, not `opacity: 0`: `.pbl-row:hover
.pbl-add` reveals anything merely transparent, and a plus appearing on a row that cannot
create is worse than the misalignment being fixed.

## Lesson

**An early return that skips a control also skips its geometry.** The guard was written
about what the control *does* — "this row can create nothing, so offer nothing" — and
that reading is complete on its own terms. What it cannot see is that in an end-anchored
layout the element is load-bearing for its neighbours whether or not it is a control:
withholding it is a layout decision taken by a function that was only deciding about an
affordance.

Note also which check the repository already had, and what it did not cover:
`test/view/rendering.test.ts` asserted the affordance was **absent** on exactly this row,
and passed throughout — the assertion was about the control, so it agreed with the bug.
The guarantee under it was the narrow one, and the wider claim (the columns line up on
every row) had nothing under it at all. The new check compares the shape of a milestone
row's trailing strip against an ordinary row's, which is as far as jsdom can reach toward
"they line up" and fails on the branch rather than on the type.
