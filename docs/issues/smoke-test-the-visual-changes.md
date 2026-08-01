---
type: PBI
parent: "[[codebase-health]]"
order: 60
status: Open
priority: P2
area: verification
created: 2026-07-31
source: PR #14
files:
  - styles.css
  - src/view/render/toolbar.ts
  - src/view/render/rows.ts
---

# Smoke-test the visual changes in a real vault

## Why this exists

The jsdom harness drives real DOM events against the real view, so it covers structure
and behaviour well. It renders nothing. **No test in this repository has ever checked
what the plugin looks like**, and PR #14 changed a good deal of appearance.

## Getting a vault to look in

`npm run test-build` bundles the plugin into `.obsidian/plugins/product-backlog-view/`
in this repository and adds it to the enabled list, so the repository root opens as a
vault with the plugin installed. On a first open, turn off Restricted Mode under
*Settings → Community plugins* — until then no community plugin loads at all.
`docs/issues/` is a ready-made backlog to point a Base at — these very notes — so the
checks below have real data to run against.

## What to look at

**Toolbar** — every icon control became a `<button>`. Obsidian's `.clickable-icon`
should strip the default button chrome, but `styles.css` also resets `border`,
`box-shadow`, `background-color` and `cursor` explicitly because that could not be
verified here. Check the toolbar row still reads as one strip of icons, with no boxed
buttons, correct hover, and correct alignment in both light and dark themes.

**Disabled state** — type into the quick filter. Expand all / Collapse all should dim
(`opacity: 0.4`) and stop responding to both mouse and keyboard.

**Focus ring** — `Tab` into the tree with nothing selected. There should be a visible
outline on the tree container; it should disappear as soon as a row is selected, with
the selection taking over as the indicator.

**Busy indicator** — the one most likely to need tuning. Run **Assign missing type and
order properties** over a backlog large enough to take a moment: the toolbar should show
`Updating N of M…` with a spinning icon. Then do a single drag: the indicator should
**not** flash at all, because it sits behind a 250 ms `animation-delay`.

**Row add button** — hover a row; `+` appears. It is now a `<button>` with
`tabindex="-1"`, so it must not appear in the `Tab` order.

**Reduced motion** — with the OS setting on, spinners should step rather than spin and
the busy chip should appear without a fade.

## If the busy indicator flickers

The dial is the `250ms` delay on `.pbl-busy.pbl-busy-on` in `styles.css`. Raising it
trades "quick writes never flash" against "slow writes take longer to announce
themselves". Nothing else depends on the value.

## Acceptance criteria

- Checked in both light and dark themes, and on one non-default theme if convenient.
- Anything adjusted is adjusted in `styles.css` only — none of this should require a
  behaviour change.
