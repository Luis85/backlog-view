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
  - src/domain/settingsConsistency.ts
  - src/domain/viewOptions.ts
  - src/domain/board.ts
  - src/view/render/timeline.ts
  - src/view/render/legend.ts
  - src/view/manual/setupSection.ts
  - src/view/manual/sections.ts
  - styles/stateColors.css
---

# A colour per state

**As** someone reading the dated axis, **I want** to say which colour a workflow state is
drawn in, **so that** the state I actually watch for wears the colour I associate with it
instead of whichever one its place in the list happened to give it.

[[State colour and a legend]] made a state's colour **positional**: a slot by its index in
the vocabulary, four slots rotating, CSS deciding what each paints. That is the right
DEFAULT — it needs no configuration and it can never leave a state unkeyed — but it is
only ever a coincidence when the colour means something to the reader, and reordering the
vocabulary repaints every state below the insertion. This PBI keeps the default exactly as
it was and adds a pick beside it.

The pick is a NAME, never a colour value: one of Obsidian's eight chromatic families,
chosen from a dropdown, resolved to a class, painted by `styles/stateColors.css`. That is
the badges' Borrowed Palette Rule and the slots' own TS-names-the-class, CSS-owns-the-colour
split, kept rather than bent — a picked colour still tracks the user's theme, and the
string a `.base` holds never becomes a colour this plugin did not write.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | A workflow state is given a colour in the view options |
| **Preconditions** | That state is in a configured vocabulary — the boxes are generated from `stateValues` / `deliverableStateValues` |
| **Guarantee** | A bar and the legend swatch that keys it take the SAME class, always, because one function decides it. A pick can therefore never put a colour on the grid the legend does not explain — the failure every defect in [[State colour and a legend]] was an instance of. |

**Main flow**

1. Each configured state gets a `Colour for <state>` dropdown, offering the eight theme
   colours and `By position` — the default, which is no pick at all.
2. A state with a pick draws `pbl-state-c-<name>` instead of its `pbl-state-N` slot, on the
   bar's row and on its legend swatch alike (`stateColorClass`).
3. A state with no pick is untouched: it keeps the slot its place in the vocabulary gives
   it, so naming one colour never repaints the rest.
4. A done state is unaffected either way. Its bar takes green by specificity and its swatch
   is keyed `pbl-legend-done`, so the pair still agrees and the pick is simply inert.

**Extensions**

- **1a — both workflows spell a state the same way.** One box, not two. The colours are one
  table keyed by the VALUE, so a second box would be two controls over one key — and this is
  the common case rather than an edge one, since a Deliverable workflow that declares no
  states of its own falls back to the requirements list entire.
- **2a — the `.base` holds a colour no dropdown could have produced.** Read as no pick. The
  file is hand-editable and this string becomes a class name, so `stateColorName` validates
  against the offered list rather than passing a value through.
- **2b — the pick names a state the drawn palette does not carry.** Nothing is coloured.
  Such a bar draws the plain accent and the legend has no swatch for it, so honouring the
  pick would key nothing — a colour exists on the grid only where a swatch can name it.
  Two mechanisms hold this, at different distances: `resolveSettings` reads a pick only for
  a state some configured vocabulary lists, so a key left behind by a deleted state is never
  in the table at all; and `stateColorClass` asks the SLOT before the pick, which is what
  covers the case the first cannot see — the pick is per VALUE while the slot is per
  palette, so a Deliverable carrying a requirements state by the same name is coloured by
  neither. The second is why the order in that function is load-bearing rather than taste.
- **3a — the picked colour is one of the four the slots reserve.** Allowed. `STATE_COLOR_SLOTS`
  reserves red, cyan, green and purple against the colours this plugin assigns BY ITSELF; a
  pick is the user choosing that collision, and the legend keys it off the same class either
  way, so the strip still explains the grid.

## Acceptance criteria

- A picked state's bar and its legend swatch carry the same class, and a state nobody named
  keeps its positional slot.
