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
  - src/ui/colorPickerDialog.ts
  - src/view/interactions/stateColors.ts
  - src/view/render/timeline.ts
  - src/view/render/legend.ts
  - src/view/render/toolbarControls.ts
  - src/view/registry.ts
  - src/commands/stateColors.ts
  - src/main.ts
  - src/view/manual/setupSection.ts
  - styles/timeline.css
  - styles/legend.css
  - styles/colorPicker.css
---

# A colour per state

**As** someone reading the dated axis, **I want** to pick the colour a workflow state is
drawn in, **so that** the state I actually watch for wears the colour I associate with it
instead of whichever one its place in the list happened to give it.

[[State colour and a legend]] made a state's colour **positional**: a slot by its index in
the vocabulary, four slots rotating, CSS deciding what each paints. That stays the default —
it needs no configuration and can never leave a state unkeyed — and this adds a pick beside
it: a real colour picker, in a dialog of the plugin's own.

## What this replaced, and why it could be replaced freely

This note first specified a **dropdown of Obsidian's eight theme colour names**, one view
option per state. It shipped and was replaced the same day, so what it cost is worth
stating rather than deleting:

- **Bases cannot host a picker.** Its option schema is dropdown, file, folder, formula,
  multitext, property, slider, text and toggle — there is no colour control, and the
  `type: 'color'` in the typings belongs to the declarative Settings API (1.13.0), not to
  Bases. A name in a dropdown was the only colour a view option could express. The moment a
  real picker is wanted, the setting has to leave the view options entirely.
- **The eight names were never in a release.** `0.6.0` was published at 07:38 and the names
  merged at 10:44, so no `.base` in the world holds one. There is therefore **no migration
  and none is owed** — a stored name reads as no pick and the state falls back to its slot,
  the same as any unreadable value. Recorded because the absence of a migration is the kind
  of thing a later reader assumes was an oversight.
- **What was lost is theme-tracking, and it is a real loss.** A name resolves through
  `--color-*-rgb`, so it followed light, dark and whatever theme was installed. A hex does
  not. This is the trade the picker makes, stated at the value in `domain/stateColors.ts`
  and in the dialog's own intro, and it is why the picker **seeds** each swatch from the
  colour that state is currently drawn in rather than from a fixed list: a pick starts where
  the theme already was, and stops moving from there.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | `⋯ → State colours` in the view's toolbar, or the `State colours` command (`pick-state-colors`) |
| **Preconditions** | A workflow with a state property, and a loaded view — the rows come from `statePalettes`, which is derived from the model |
| **Guarantee** | A bar and the legend swatch that keys it take the same class and the same picked colour, always, because one function decides both. A pick can therefore never put a colour on the grid the legend does not explain — the failure every defect in [[State colour and a legend]] was an instance of. |

**Main flow**

1. The dialog opens with one row per workflow state, across both workflows, each state
   listed once — the states `statePalettes` carries, in the order the legend keys them.
2. Each row's swatch opens on the colour that state is drawn in right now: the picked one
   if there is one, else the positional slot's own colour, read off the live stylesheet.
3. Picking a colour writes `stateColor.<state>` to the `.base`; the arrow beside the swatch
   clears it, and the state goes back to its slot.
4. Saving writes only the rows that were touched, so a dialog opened and closed writes
   nothing at all.
5. The bar and its legend swatch both take `--pbl-state-pick`, composed over the slot's own
   `--pbl-state-color` by the stylesheet.

**Extensions**

- **1a — nothing to colour.** No workflow property, or a vocabulary that is all done values,
  and the dialog does not open: a notice names the one thing that fixes both. An empty
  dialog would be a control that cannot be wrong and cannot be right.
- **1b — a done state.** Not listed. Its bar is green by specificity whatever is picked, so
  a row for it would provably change nothing — worse than no row. The intro says so rather
  than leaving it to be found.
- **1c — both workflows spell a state the same way.** One row. The colours are one table
  keyed by the state VALUE, so a second row would be two controls over one key — and this is
  the common case, since a Deliverable workflow with no states of its own falls back to the
  requirements list entire.
- **2a — the swatch has no empty state.** An `<input type="color">` always holds a colour,
  so "no pick" cannot be expressed by the picker itself. That is the whole reason for the
  reset button beside it: without one, a state could be changed but never un-set, and the
  positional default would be unreachable once anything was chosen.
- **3a — the `.base` holds a value no picker could produce.** Read as no pick. The file is
  hand-editable, so `stateColorValue` normalises what it accepts (`#abc` expands, case
  drops) and refuses everything else, including the eight names this note used to specify.
