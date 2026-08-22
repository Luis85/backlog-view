# The estimation view's UX/UI polish pass, round two — design

Written 2026-08-21, over
`docs/superpowers/specs/2026-08-20-estimation-view-ux-polish-design.md`, whose four
refusals and thirteen decisions all stand. **No new capability.** The nine Open Features
and eight Open PBIs under `Business value estimation` — the value/effort matrix, the
health dashboard, the framework presets, the weighting scenarios, the rubric editor,
`Comparing across products`, `Coverage per objective` — are untouched, and so is
`Editing a dimension's scale`, which owns both the rubric editing surface and the removal
of the dimension's `Range` box.

**Two of the eight decisions below fix defects the entire suite is blind to**, and both
were found the way the previous pass's were: by reading numbers off a real browser. jsdom
lays nothing out and loads no stylesheet, so a computed weight and a cell's own box are
invisible to all 3228 tests.

**Two are refusals**, recorded rather than dropped: a live weight total in the options
panel, and a legible absence where the rubric boxes are not. Both are refused for the same
reason and it is a mechanical one — `BasesOption` carries `type`, `displayName` and
`shouldHide`, and nothing else. There is no description field and no static-text item type,
so either would be a new control in the options menu, which is a feature.

**No vault was opened.** Obsidian does not run in the session this was written in, so
`docs/tests/cases/Smoke test the estimation view's UX polish in a live vault.md` is still
Open and still owed. Two of its items turned out to be answerable in the harness anyway
and are answered here (decision 7, and the note under decision 5); the two it names as
unanswerable — the plain `Current` chip and the accent value strip under a COMMUNITY theme
— stay unanswerable, because the harness only ever answers Obsidian's DEFAULT colours
(ADR 0020).

## What was measured, and with what

`npm run harness -- test/harness/estimation.ts`, then headless Chromium over
`.harness/index.html?config=full&select=Full%20profile&measure`, plus screenshots at four
window widths in both schemes.

**Column geometry is clean and needs nothing.** At a 1200px window there is one left edge
per column across the header and all eleven rows: title 25→249, total 257→329, coverage
337→409, confidence 417→489, effort 497→569, currency 577→717. The previous pass's
cell/chip split holds.

**The type ladder measures four steps and one of them is worn two ways** — decision 5.

**The row bottoms out at 588px and the table then scrolls** — decision 7.

## Decisions

### 1. The sort direction gets a shape, and it gets said out loud

`button.pbl-est-sort:hover` and `button.pbl-est-sort[aria-sort]` share one identical
declaration block — `color: var(--text-normal)` — and `sortHeader` draws no glyph at all.
Two consequences: hovering ANY header makes it look exactly like the sorted one, and
**ascending and descending are visually identical**. DESIGN.md's Shape-Before-Colour Rule
asks every state that matters to survive a monochrome screenshot; the sort direction does
not survive a colour one.

**And it is announced to nobody.** `aria-sort` is not a global attribute — ARIA supports it
on `columnheader` and `rowheader`. The estimation table is `role="listbox"` with
`role="option"` rows, and the header is a plain div holding six buttons, so the attribute
sits on an element whose role does not support it. The first reading of this finding said a
screen-reader user is told the direction and a sighted user is not; what is true is that
neither is.

**The fix is one glyph and one name.** The active header button gains a `chevron-up`
(ascending) or `chevron-down` (descending) at 10px, and an `aria-label` stating the
direction. `aria-sort` **stays** — it is the state marker the stylesheet selects on and the
hook every one of `sort.test.ts`'s direction assertions reads, and it is the attribute a
future move to real column-header roles would already have. What it is not is a thing any
assistive technology reads today, which is why the `aria-label` is added rather than the
attribute being trusted.

