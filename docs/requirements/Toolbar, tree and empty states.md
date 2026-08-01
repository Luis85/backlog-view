---
type: PBI
parent: "[[Every surface translated]]"
order: 10
status: Open
---

# Toolbar, tree and empty states

The always-visible surface: 23 sites in `toolbar.ts`, 11 in `rows.ts`, 20 in
`columns.ts`, 8 in `emptyStates.ts`.

## What is here

**Toolbar** — the `New <type>` button and its type picker, the tooltips on every icon
control (`Assign missing type and order properties`, `Undo last backlog change`, `Expand
all`, `Collapse all`), the `Grouping ignored` advisory and its explanation, the
`Check view options` warning, the item count, the busy chip's `Updating N of M…`.

**Rows** — the orphan marker (`Parent is set but not part of this view`), the
context-row marker (`Not in this base's filter — shown to keep the hierarchy`), the badge
tooltip for an implied type, and the add-child button's `aria-label`.

**Columns** — the `Progress` / `Items` header, the tag pills' `Add tag` and
`Remove tag <tag>` labels, the rollup tooltip `N of M items done`, and the state chip's
`Set state` / `Change state (currently <value>)`. The chip's static form for a context
row carries its own message (`state can't be changed here`).

**Empty states** — `Loading backlog…`, `No <type> items` with its hint, the no-match
state and `Clear filter`, and the all-done state with `Show completed items`.

## Acceptance criteria

- Every `aria-label`, `setTooltip` and visible label on these four files comes from the
  catalog. Screen-reader text is UI text; leaving it English translates the view for
  sighted users only.
- The three sentences that name a view option by its label — the ignored-notes hint in
  `emptyStates.ts:50`, the toolbar advisory in `toolbar.ts:140`, both quoting *"Ignore
  notes outside the hierarchy"*, and the grouping note — quote the **translated** option
  label, so the text points at a control the user can actually find. Today they spell it
  twice as a literal; after this it is one parameter from one key.
- `Updating N of M…` keeps its 250 ms `animation-delay` behaviour unchanged. The busy
  chip is the one place where a text change could be mistaken for a flicker regression.
- Interpolated *values* stay as the user wrote them: the state name in
  `Change state (currently <value>)`, the tag in `Remove tag <tag>`, the title in the
  truncation tooltip.
- No jsdom test changes behaviour as part of this; assertions move to catalog lookups
  (`Tests do not read English`).
