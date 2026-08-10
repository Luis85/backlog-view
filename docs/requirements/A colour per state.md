---
type: PBI
parent: "[[The timeline]]"
order: 80
status: Done
priority: P2
created: 2026-08-10
source: user request
files:
  - src/domain/stateColors.ts
  - src/domain/settings.ts
  - src/domain/settingsResolve.ts
  - src/domain/settingsConsistency.ts
  - src/domain/viewOptions.ts
  - src/domain/board.ts
  - src/ui/stateColorsDialog.ts
  - src/view/interactions/stateColors.ts
  - src/view/render/timeline.ts
  - src/view/render/legend.ts
  - src/view/render/toolbarControls.ts
  - src/view/manual/setupSection.ts
  - styles/stateColors.css
  - styles/stateColorsDialog.css
---

# A colour per state

**As** someone reading the dated axis, **I want** to pick the colour a workflow state is
drawn in, **so that** the state I actually watch for wears the colour I associate with it
instead of whichever one its place in the list happened to give it.

[[State colour and a legend]] made a state's colour **positional**: a slot by its index in
the vocabulary, four slots rotating, CSS deciding what each paints. That stays the default —
it needs no configuration and can never leave a state unkeyed — and this adds a pick beside
it: a real colour picker, in a dialog of the plugin's own.

## The two shapes, and why both stay

This note first specified a **dropdown of Obsidian's eight theme colour names**, one view
option per state, and that is where the names come from. The dropdown is gone; the names
are not, and the reason each half moved is worth stating:

- **Bases cannot host a picker.** Its option schema is dropdown, file, folder, formula,
  multitext, property, slider, text and toggle — there is no colour control, and the
  `type: 'color'` in the typings belongs to the declarative Settings API (1.13.0), not to
  Bases. A name in a dropdown was the only colour a view option could express, so the
  setting leaves the view options entirely and the entry point becomes a button.
- **A name still earns its place.** It resolves through `--color-*-rgb`, so it follows
  light, dark and whatever theme is installed; a hex does not. Keeping both means a
  hand-edited `.base` and every file written before the picker keep working, and the theme-
  aware option is still reachable to anyone who wants it.
- **What a hex costs is stated where the value is defined and in the dialog's own intro**: a
  colour chosen in light mode is that same colour in dark. It is also why the picker
  **seeds** each swatch from the colour that state is currently drawn in rather than from a
  fixed list — a choice starts where the theme already was, and stops moving from there.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The palette button on the roadmap's toolbar |
| **Preconditions** | Roadmap mode on the dated axis, and a workflow with DECLARED states — the legend's own gate, plus the one that makes a choice storable |
| **Guarantee** | A bar and the legend swatch that keys it take the same class and the same picked colour, always, because one function decides both. A pick can therefore never put a colour on the grid the legend does not explain — the failure every defect in [[State colour and a legend]] was an instance of. |

**Main flow**

1. The button renders on the roadmap's dated axis — the legend's gate — and only where a
   colour can be stored; pressing it opens the dialog.
2. The dialog shows one row per DECLARED state, across both workflows, each state listed
   once (`colorableStates`).
3. Each row's swatch opens on the colour that state is drawn in right now: the chosen one
   if there is one, else the class it wears, read off the live stylesheet.
4. Choosing a colour writes `stateColor.<state>` immediately, so the grid behind the dialog
   is a live preview; the arrow beside the swatch clears it back to the default.
5. The bar and its legend swatch take the class `stateColorPaint` gives, and a chosen hex
   inline over it — one call, both marks.

**Extensions**

- **1a — the states are OBSERVED rather than declared.** No button, and the notice names the
  box that fixes it. This is a correctness rule, not tidiness: `resolveSettings` builds the
  colour table from the two declared lists and has no model, so an observed state's colour
  would be written and discarded by the very next refresh — accepted on screen and silently
  doing nothing. Found in review before it shipped.
- **1b — nothing to colour at all.** The button is withheld rather than opening onto an
  empty dialog, and both ask `hasColorableStates`, so the two cannot drift.
- **2a — a done state.** Listed like any other, and the intro says what choosing one does:
  nothing. Its bar is green by specificity whatever is chosen. Offered rather than hidden
  because the row set is the vocabulary, and a vocabulary with a hole in it invites the
  question this sentence answers.
- **2b — both workflows spell a state the same way.** One row. The colours are one table
  keyed by the state VALUE, so a second row would be two controls over one key — and this is
  the common case, since a Deliverable workflow with no states of its own falls back to the
  requirements list entire.
- **3a — the swatch has no empty state.** An `<input type="color">` always holds a colour,
  so "no choice" cannot be expressed by the picker itself. That is the whole reason for the
  reset button beside it: without one, a state could be changed but never un-chosen, and the
  default would be unreachable once anything was picked. It is disabled where there is
  nothing to reset, since an always-available reset is inert on most rows — and that
  disabling tracks the row as the dialog is USED, not the state it opened in: a colour just
  chosen on a default row is a setting that now exists, and a control still disabled over it
  would strand the user until they closed and reopened. Both directions, so a reset returns
  the row to its default and the control with it.
- **3b — the reset has to move the swatch too, and to the DEFAULT.** A row therefore carries
  the chosen colour and the default separately: they differ exactly when a choice exists,
  which is the only time the reset does anything. Restoring the choice instead — which is
  what a single `value` field produces — clears the setting while leaving the old colour on
  screen, and then swallows the `change` event if the user immediately re-picks it, because
  the input's value never moved. Found in review; the default is probed from the state's
  SLOT class, never from the paint's own, since a state chosen by NAME wears that name's
  class and probing it would answer the choice.