**The label moves into its own truncating span, and that is not tidying.** The four numeric
columns are a fixed 72px. `Confidence` is the widest header word and leaves about 10px of
slack in that box, so a glyph appended beside a bare text node pushes the label into the
cell's own `text-overflow: ellipsis` at some widths and in most translations. With the label
in a `.pbl-est-sort-label` span that shrinks and a `.pbl-est-sort-dir` glyph at
`flex: 0 0 auto`, the label truncates gracefully and the direction is never the thing that
disappears. 10px rather than the 12px an icon usually takes, for the same 72px reason.

**The shared `:hover, [aria-sort]` colour block is deliberately NOT split.** Once the glyph
exists, hover is colour alone and sorted is colour plus a glyph — already two signals, one
of which survives monochrome. Splitting the block would introduce a second colour meaning
in a system whose whole premise is that colour is spent, not applied, and buy nothing.

**One rule goes quietly inert and it is worth saying so.** `.pbl-est-title` and
`.pbl-est-cell` set `overflow: hidden; text-overflow: ellipsis`, and those classes are worn
by the row's `<div>` AND the header's `<button>`. With the header's text inside a span, the
button's own `text-overflow` stops having text to clip. The declaration stays because the
row's div is where it is live; the header's inner span carries its own. Stated here because
this repository's last three silent defects were rules that had stopped matching.

### 2. One name for a dimension, in all three places it is named

`dimensionProblems` builds every sentence from `d.id`:
`strategic-alignment: the weight must be a positive number`. The settings panel that
produced the mistake says `Strategic alignment`. `ScoringDimension` has carried a `label`
the whole time, and `estimationSettings.ts` resolves it as
`read.text(dimOption(id, 'label')) || shipped?.label || id` — so it is never empty and there
is no case where the slug is the only name available.

Three changes, one fact:

- **`dimensionProblems` uses `d.label`.** Sentence-initial, so the shipped labels'
  capitalisation is already right.
- **`boundEntries` uses `d.label.toLowerCase()`.** That entry's label lands INSIDE a
  sentence (`settings.sharedKey` joins a list into one), which is why the three scales and
  the two pair slots beside it are plain lowercase nouns. `SUGGESTED_KEYS` already spells
  `d.label.toLowerCase()` for the same reason, so this is the existing shape rather than a
  new one.
- **`dimensionGroup`'s `displayName` uses the RESOLVED label**, not
  `defaultDimension(id)?.label ?? id`. Today a dimension whose id is outside the shipped
  eight is headed by its slug, and one whose `Label` box has been overridden is headed by the
  shipped word while its own panel row shows the override.

**The displayName is not a default, and that distinction is the whole of why this is safe.**
`dimensionGroup`'s comment says the shipped weight is the option's `default`, "never the
CURRENT value, or a dimension already overridden would show its override as though nothing
had been chosen". That argument is about `default` and `placeholder`, which are the boxes'
own empty state, and it is untouched: the `Label` item keeps the shipped label in both. A
group HEADING is not a candidate value — it names which dimension the boxes belong to, and
naming it by anything other than what the panel calls it is the defect this decision fixes.

`getEstimationViewOptions` already resolves the settings, so the resolved dimensions are in
hand; the map moves from `ids` to `settings.model.dimensions`.

**These are English literals in `src/domain/`, which is UNSWEPT.** `UI_TEXT_LITERAL` and
`UI_TEXT_PROPERTY` reach `src/view/estimation/**` and not `domain/`, so a sentence written
here is correct and the identical sentence one directory over would fail lint.
`docs/requirements/Every surface translated.md` owns that slice and this pass does not open
it.

### 3. The weight rule is stated where a weight is typed

`modelProblems` reports `the weights total 87, not 100` and the view draws the problem block
INSTEAD of the table. There are eight weight boxes, so editing one is a guaranteed transient
failure state, and the only feedback is the whole view disappearing.