- **5a — the pick names a state the drawn palette does not carry.** Nothing is coloured.
  Two mechanisms hold it at different distances: `resolveSettings` reads a pick only for a
  state some configured vocabulary lists, and `stateColoring` asks the SLOT before the pick,
  which covers what the first cannot see — the pick is per VALUE while the slot is per
  PALETTE, so a Deliverable carrying a requirements state by the same name is coloured by
  neither. The order of those two lines is load-bearing rather than taste.

## Acceptance criteria

- A picked state's bar and its legend swatch carry the same slot class and the same
  `--pbl-state-pick`; a state nobody picked keeps its positional slot and sets no token.
- Clearing a pick returns that state to its slot colour, not to the plain accent — which is
  what the stylesheet composing the two tokens buys, rather than TS writing one of them.
- **`--pbl-state-color` is still CSS-declared and never written by a render.** TS writes
  `--pbl-state-pick`, its own token, so the slot's stays overridable by a snippet. Writing
  the slot's token directly would make it internal by the rule
  [[A documented restyling surface]] states about a property a render fights, and would
  decide that note's open question by accident.
- A pick on a done state changes neither the bar's green nor the `pbl-legend-done` swatch,
  and no such row is offered.
- A hand-edited value outside `#rrggbb` resolves to no pick, and `settingsInconsistency`
  rejects a fixture holding one — key and value alike.
- The dialog writes only what was touched, and only to the `.base`: no note, no frontmatter,
  so neither the write gate nor `configProblems` is involved.
- The command (`pick-state-colors`) and the `⋯` entry run ONE function — neither builds its
  own dialog, and neither reaches view internals the other cannot.
- **Not verifiable here, as ever: appearance and the picker itself.** jsdom draws no
  stylesheet, so every seed under test is the fallback, and `<input type="color">` opens no
  platform picker. That a seeded swatch really matches the bar beside it, and that the
  dialog is usable at a workflow's length, are live-vault checks on
  [[Smoke test the roadmap]] rather than claims of the suite.

## How this one is checked

`test/view/stateColors.test.ts` drives a rendered grid and never asserts what the bar
carries without asking the legend for the same state's swatch in the same breath — the
pairing is the check, because the eight defects this feature's predecessor records were all
one side moving without the other. `test/domain/stateColors.test.ts` takes the half that
needs no DOM: the value normaliser in both directions, the resolver's one table across two
vocabularies, and that `stateColor.*` is no longer declared as a view option at all.
`test/view/stateColorPicker.test.ts` drives the dialog itself — which rows it offers, that
an untouched row writes nothing, that the reset button writes null, and that the notice
stands in for an empty one.

What is deliberately NOT claimed: the seed. `slotColor` reads `getComputedStyle`, and jsdom
loads no stylesheet, so every test sees `FALLBACK_SEED`. The test states that a row HAS a
seed and that the fallback is what an unresolvable slot gives; whether the resolved value
matches the bar is exactly the live-vault item above.

## Where it lives

`src/domain/stateColors.ts` is what a pick IS: `stateColorValue` (what a hand-editable
`.base` may say, normalised) and `stateColorKey` (the persisted key, by `wipLimitKey`'s
rule — no longer a view-option key, since nothing declares it in the schema) ·
`resolveSettings` (`src/domain/settingsResolve.ts`) reads one `stateColors` table across
both vocabularies, and `colourProblem` (`src/domain/settingsConsistency.ts`) is that rule
read backwards for a fixture that skips the resolver · `src/domain/viewOptions.ts` no longer
declares a colour option, which is what the manual's coverage check now enforces from the
other side · `stateColoring` (`src/domain/board.ts`) is the single place a slot and a pick
are decided together, beside `paletteSlot` because it is that function plus one question.

`src/ui/colorPickerDialog.ts` is the dialog and knows nothing of backlogs — labels, values,
seeds and a delta back — which is what keeps it in `ui/` beside the other dialogs ·
`src/view/interactions/stateColors.ts` is the backlog half: it builds the rows from
`statePalettes`, reads each slot's painted colour off the live stylesheet through a probe,
and writes the result with `config.set`. `StateColorTarget` there is exactly the four
members it uses, which is what lets the `⋯` entry (holding a `BacklogViewHost`) and the
command (holding a `LiveBacklogView`, `src/view/registry.ts`) run one function.

`src/view/render/toolbarControls.ts` carries the `⋯` entry — the first with no button of
its own, a category `OverflowEntry.cls` now names · `src/commands/stateColors.ts` and
`src/main.ts` carry the command · `src/view/render/timeline.ts` puts the class and the token
on a bar's row and `src/view/render/legend.ts` puts the same pair on the swatch ·
`styles/timeline.css` and `styles/legend.css` compose `--pbl-state-pick` over
`--pbl-state-color`, and `styles/colorPicker.css` holds the dialog's layout and the probe's
two rules · `src/view/manual/setupSection.ts` explains the dialog rather than claiming an
option key.