- **4a — the `.base` holds a value neither shape allows.** Read as no choice. `stateColor`
  takes a name or a six-digit hex and refuses everything else — `#fff` included, deliberately:
  the picker emits one shape, this value reaches a style attribute, and expanding shorthand
  would mean the stored form is not what was written.
- **5a — the choice names a state the drawn palette does not carry.** Nothing is coloured.
  Two mechanisms hold it at different distances: `resolveSettings` reads a colour only for a
  state a declared vocabulary lists, and `stateColorPaint` asks the SLOT before the choice,
  which covers what the first cannot see — the choice is per VALUE while the slot is per
  PALETTE, so a Deliverable carrying a requirements state by the same name is coloured by
  neither. The order of those two lines is load-bearing rather than taste.

## Acceptance criteria

- A chosen colour reaches the bar and the legend swatch that keys it identically, in both
  stored shapes: a NAME as the same class on both, a HEX as the same inline value on both.
  A state nobody chose keeps its positional slot with nothing inline.
- Clearing a choice returns that state to its slot colour, not to the plain accent — which
  is what keeping the slot class under an inline colour buys — and puts that same slot
  colour back in the swatch rather than leaving the cleared choice showing.
- A choice is offered only for a DECLARED state, in either workflow, deduped by `sameValue`.
  An observed-only vocabulary offers nothing and says why: the resolver cannot see observed
  states, so a colour stored against one would be discarded on the next refresh.
- The button renders under the legend's own gate — roadmap mode, dated axis — and nowhere
  else, and is withheld where the dialog would be empty. Both ask one predicate.
- A hand-edited value outside the two shapes resolves to no choice, `#fff` included, and
  `settingsInconsistency` rejects a fixture holding one — key and value alike.
- Each choice is written as it is made, so an untouched row writes nothing and there is no
  Save that could turn a seeded swatch into a choice. Only the `.base` is written: no note,
  no frontmatter, so neither the write gate nor `configProblems` is involved.
- **Not verifiable here, as ever: appearance and the picker itself.** jsdom draws no
  stylesheet, so every seed under test is the fallback, and `<input type="color">` opens no
  platform picker. That a seeded swatch really matches the bar beside it, and that the
  dialog is usable at a workflow's length, are live-vault checks on
  [[Smoke test the roadmap]] rather than claims of the suite.

## How this one is checked

`test/view/stateColors.test.ts` drives a rendered grid and never asserts what the bar
carries without asking the legend for the same state's swatch in the same breath — the
pairing is the check, because the eight defects this feature's predecessor records were all
one side moving without the other. It asks it of both stored shapes.
`test/domain/stateColors.test.ts` takes the half that needs no DOM: the validator in both
directions, `colorableStates`, `stateColorPaint`'s slot-before-choice order, and that
`stateColor.*` is no longer declared as a view option at all.
`test/view/stateColorPicker.test.ts` drives the button and the dialog — where the button
renders and where it is withheld, which rows are offered, that a choice writes as it is made
and an untouched row writes nothing, and that the reset writes null.

What is deliberately NOT claimed: the seed. `paintedColor` reads `getComputedStyle`, and
jsdom loads no stylesheet, so every test sees `FALLBACK_SEED`. The tests state that a row
HAS a seed and that `hexOf` converts a painted colour correctly; whether the resolved value
matches the bar is exactly the live-vault item above.

## Where it lives

`src/domain/stateColors.ts` is what a choice IS and who may have one: `stateColor` (a name
or a six-digit hex, or null), `isColorName` (which half a stored value is), `stateColorKey`
(the persisted key, by `wipLimitKey`'s rule — no longer a view-option key, since nothing
declares it in the schema) and `colorableStates` (the declared vocabularies, deduped, which
is the rule the Deliverables option group used to restate for its own boxes). It takes the
two vocabularies as lists rather than a `BacklogSettings`, so `settingsResolve.ts` can call
it while still building that object.

`resolveSettings` (`src/domain/settingsResolve.ts`) reads one `stateColors` table over those
states, and `colourProblem` (`src/domain/settingsConsistency.ts`) is that rule read backwards
for a fixture that skips the resolver · `src/domain/viewOptions.ts` declares no colour option,
which the manual's coverage check now enforces from the other side · `stateColorPaint`
(`src/domain/board.ts`) is the single place a class and an inline colour are decided together,
beside `paletteSlot` because it is that function plus one question.

`src/ui/stateColorsDialog.ts` is the dialog and knows only what a state is called — rows in,
a change out — which is what keeps it in `ui/` beside the other dialogs ·
`src/view/interactions/stateColors.ts` is the backlog half: it builds the rows, reads each
class's painted colour off the live stylesheet through a probe, answers `hasColorableStates`
for the button, and writes each change with `config.set`.

`renderStateColorsButton` (`src/view/render/toolbarControls.ts`) is the one entry point, in
the roadmap's projection zone · `src/view/render/timeline.ts` puts the class and the inline
colour on a bar's row and `src/view/render/legend.ts` puts the same pair on the swatch ·
`styles/stateColors.css` paints the eight names, `styles/timeline.css` and
`styles/legend.css` read the one token both halves write, and
`styles/stateColorsDialog.css` holds the dialog's layout and the probe's two rules ·
`src/view/manual/setupSection.ts` explains the dialog rather than claiming an option key.