The refusal itself **stays**, and the reason is worth writing down because reading
`weightedScore.ts` argues the opposite at first glance. `computeTotal` renormalises by the
answered dimensions' own weight sum, so a model totalling 87 computes a number without
dividing by zero — which reads as though the rule were pedantry. It is not: the
renormalisation is what makes a PARTIAL profile agree with
`docs/requirements/The scoring model is configuration.md`'s stated arithmetic, whose full
profile divides by 100. At a sum of 87 a full profile divides by 87 and the model stops being
the one the note specifies. `Configuring the estimation model` extension 3b states the
refusal in as many words. It is register-backed and it is not this pass's to remove.

What this pass changes is where the rule is legible:

- **The box says it.** `Weight` becomes `Weight (% of 100)`. One string per dimension group,
  at the exact box that produces the mistake, before it is made.
- **The refusal says what to type.** `the weights total 87, not 100 (13 short)`. The delta is
  the number the user needs and it is arithmetic already in hand.
- **The lead sentence says where to go.** `estimation.problems.lead` is
  `Fix the estimation model first:`, which assumes the reader knows the model lives in this
  view's options menu. It is reworded to name that. An edit to an existing key in the
  existing `estimation.*` namespace — nothing here is data: no option key, no state value and
  no property name, so the *what breaks if two people with different Obsidian languages open
  the same vault* test answers "one sees different words".

**REFUSED: a live running total in the options panel.** `BasesOption` is
`{ type, displayName, shouldHide? }`. There is no static-text item type and no description
field, so a running total would need a new control — a feature, and one whose value would be
mostly to paper over a refusal the register wants.

### 4. The rubric boxes' absence stays silent, and this is why

`estimationOptions.ts` offers 47 boxes — 4 model items, 8 dimensions × 5, 3 scale properties
— and the rubric SENTENCES, the thing `docs/requirements/A rubric for every point.md` says
every point must have, get none. They are stored keys hand-edited in the `.base`.

A rubric editor is `Editing a dimension's scale` (Open PBI), which also owns taking the
`Range` box out of the options menu so that one surface owns a scale. Nothing here touches
either.

The remaining question was whether the ABSENCE could be made legible where the boxes are not.
It cannot, for the same mechanical reason as decision 3's refusal: an options menu built from
`{ type, displayName, shouldHide? }` items has no way to say anything that is not itself a
control. A disabled box reading "edit this in the `.base`" is a new control with its own
strings and its own styling, and it is a worse version of the surface that PBI already
specifies.

So the absence is reported where it already is: at refusal time, by `dimensionProblems`'
`8 points need 8 rubric sentences, found 5`. Decision 2 is what makes that sentence name its
dimension the way the panel does. That is the whole of what this pass does here, and the rest
is recorded as refused so the next reader does not re-derive it from the typings.

### 5. The Title type step gets one weight

**Found by reading computed style, not by looking.** DESIGN.md's Hierarchy declares **Title**
as `var(--font-ui-medium)`, `var(--font-medium)` — 500 — and names two wearers: empty-state
headlines and the detail panel's item name. Measured:

| Wearer | Declared | Renders |
| --- | --- | --- |
| `.pbl-empty-title` | `--font-ui-medium` / `--font-medium` | 15px / **500** |
| `.pbl-est-header .pbl-est-title` | `--font-ui-medium` / `--font-semibold` | 15px / **600** |

One declared step, two weights on screen. This is the previous pass's decision 12 defect in a
second shape: that pass amended DESIGN.md's **Title** entry to add the panel's item name
(decision 10) and did not check the weight the code was actually using, so the entry documents
a token the panel does not wear. Its own summary table recorded "Title | 15px semibold" as
measured — which was true of the screen and false of the declaration beside it, and neither
half was compared to the other.

**Resolved by conforming the code**, not by amending the entry again:
`.pbl-est-header .pbl-est-title` takes `var(--font-medium)`. Three reasons, in order of
weight. `.pbl-empty-title` already obeys the declaration, so this is one wearer out of step
rather than a declaration out of date. The alternative — semibold in DESIGN.md and
`.pbl-empty-title` lifted to match — changes every empty-state headline in the plugin, which
is deliberately `var(--text-muted)` and deliberately quiet. And 500 under a 20px/600
**Answer** is what decision 10's own argument asks for: the number is the thing the panel
exists to state, and a title at the same weight competes with it.

