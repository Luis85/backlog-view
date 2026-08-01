---
type: Issue
order: 20
parent: "[[Product Backlog]]"
status: Done
priority: P2
area: verification
closed: 2026-08-01
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

**Extra-type badges** (added after this note was first closed) — `Issue` renders a
`circle-alert` icon in pink, `Bug` a `bug` icon in red, and an extra type this plugin did
not name gets `circle-dot` and a colour from past the end of the ladder. Check all three
read as peers of the level badges rather than as error states, that pink and red are
distinguishable from each other and from the four level colours in both themes, and that
the two icons render at 11px without looking muddy.

**Done rows** — the strike-through is gone; muting is the whole signal now. Check a
finished row still reads as finished at a glance, and that a done *parent* with an open
child is still tellable from an open one.

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

---

## Outcome

**Checked by the maintainer on 2026-08-01 in a `npm run test-build` vault, and everything
on the list renders as intended.** Nothing needed adjusting — `styles.css` is unchanged,
which is the result this note was hoping for and could not assume.

Two of these were live guesses rather than checks, and both came out right: the explicit
`border` / `box-shadow` / `background-color` / `cursor` resets on the toolbar buttons do
sit correctly under Obsidian's `.clickable-icon` (the reason they were written was that
this could not be verified here), and the 250 ms `animation-delay` on the busy chip is
tuned right — it announces a real batch without flashing on a single drag.

This closes the appearance gap for everything through the undo work. It does not close it
for good: no test in this repository will ever check what the plugin looks like, so a
change to `styles.css` or to the toolbar's markup still needs eyes. `npm run test-build`
is now the one-command path to those eyes, and this note stands as the checklist to
re-run — reopen it, don't rewrite it.
