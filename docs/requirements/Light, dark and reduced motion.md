---
type: PBI
parent: "[[Theming]]"
order: 40
status: Open
---

# Light, dark and reduced motion

The view is checked in both theme variants, with reduced motion on, and against a
non-default theme — and the checklist stays, because none of it can be tested here.

## Why this is a note rather than a habit

`docs/issues/Smoke test the visual changes.md` records the standing limitation in one
line: *"No test in this repository has ever checked what the plugin looks like."* The
jsdom harness drives real events against the real view and renders nothing. That note is
deliberately kept open as a **checklist to re-run** rather than closed as history, and
this PBI is the theming half of the same arrangement.

The stylesheet already handles the cases; what is missing is evidence and a repeatable
way to get it:

- `@media (prefers-reduced-motion: reduce)` at line 915 — spinners step rather than spin,
  the busy chip appears without a fade.
- `@media (hover: none)` at line 940 — the hover-revealed controls need a touch path.
- Every colour reads a variable, so both theme variants *should* follow automatically.
  "Should" is the word this PBI exists to remove.

## What needs looking at

- Both theme variants, and at least one popular community theme, which is where
  variable-driven colour actually gets tested — a theme that redefines
  `--color-green-rgb` or the accent hue is the case the plugin never sees otherwise.
- The two semantic colours used for meaning: `--color-green-rgb` for done and progress,
  `--color-orange-rgb` for the orphan and warning states. Contrast against the muted row
  background in both variants, and distinguishable from the four level badge colours.
- Reduced motion, with the OS setting genuinely on rather than the query forced.
- The state chip, the progress bar and the badges at their real sizes — 11px icons, per
  the appearance note's finding that they can look muddy.

## Acceptance criteria

- Checked in light and dark, plus one non-default community theme, via
  `npm run test-build` — the one-command path to a vault, which is what made the last
  round of these checks cheap enough to actually do.
- Nothing signals by colour alone. A done row, an orphan and a context row each remain
  identifiable without colour vision.
- Anything adjusted is adjusted in `styles.css`. A behaviour change coming out of a look
  check is a separate note, the way the appearance issue already insisted.
- The result is a **re-runnable checklist** left in `docs/issues/`, not a closed task.
  Every future theming change and every new locale needs the same pass, and the register
  has already established that these get reopened rather than rewritten.
- It records which theme was used. "Checked against a community theme" is not evidence a
  year later if nobody wrote down which one.