**A note the smoke test can close.** Its `Current`-chip question has two halves — the default
colours and a community theme's. The default half was looked at in both schemes at 1200px: the
chip reads against the panel's `--background-secondary` fill and against a row. The
community-theme half stands, because that is what ADR 0020 says the harness cannot answer.

### 6. One baseline across the four numeric columns

**Found by looking, then confirmed against the box model.** In both schemes the numbers in
`Value` and `Coverage` sit about 3px above the numbers in `Confidence` and `Effort`, in a
table whose entire job is comparing numbers across a row.

The cause is arithmetic rather than a wrong value. The row is `align-items: center`. A plain
cell's content is one 13px line, about 18px tall. A strip cell is
`display: flex; flex-direction: column; gap: 3px` holding the number plus a 3px strip — about
24px tall. The row centres each cell as a whole, so the taller cell's number starts at the
row's content edge while the shorter cell's number is pushed down by half the difference.
Every cell is centred correctly and the numbers still do not line up.

**The strip leaves the box model, and it stays INSIDE the cell while doing it.** That second
half is not a detail: `.pbl-est-cell`, `.pbl-est-total` and `.pbl-est-coverage` share
`overflow: hidden`, so a strip hung below its cell would be clipped away entirely. The shape
that works is one the cell already almost has:

- the cell keeps its `flex: 0 0 72px` and gains `align-self: stretch`, so it is as tall as the
  row's content box rather than as tall as its own contents;
- it becomes a flex ROW with `align-items: center`, which is what every plain numeric cell
  already effectively is, so the number is centred against the same height they are;
- `.pbl-est-strip` becomes `position: absolute` against that cell, spanning its inline extent
  at the block end.

Then all four numeric cells have one height, the number centres identically in each, and the
strip draws where it already looked like it drew. The exact block-end offset is a measured
number rather than a chosen one — `?measure` is what settles it.

This is the same move and the same reason as the panel's clear control, which the previous
pass made absolute because "as a flex item it wrapped to a line of its own, which made the row
TALLER than the stack it replaced" and "being absolutely positioned it never entered the box
model". A third instance of one idea: **a decoration that annotates a value must not be
allowed to size the box the value is centred in.**

**Verified with a number, not with the eye that found it.** `?measure` gains a probe printing
the `.pbl-est-num` box for all four numeric columns of one row, so "one baseline" is a read
value before and after. The eye found this; the eye is not what closes it.

### 7. The end column is off-screen at 900px — measured, recorded, not fixed

`docs/tests/cases/Smoke test the estimation view's UX polish in a live vault.md` asks what the
six columns actually do as the pane narrows past the title's 96px floor, and calls it a gap to
characterise rather than a pass/fail check. The harness can characterise it, so it is
characterised here and the note's item is answered.

The row's minimum is **588px**: a 96px title floor, four 72px columns, the 140px currency
column, five 8px gaps and 24px of padding. The panel keeps its own 320px floor. So the view
needs about **940px** before the table's track can hold all six columns, and below that the row
stops shrinking and starts overflowing.

**It scrolls.** `.pbl-est-table` declares `overflow-y: auto` and no `overflow-x`, and CSS
computes a `visible` overflow on one axis to `auto` when the other axis is not visible — so the
table has a horizontal scroller nobody wrote. Screenshotted at a 900px window: the `Currency`
header and every chip on every row are past the right edge, and the only trace of the stale row
is a 2px sliver of its orange chip against the table's border. So the answer to *scrolled,
clipped, or half-drawn* is **scrolled, with the end column hidden** — and the sliver is the
scroll edge rather than a partial draw.

