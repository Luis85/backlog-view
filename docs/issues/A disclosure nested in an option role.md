---
type: Issue
parent: "[[Cross-cutting concerns]]"
order: 40
status: Open
area: ux
priority: P2
created: 2026-08-08
source: Automated review of PR #96 (the timeline's row disclosure), which found the
  first half of it and then the second half of it
files:
  - src/view/render/rows.ts
  - src/view/render/cardChildren.ts
  - src/view/render/board.ts
---

# A disclosure nested in an option role

## Why this exists

Both card projections put an expandable control INSIDE a row whose role is `option`:
`renderCardChildren` (the card's child list, shipped) and `renderChevron`'s button form
(the dated axis's row disclosure, [[Collapsing a bar's subtree]]). ARIA gives `option`
**presentational children**, so a user agent may flatten that subtree — discarding the
button's role and its `aria-expanded` along with it.

Two placements were tried on the timeline row and neither is clean:

- `aria-expanded` on the ROW. Refused outright: `option` does not support that state at
  all, so it is discarded rather than merely at risk.
- `aria-expanded` on a nested BUTTON, which is what shipped. Better on every reading —
  it is a real control for a pointer, it can carry a `disabled` flag that means
  something, and it is *focusable* (`tabindex="-1"`), which is the case the presentational
  children rule is generally read as not removing, since removing a focusable node makes
  it unreachable. "Generally read as" is the whole problem: this repository cannot run a
  screen reader, so which user agents flatten it, and what they say when they do, is
  unchecked.

What survives flattening in either case is the row's **accessible name**, which is
content-derived: the button's label joins it, and because that label is worded
"Show children" / "Hide children" it flips with the state. So the fact is conveyed, and
the ACTION is reachable from the row menu, which offers the same toggle in the same
words. That is the floor the feature actually stands on today, and it is deliberately
narrower than "the disclosure is announced as a disclosure".

## What would settle it

Two candidate answers, and the choice is a product decision about the whole projection
rather than about this control:

1. **A grid, not a listbox.** The dated axis becomes `treegrid` / `row` / `gridcell`,
   where `aria-expanded` on a row IS supported and children are not presentational. The
   register already expects this shape — *"the 2D treegrid semantics come with the
   scheduling feature"* in `src/view/CLAUDE.md` — and it costs the pane's keyboard model,
   its selection model and `aria-activedescendant`, so it is a redesign rather than an
   attribute move. It does nothing for the BOARD's cards, which are options for good
   reasons.
2. **The disclosure outside the option.** A sibling control beside the row, with the row
   naming it. Cheap in markup and expensive everywhere else: on the timeline the chevron
   lives in the sticky lead column, INSIDE the row's own box, and pulling it out means
   pulling the lead column out of the row.

Neither belongs in the increment that found it, and both need the thing
[[What a screen-reader user is promised]] is missing: a statement of what a projection
promises, so a redesign can be checked against something.

## What to do meanwhile

Say the narrow thing, in the code and in the register: the button is a real control and
what a screen reader is CERTAIN to get is the row's name and the menu's entry. Do not
write "the state is announced" anywhere, in a comment or a criterion, until a device has
said so. [[Smoke test the roadmap]] carries the row that asks a device.
