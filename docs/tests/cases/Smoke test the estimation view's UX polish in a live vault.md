---
type: Test case
order: 50
parent: "[[Smoke test appearance and chrome]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-20
closed: ""
source: the estimation view's UX/UI polish pass, 2026-08-20 (task 11 of that pass)
files:
  - src/view/estimation/estimationView.ts
  - src/view/estimation/toolbar.ts
  - src/view/estimation/renderTable.ts
  - src/view/estimation/panel.ts
  - src/view/estimation/currencyChip.ts
  - styles/estimation.css
  - styles/estimationChip.css
  - styles/estimationPanel.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Smoke test the estimation view's UX polish in a live vault

**Covers** [[Reading the estimation table at a glance]].

## Why this exists

The polish pass that added the value and coverage strips, the five-treatment currency
chip, the sticky panel header and the one-line dimension rows was drawn and checked
against `test/harness/mock.ts` and the real assembled stylesheet, then verified by
`npm run check` alone. Both stop at Obsidian's **default** colours (ADR 0020) — a
community theme, a themed accent, and a real pane at a real width are none of them
answerable in this repository. This note names exactly what stays unanswered rather than
letting `npm run check` passing read as more than it verified.

**Preconditions** — `npm run test-build` has installed the plugin into
`.obsidian/plugins/product-backlog-view/` in this repository, the repository is open as a
vault with Restricted Mode off, and a Base is pointed at `docs/` with a scoring model
configured (`docs/Product Backlog.base` already does) so the estimation view has real
rows in every currency treatment.

## How to check

- **Under a community theme**, does the attention orange on `Needs re-estimation`
  separate at a glance from the dashed `Another model`? Both are the same colour family
  in the default theme's absence of an accent fight; a theme that pushes orange toward
  the accent or toward a neutral grey could close the gap between "needs doing" and
  "not vouched for".
- **Under a themed accent**, does the value strip still read as a magnitude rather than
  as a selection? The strip's fill is `var(--interactive-accent)` — the same token a
  selected row's inset border and a held point button use — so an accent tuned for
  strong "this is chosen" contrast could make a half-full bar read as a half-picked
  control instead of a quantity.
- Is the plain `Current` chip visible against the panel's fill in that theme? It was
  invisible once, against `--background-secondary`; that is why the chip takes
  `--background-modifier-hover` instead. This check is the one that would catch a
  regression of that decision under a theme that tunes the two tokens close together.
- Do the ~76px dimension rows read as one line, or as a cramped one, at a real pane
  width? The harness measured the shape; a real font, a real scrollbar and a real split
  pane have not been looked at.
- With a **narrow pane**, what happens to the six columns? **The Whole-Column Rule is
  not implemented in this table** (decision 11 of the design) — a fixed end column
  should be present at full width or absent, never partially occluding its neighbour,
  and the tree implements that with `columnFit` while this table has nothing. Record
  what it *actually does* as the pane narrows past the title's 96px floor; this is a
  known gap to characterise for the deferred narrow-width work, not a pass/fail check.
- Does `prefers-reduced-motion` actually stop the clear control's fade? This is the one
  motion rule in the codebase that does not live in `styles/motion.css` — it sits beside
  the transition it undoes in `styles/estimationPanel.css`, because `motion.css` is
  imported earlier in `styles/index.css` and a media query adds no specificity there. So
  this is the one such rule whose reduced-motion behaviour no other check covers.
- Does the toolbar's undo take back a score, and does the count update? Score a
  dimension, confirm the count changes from e.g. `9 of 11 scored` to `10 of 11 scored`,
  press undo, and confirm both the point button's held state and the count revert
  together.
- With the panel scrolled, is any row content visible **above** the pinned header? The
  pinned-edge rule — padding never sits on an edge something is pinned to — is
  mechanically checked (`.pbl-est-panel { padding-block-start: 0 }`,
  `.pbl-est-header { padding-block-start: … }`, `position: sticky`), but only the three
  declarations are; the visual result is not. The harness page has **no `?scroll=`
  knob**, so this needs a real vault or a scroll by hand.

## What the harness already answers, so this note does not repeat it

`npm run harness` draws the real view against the real stylesheet and answers layout,
spacing, hierarchy, and Obsidian's **default** colours for all of the above. Its
`?measure` knob reads column geometry and computed type — size, weight, colour — out of
headless Chromium, which is how the column-slide and the type-ladder defects in the
design pass were found before this note was ever needed. What stays unanswerable there
is a themed vault's colours, its accent, and anything Bases itself hands the view.

## Runs

| Date | Against | Outcome |
| --- | --- | --- |
| — | the estimation view's UX/UI polish pass (2026-08-20) | **Not run.** |

## Acceptance criteria

- Every item above checked in a live vault, in both light and dark themes, and on one
  non-default community theme if convenient.
- The narrow-pane column behaviour recorded as an observation (what it does), not scored
  pass/fail, and fed into the deferred narrow-width work if it is worse than expected.
- Anything adjusted lands in the `styles/` partial it belongs to, per this repository's
  own rule that a behaviour change found here is corrected there, not patched around.

---

## Outcome

Not yet run. **This is a checklist to re-run, not a record**: appearance and base
identity cannot be tested in this repository, so it stays open until someone has walked
it against a live vault, and it reopens with the next change to `styles/estimation.css`,
`styles/estimationChip.css` or `styles/estimationPanel.css`.