**The fix is out of scope and the previously recorded reason for that is wrong.** The previous
spec's decision 11 recorded the Whole-Column gap and its "Out of scope" section deferred it with
narrow-width stacking, because "a real breakpoint wants a live vault's actual pane widths rather
than a threshold guessed in a harness". That reason does not hold: `columnFit` guesses no
threshold — it SUMS the drawn columns' own widths against the measured pane, for the explicit
reason that "a fixed CSS breakpoint would clip two 280px columns in a 700px pane". No breakpoint
is wanted and none is being guessed.

The honest reason to defer is size. The tree's mechanism is a measure-then-re-render pass
(`syncColumnFit` returns whether the verdict CHANGED and the caller owes another pass), a header
that must describe the same frame as the rows, and — new here, with no counterpart in the tree —
a **persisted sort pick that can name a column this pane does not draw**. That is its own PBI,
not a line in a polish pass. Recorded with the corrected reason so the next reader does not
defer it for a reason that was already known to be false.

Nothing is built. `columnFit` is not generalised, no breakpoint is added, and `@container`
remains unavailable.

### 8. DESIGN.md says "column headers" about two different things

Its **Body** entry lists "column and bucket headers"; its **Label** entry lists "badges, chips,
counts, limits, parent breadcrumbs, meta cells". The estimation table's column headers measure
12px — Label — and the previous pass put them there on purpose, because the step inside one
table would otherwise have been 3px where the rest of the interface reads at 1px.

Both are right and the wording cannot say so: "column header" means a board column's header in
the Body entry and a table's column header in the Label one. Qualified in place. A one-line
documentation edit with no code behind it, made because an ambiguous entry in a four-step ladder
is how the next silent drift gets in — which is exactly what decision 5 is cleaning up after.

## Where it lives

- `src/view/estimation/renderTable.ts` — `sortHeader` gains the label span, the direction glyph
  and the direction's `aria-label` (decision 1).
- `src/domain/scoringModel.ts` — `dimensionProblems` and `boundEntries` name a dimension by its
  label (decision 2); the weight-total sentence gains its delta (decision 3).
- `src/domain/estimationOptions.ts` — `dimensionGroup` takes a resolved dimension rather than an
  id and heads its group with the resolved label (decision 2); the `Weight` box names the rule
  (decision 3).
- `src/i18n/en.ts` — two new keys under `estimation.sort.*` for the two directions (decision 1),
  and `estimation.problems.lead` reworded (decision 3). No key, no state value and no property
  name is added, so nothing here is data.
- `styles/estimation.css` — the sorted header's glyph and label spans (decision 1); the two strip
  cells become positioning contexts and `.pbl-est-strip` becomes absolute (decision 6). The
  partial is at 334 of its 400-line cap, so decision 6's block replaces rather than adds and
  decision 1's is small; if the cap is reached, `styles/estimationPanel.css` is the precedent for
  splitting.
- `styles/estimationPanel.css` — `.pbl-est-header .pbl-est-title` takes `var(--font-medium)`
  (decision 5).
- `test/harness/estimation.ts` — a probe printing the four numeric columns' `.pbl-est-num` boxes
  for one row (decision 6), added to the `?measure` knob the previous pass committed for this
  purpose.
- `DESIGN.md` — the Body and Label entries' "column header" wording (decision 8).

No new module, so no new `## Where it lives` entry is owed for one; the register edits below are
for behaviour, not for `docs-check.mjs` rule 7.

## Tests

Each claim, with the check that reaches it — and where a check cannot reach the whole claim, the
sentence is narrowed rather than left standing.

- `test/view/estimation/sort.test.ts` — the natural home for decision 1, and the one with room
  (185 of 450). The active header draws a direction element and the two directions draw DIFFERENT
  ones; an inactive header draws none; the active header's accessible name states the direction;
  the label is inside its own span. **What this does not check** is that the glyph is legible or
  that any assistive technology reads the name — the first is the harness's, the second is
  neither's.