- A pick on a done state changes neither the bar's green nor the `pbl-legend-done` swatch.
- A hand-edited value outside the offered names resolves to no pick rather than to a class.
- Every offered name has a rule in `styles/stateColors.css` setting `--pbl-state-color` —
  asserted over the offered list itself, so a name added without a rule fails rather than
  drawing a class nothing paints.
- Each state is offered exactly one colour box across both workflows, and `stateColor.*` is
  claimed by exactly one manual entry (which `test/docs/surfaces.test.ts` already enforces
  for every generated option family).
- A state named `constructor`, `toString` or any other `Object.prototype` member takes its
  positional slot, never a colour inherited off the prototype. The table is read with
  `byName`, which is the rule `nameTable`'s own doc states and which its doc says had been
  broken on three tables before this one — here the inherited value would become a class
  containing spaces, which `addClass` rejects outright.
- A hand-built `BacklogSettings` naming a colour the resolver would have dropped — an
  unconfigured state, or a value outside the offered names — is rejected by
  `settingsInconsistency`, key and value alike. Raised in review on this change, and it is
  the same half-a-job shape that module already records twice for the limit and policy maps:
  here the value is what a CLASS NAME is built from, so an unchecked one lets a fixture
  assert `pbl-state-c-<anything>`, which no stylesheet paints.
- **Not verifiable here, as ever: appearance.** jsdom asserts classes, not pixels. That the
  eight names read as eight distinguishable colours in a real theme, light and dark, and
  that a Bases `dropdown` renders its empty-string entry as a usable "no pick", are
  live-vault checks — added to [[Smoke test the roadmap]] rather than claimed by the suite.

## How this one is checked

`test/view/stateColors.test.ts` drives a rendered grid and never asserts a class the bar
carries without asking the legend for the same state's swatch in the same breath — the
pairing is the check, because the eight defects this feature's predecessor records were all
one side moving without the other. `test/domain/stateColors.test.ts` takes the half that
needs no DOM: the validator in both directions, the generated boxes across two workflows,
the resolver's one table, and the stylesheet read as text against the offered list rather
than against a sample of it.

What is deliberately NOT claimed: the slot sweep in `test/view/legend.test.ts` still runs
over fixtures with no picks in them. It states the vocabulary-by-configuration space, and a
pick is a third dimension nothing sweeps — the invariant it rests on (bar and swatch agree)
is held here by construction instead, since both read one function.

## Where it lives

`src/domain/stateColors.ts` is the vocabulary: `STATE_COLOR_NAMES` (the eight offered
names), `STATE_COLOR_CHOICES` (the same list as the dropdown shows it), `stateColorKey`
(the persisted option key, by `wipLimitKey`'s rule) and `stateColorName` (what a
hand-editable `.base` is allowed to say). Its own module rather than more of
`src/domain/settings.ts`, which is at the line cap that exists to ask that question.

`resolveSettings` (`src/domain/settings.ts`) reads one `stateColors` table across both
vocabularies, keyed by the lowercased value, and `colourProblem`
(`src/domain/settingsConsistency.ts`) is the same rule read backwards, so a fixture that
skips the resolver cannot hold a colour it would have dropped · `src/domain/viewOptions.ts` generates the
dropdown per configured state, the requirements workflow's in its group and the
Deliverables workflow's in its own, minus any the first already offered ·
`stateColorClass` (`src/domain/board.ts`) is the single place a pick outranks a slot, and
it sits beside `paletteSlot` because it is that function plus one question ·
`src/view/render/timeline.ts` puts the class on a bar's row, and `src/view/render/legend.ts`
puts the same one on the swatch · `styles/stateColors.css` decides what each name paints,
off the `--pbl-state-color` token both consumers already read.

`src/view/manual/setupSection.ts` is the setup section of the manual, moved out of
`src/view/manual/sections.ts` here for the reason its own header states: it is the section
that grows with the SCHEMA, and a colour box per state took the file it shared past the cap.
