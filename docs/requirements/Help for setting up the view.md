---
type: PBI
parent: "[[User manual]]"
order: 60
status: Open
priority: P3
created: 2026-08-01
files:
  - src/domain/viewOptions.ts
  - src/domain/settings.ts
  - src/commands/scaffold.ts
  - src/view/render/columns.ts
---

# Help for setting up the view

The manual section on the configuration around the tree: what the view options do, what
the Base's own settings still control, and which two of them this view deliberately
ignores.

## What the section says

- **The fast path is a command.** *Product Backlog: Create backlog* writes a folder, a
  fully configured `.base` and opens the view — the manual should say so before it
  explains a single option.
- **The options that change what the tree *is***: the three property names, `Ignore notes
  outside the hierarchy`, `Show parents outside the filter`, and the home and per-type
  folders. Everything else is presentation.
- **The state property is the switch for progress.** Without one there are no progress
  rollups, no done styling, no state chip and no completed-items toggle; with one, the
  states you list are the vocabulary the chip offers.
- **What the Base still owns**: the filter (which notes exist here at all), the sort
  (which orders unranked items), and the visible properties (which become the row
  columns).
- **What this view ignores, and why**: **group by** — the hierarchy is the grouping, and
  the toolbar says so — and a **limit**, which truncates results and can drop parents,
  so filters are the tool for a backlog.

## Acceptance criteria

- Options are grouped by what they affect rather than listed in schema order; a flat
  table of fourteen fields is what the options panel already is.
- The section says which options are prerequisites for features the user may be looking
  for and not finding — the state property above all.
- It distinguishes the plugin's options from the Base's own settings, since both are
  reached from the same toolbar and only one of them this plugin explains.
- No option key is named in prose that the schema does not define; the section is
  generated from the same schema where it can be, for the reason the types section is.

## Evidence

- `src/domain/viewOptions.ts` — the schema, whose `key`s are persisted user data.
- `src/domain/settings.ts` — resolution and `configProblems`, which is what "misconfigured"
  means concretely.
- [[Parent, order and type properties]], [[Workflow state]], [[Property columns]],
  [[Filtered bases keep their tree]] — the built behaviour.
- `README.md`, sections *Setup* and *View options*.