- `test/view/estimation/styleRules.test.ts` — 169 of 450, and the file the previous pass
  established for exactly this. `ruleAt`/`ruleBody`: the panel title declares `--font-medium` and
  no rule declares `--font-semibold` for it (decision 5); the strip is `position: absolute` and
  the two cells no longer declare `display: flex` (decision 6). Each proves a rule EXISTS and
  cannot prove it matches anything — which is the pair the previous pass learned it needs, so:
- `test/view/estimation/table.test.ts` is at 438 of 450 and gets nothing. Decision 6's structural
  half — the strip is a child of the cell it annotates — is already asserted there; nothing new is
  owed, and a single added test would break the build.
- `test/domain/scoringModel.test.ts` — every dimension problem names the label and not the id; a
  dimension whose `Label` box is overridden is named by the override; the collision sentence's
  dimension entry is lowercase; the weight-total sentence states the delta. Its existing
  assertions match on `/reach/i`, which passes for both the id and the label — so each of these
  is a NEW assertion naming the label exactly, not a tightening of one that would have passed
  either way.
- `test/domain/estimationOptions.test.ts` — the dimension group is headed by the resolved label,
  including for an id outside the shipped eight; the `Label` item's `default` and `placeholder`
  are still the SHIPPED value, which is the half a careless fix would break.
- `test/harness/harness.test.ts` — `?measure` still reports a row per column and now a row per
  numeric-column number probe. What it asserts is that the knob REPORTS what it claims to, never
  what the numbers are: the numbers are a browser's answer, and asserting them here is the
  screenshot suite ADR 0020 refuses.
- **Read by hand, with `?measure`**: that the four numbers share one baseline, and that the ladder
  still measures 20/15/13/12 — with the Title step now at weight 500 — and carries no orphan
  size. jsdom applies no stylesheet and lays nothing out, so the computed result is unreachable
  from the suite in both cases.

**What no check here reaches**, stated so the guarantee is not read wider than it is: the plain
`Current` chip and the accent value strip under a community theme; whether the sort glyph reads at
10px on a real display; and whether the horizontal scroller decision 7 measured is acceptable at a
real pane width. `npm run test-build` is the handover and the smoke-test note stays Open.

## Register

- `docs/requirements/Styling rules are checks.md` — three rows join the table three were closed in
  on 2026-08-21: the Title step's single weight, the strip's absence from the box model, and the
  sorted header's direction element. Each with its check named and "watched failing" recorded, in
  that table rather than a new one.
- `docs/tests/cases/Smoke test the estimation view's UX polish in a live vault.md` — the
  narrow-pane item gets its answer (decision 7) and the `Current`-chip item gets its
  default-colour half, both marked as harness observations with the theme half still open. The
  note stays Open.
- `docs/requirements/Reading the estimation table at a glance.md` — the sort direction is part of
  reading the table at a glance, and its `## Where it lives` describes a header that now draws a
  glyph.
- `docs/requirements/Configuring the estimation model.md` — extension 3b's refusal is unchanged,
  but the acceptance criterion "each refusal above names the dimension" now means by label, and
  the note says which name.
- A new PBI for the Whole-Column fix in this table, under
  `docs/requirements/The prioritized list.md`, carrying decision 7's measurement and its corrected
  reason. Opened rather than built.
- `CHANGELOG.md` — an `[Unreleased]` entry.

## Out of scope, stated so it is not drifted into

Everything the previous spec's own out-of-scope section names — the value/effort matrix, the
health dashboard, the framework presets, the weighting scenarios, the rubric editor, and
narrow-width stacking — plus `Comparing across products` and `Coverage per objective`.
`Editing a dimension's scale` keeps both halves it owns: the scale dialog, and the removal of the
`Range` box. `columnFit` is not generalised. `src/domain/` is not swept for UI text. The previous
pass's four refusals — `current` carrying no colour, the chip's `--background-modifier-hover`
fill, the visible rubric sentence, and no placeholder panel — are not reopened, and neither is
the one-radius chip family or the `+` dimension divider.
