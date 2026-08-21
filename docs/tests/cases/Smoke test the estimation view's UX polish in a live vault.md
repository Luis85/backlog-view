---
type: Test case
order: 50
parent: "[[Smoke test appearance and chrome]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-20
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
chip, the sticky panel header and the one-line dimension rows was drawn and argued in
`npm run harness`, against the real view, the real fixture and the real assembled
stylesheet, before the code changed — the committed `test/harness/estimation.ts` and an
uncommitted scratch bundle entry of the kind `test/CLAUDE.md` documents — then verified by
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

## What the harness answered about the narrow pane ahead of the walk

Taken 2026-08-21 with the committed `?measure` knob in headless Chromium at
`--window-size` 1200, 900, 700, 560, 460 and 380 — a partial answer to the narrow-pane
item above, recorded so the walk starts from it rather than from nothing. It is NOT the
observation that item asks for: the harness window is not an Obsidian pane, there is no
sidebar, no split and no ribbon taking width off it, and the widths below are therefore
about where the table stops shrinking rather than about which real layouts reach that
point.

Row geometry (`row0`), left to right, in CSS pixels:

| Window | title | total | coverage | confidence | effort | currency | row right edge |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1200 | 224 | 72 | 72 | 72 | 72 | 140 | 717 |
| 900 | **96** | 72 | 72 | 72 | 72 | 140 | 589 |
| 700 | 96 | 72 | 72 | 72 | 72 | 140 | 589 |
| 560 | 96 | 72 | 72 | 72 | 72 | 140 | 589 |
| 460 | 96 | 72 | 72 | 72 | 72 | 140 | 589 |
| 380 | 96 | 72 | 72 | 72 | 72 | 140 | 589 |

Two things follow, and only the first is settled. **The squeeze is entirely the title's
and it bottoms out somewhere near 900px**: every other column is fixed (72px four times,
140px for the currency) and none of them gives up a pixel at any width, which is decision
11 restated as a measurement — all six columns stay present and the title absorbs the
whole deficit down to its 96px floor. **Below that the row stops changing at all**, and
what the row then DOES is the open half: the box is 589px wide in a container narrower
than that, and whether the currency column ends up scrolled, clipped or partially
occluding its neighbour is a question about the scroller, not about the columns. Nothing
here answers it — `getBoundingClientRect` reports the same box whether it overflows into a
scrollbar or under an edge.

So the walk's narrow-pane item still has to be walked, and what it should record is that
second half: at a pane width where the row no longer fits, is the currency column reachable
by scrolling, cut off, or half-drawn over its neighbour? That is the observation the
deferred narrow-width work needs, and the one this repository cannot take.

**That second half turned out to be answerable in the harness too, taken 2026-08-21 — a
harness observation (ADR 0020), not the live-vault walk itself.** The row's minimum is
**588px**: a 96px title floor, four 72px columns, the 140px currency column, five 8px gaps
and 24px of padding; the panel keeps its own 320px floor, so the view needs about **940px**
before the table's track can hold all six columns. `.pbl-est-table` declares
`overflow-y: auto` and no `overflow-x`, and CSS computes a `visible` overflow on one axis to
`auto` when the other axis is not visible — so the table has a horizontal scroller nobody
wrote. Screenshotted at a 900px window: the `Currency` header and every chip on every row
are past the right edge, and the only trace is a 2px sliver of an orange chip against the
table's border — the scroll edge, not a partial draw. So the answer to *scrolled, clipped,
or half-drawn* is **scrolled, with the end column hidden**. The fix is deferred; see
[[Keeping columns whole under a narrow pane]] for the measurement and the corrected reason.
What the harness still cannot answer is whether that scroller is acceptable at a real pane
width — this note stays Open for that reason among the others below.

**The `Current`-chip item's default-colour half is answerable the same way.** Looked at in
both light and dark schemes at 1200px, the plain `Current` chip reads against the panel's
`--background-secondary` fill and against a row. The community-theme half of that question
— whether a theme that tunes `--background-secondary` and the chip's own fill close together
closes the gap — is exactly what ADR 0020 says the harness cannot answer, and it stays open
below.

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
