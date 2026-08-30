---
type: PBI
parent: "[[Theming and styling]]"
order: 50
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Light, dark and reduced motion

The view is checked in both theme variants, with reduced motion on, and against a
non-default theme — and the checklist stays, because none of it can be tested here.

**As** someone using a community theme, a dark mode, or reduced motion, **I want** the
backlog to look right in my setup, **so that** it reads as part of Obsidian rather than as
a plugin that assumed the default theme.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone whose appearance settings are not the defaults |
| **Trigger** | Opening the view in a theme variant, a community theme, or with reduced motion on |
| **Preconditions** | A live vault — `npm run test-build` builds one |
| **Guarantee** | Nothing signals by colour alone. A done row, an orphan and a context row stay identifiable without colour vision. |

**Main flow**

1. The checker builds a vault and opens the view.
2. They look at it in light and in dark.
3. They look at it under one non-default community theme.
4. They turn reduced motion on and look again.

**Extensions**

- **2a — a semantic colour is hard to read.** The two in use, green for done and orange for
  orphan and warning, are checked against the muted row background in both variants and
  against the four badge colours.
- **3a — the theme redefines a token.** That is the case worth the trip: a theme that
  changes the accent hue or a `--color-*` is the only real test of variable-driven colour.
- **4a — something needs adjusting.** The fix goes in the **source partial** that owns the
  rule, never the assembled `styles.css`, which the next build overwrites.
- **4b — a behaviour change falls out of the look check.** It becomes a separate note, the
  way the existing appearance issue already insists.

## Why this is a note rather than a habit

`docs/tests/cases/Smoke test the visual changes.md` records the standing limitation in one
line: *"No test in this repository has ever checked what the plugin looks like."* The
jsdom harness drives real events against the real view and renders nothing. That note is
deliberately kept open as a **checklist to re-run** rather than closed as history, and
this PBI is the theming half of the same arrangement.

The stylesheet already handles the cases; what is missing is evidence and a repeatable
way to get it:

- `@media (prefers-reduced-motion: reduce)`, the whole of `styles/motion.css` — spinners
  step rather than spin, the busy chip appears without a fade.
- `@media (hover: none)`, the whole of `styles/touch.css` plus the two reveals that have
  to sit beside what they override (`.pbl-add` in `columns.css`, `.pbl-bucket-add` in
  `roadmap.css`) — the hover-revealed controls need a touch path.
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
- Anything adjusted is adjusted in the **source partial** that owns the rule, not in the
  assembled `styles.css`. `One stylesheet per concern` lands first and makes the root file
  a build artifact, so an edit there is overwritten by the next build without ever
  reaching the partial — and this PBI is the one most likely to invite exactly that, since
  a look check finds its subject by inspecting rendered output. A behaviour change coming
  out of a look check is a separate note, the way the appearance issue already insisted.
- The result is a **re-runnable checklist** left in `docs/tests/cases/`, not a closed task.
  Every future theming change and every new locale needs the same pass, and the register
  has already established that these get reopened rather than rewritten.
- It records which theme was used. "Checked against a community theme" is not evidence a
  year later if nobody wrote down which one.

## Where it lives

**Nothing yet — this note is design.** `styles.css` — after `One stylesheet per concern`,
its source partials — carries the
`prefers-reduced-motion` and `hover: none` blocks and the two semantic colours ·
`test-build.mjs` is the one-command path to a vault, which is what made the last round of
these checks cheap enough to do · `docs/tests/cases/Smoke test the visual changes.md` is the
existing checklist this one joins, and the precedent for leaving a re-runnable note behind
rather than closing a task.
