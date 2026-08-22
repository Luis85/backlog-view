# Indicator presets for the estimation view — design

Written 2026-08-22, over `docs/requirements/Starting from a known framework.md` and its
Feature, `docs/requirements/Presets for the known frameworks.md`. Both stand; this narrows
the PBI to its **indicator** half and says what the other half becomes.

**The register's two kinds of preset are not equally ready.** A *value* preset swaps
dimensions and weights, so its preview owes the count of stored totals the change would
turn foreign — which is `docs/requirements/Knowing what a model change invalidated.md`,
still Open. An *indicator* preset configures a figure that persists nothing, so extension
2a already says its count is zero by construction and is reported as unchanged. Shipping
the indicator half alone therefore needs no part of that Open PBI, and all four frameworks
the register names — RICE, ICE, WSJF, value over effort — are indicators.

**One number already works this way.** `view/estimation/panel.ts` draws a hardcoded
value-to-effort line: the confidence-adjusted value divided by effort, computed on read,
written nowhere. This increment does not add an indicator; it makes the one that exists
configurable, nameable, sortable and visible in the table, with four presets that set it
in one pick.

## What the harness answered, and with what

`npm run harness -- test/harness/mock.ts` — an uncommitted entry that mounts the REAL
estimation view and then hand-draws this increment's markup on top of it: the seventh
column, the panel line, the toolbar button and the dialog in Obsidian's own `.modal`
frame. Screenshots at 1200px and 900px, both schemes, headless Chromium. Five things it
settled, each one a change to what this design said before it was drawn:

1. **A composed formula cannot be a column header.** `Adjusted value ÷ Effort` in the 72px
   numeric column clips to `Adjusted …`, which names nothing. A short name (`RICE`) fits
   exactly. So the fallback is a generic word, not the formula — decision below.
2. **Four presets of one kind do not each need a kind chip.** Every row read `Indicator`,
   four times, saying nothing. The kind is stated once, above the list.
3. **The preview's two lines were asymmetric** — the current indicator by name, the new one
   by name *and* formula. Both are drawn the same way.
4. **A described preset list needs its own scroller.** Once each row carries a description,
   the four rows plus the preview push Apply and Cancel out of a 620px window — the modal
   scrolls as one block and the primary action goes with it. The list scrolls instead.
5. **The seventh column costs a measurable band of pane widths.** At 900px the currency
   column is cut off **today, before this change**. At 1000px it is not — the baseline
   still draws it, truncated at the edge, and the seventh column pushes it off entirely.
   At 1200px the title column absorbs the new column and everything is whole. So the band
   this increment newly loses is roughly **940px to 1020px**, the view's existing threshold
   plus one 72px column and its 8px gap. It does not introduce the narrow-pane defect and
   does not fix it; `Keeping columns whole under a narrow pane` still owns it.

## What is built

### 1. The indicator's shape

`src/domain/scoringModel.ts` gains, beside the model it sits next to:

```ts
interface Indicator {
	label: string;          // '' = unnamed, drawn as its composed formula
	operands: string[];     // multiplied together, in order
	divisor: string | null; // optional
}
```

An operand is an **id from one vocabulary**, never an expression and never anything a
parser reads:

| Id | Reads |
| --- | --- |
| any configured dimension's id | that dimension's answer on the item, as the total reads it (clamped, direction applied) |
| `confidence`, `effort`, `complexity` | that scale's answer on the item, clamped to its declared range — the number the panel row above it reports |
| `ease` | the effort scale **reversed** on its own range (`min + max − effort`) |
| `value` | the model's own output — the weighted total |
| `adjustedValue` | the confidence-adjusted value |

**Every operand reads as the surface beside it reads it — clamped.** An operand is a
multiplier as often as it is a divisor, and a raw one inverts a ranking: a stored
confidence of `-2` makes RICE fall as impact rises, and a `0` zeroes an item that is
scored. It would also disagree with the panel, which reports an out-of-range answer as
clamped in the row directly above.

**The divisor is refused TWICE, and both halves are needed.** Zero or below is no figure,
named — asked of the **stored** value, because the clamp would otherwise repair exactly the
case the rule exists to refuse (a scale's minimum is normally 1, so a clamped divisor could
never be ≤ 0), and asked again of the **resolved** value, because resolution itself can
produce one: a `lessIsBetter` dimension declared over `0-10` turns a stored `10` into a
direction-applied `0`, which divides to `Infinity` while passing any check on what the note
holds. One rule read at both ends of the same resolution — what is on the note, and what
the model makes of it.

**That moves one number, narrowly, and the move is the point.** An item with an
out-of-range effort — `9` on a 1–5 scale — divides by `5` where `renderDerived` divides by
`9` today, so its value-to-effort figure changes. The panel row above it already says that
`9` reads as `5`; the shipped line disagreeing with the surface beside it is the defect,
not the fix. **No item whose answers are in range moves at all**, which is the promise this
design makes and the one it keeps.

**`ease` is the effort scale reversed on its own declared range.** Not `1 ÷ effort`: ICE is
impact × confidence × ease with NO divisor, which is what the Feature says, and a
reciprocal is a different ranking wearing the name. Reversal is not a new idea either —
`lessIsBetter` already reverses a DIMENSION on its own range, and this is the same rule
reaching a scale. A team that scores ease as its own judgement declares a dimension for it
and points the operand there, exactly as WSJF's numerator can be pointed at a cost-of-delay
dimension.

**The built-in ids are reserved words.** A model's dimension ids are free text
(`dimensions` is a text option), so a vault can declare a dimension called `effort`, `ease`
or `value`. Resolution asks the built-ins first, and a dimension whose id collides is simply
not addressable as an operand — its weight in the value model is untouched, and renaming
it makes it addressable. Stated rather than left to the lookup order it happens to have,
because the alternative — namespacing every operand (`dim:reach`, `scale:effort`) — puts
a prefix in four preset definitions and both text boxes to answer a collision nobody has
had yet.

There is no operator precedence to define, because there are no operators to choose: the
form is a product over an optional divisor and only that. A framework this shape cannot
express is a reason to reconsider the shape, not to grow a parser — the Feature's own
sentence, unchanged.

### 2. Computing it, and the three ways it has no figure

`src/domain/weightedScore.ts` resolves each operand id to `{ label, value | null }` and
returns either a figure or the **name of the one operand that blocked it**:

- an operand with no answer on this item,
- a divisor of zero or below — zero is not a large indicator, a negative one inverts the
  ranking silently,
- an operand id naming nothing at all: a typo in the config, or a dimension since removed.

The third is not in the register, and it takes the same path deliberately rather than
becoming a `modelProblems` entry. A model problem replaces the whole table with a warning
and blocks every write; an indicator persists nothing, so a mistyped operand must not stop
anyone scoring. Reported per item, naming the operand, it is honest and costs no new
surface.

**An empty operand list is no indicator at all**, and that is a fourth state rather than a
fourth failure: the column is not drawn, the panel draws no line, and nothing is uncomputable
because nothing was asked for. A product of no operands is `1`, so the alternative is a
column of constant `1`s under a blank header — and a configuration problem is the wrong
answer too, since that would replace the whole table with a warning over a figure that
persists nothing. It also gives a reader who wants the six columns back a way to say so:
clear the box.

An item with no figure **keeps its place in any list, sorted with the unmeasured** — which
the table's comparator already does for every absent value.

`computeIndicator` is reached from `estimationItems.ts` on every model build and from
nowhere else. It enters `modelFingerprint` nowhere and `estimationWritePlan.ts` nowhere:
an indicator persists nothing, so nothing stamps its formula and no edit to it invalidates
a stored total.

### 3. Configuration

Three text options, a new **Indicator** group in `src/domain/estimationOptions.ts`:

| Key | Holds |
| --- | --- |
| `indicatorLabel` | the name, e.g. `RICE` |
| `indicatorOperands` | comma-separated operand ids, multiplied in order |
| `indicatorDivisor` | one operand id, or empty for no divisor |

Three text boxes are what "editable afterwards" means (extension 5c) — swapping an operand
or dropping the divisor is an edit to a box, and no new control type is needed, which is
what refused a live weight total in the previous pass.

**The default is what the panel computes today**: operands `adjustedValue`, divisor
`effort`, no label. An existing saved view's number does not move; it gains a column, a
name it can be given, and a sort.

### 4. The presets

`src/domain/estimationPresets.ts`, data only, a sibling of `defaultModel.ts` for the same
reason the rubric sentences are data: what a preset writes into a `.base` must not depend
on which locale wrote it.

| Name | Operands | Divisor |
| --- | --- | --- |
| RICE | reach × business impact × confidence | effort |
| ICE | business impact × confidence × ease | — |
| WSJF | value | effort |
| Value over effort | adjusted value | effort |

**One of them reads a textbook form through this shape, and it says so in one line.**

- **WSJF** is cost of delay ÷ job size, and cost of delay is a *sum* of value, time
  criticality and risk/enablement — a form the shape cannot express, and the Feature
  refuses summed operands rather than growing one. The Feature itself reads WSJF as one
  operand over one operand ("WSJF is cost of delay over job size", named among the four
  expressible "by choosing operands"), so it ships as the value total over effort: the
  right shape, read through this model's own value. The entry says so. **And the numerator
  is one text box**: a vault that declares a `cost-of-delay` dimension points the operand
  at it and gets the real thing, with no preset and no code involved. The value preset is
  what makes that the default rather than an edit.

A preset stores operand **ids**, not the labels the table above reads with — so RICE names
`reach`, `business-impact`, `confidence` and `effort`. A preset applied to a model whose
dimensions were customised can therefore name one that is not there, and that is the
unknown-operand case above: the preset applies, and the items report no figure naming the
missing operand, rather than the pick being refused. The preview shows the formula it is
about to write, which is where a reader sees a name they do not recognise.

A preset's **name** is data — it is written into the `.base`. Its **kind word** and its
**one honest line** are catalog text: both are shown in the dialog and neither is ever
written.

### 5. The picker and its preview

`src/ui/estimationPresetDialog.ts`, `stateColorsDialog.ts`'s shape — a `Modal` under
`ui/`, which knows about no layer above it. One sentence above the list says what kind
these are — *they configure the indicator beside the business value, and the value model is
untouched* — rather than a kind chip repeating one word on each of four rows. The chip
comes back the day a second kind is on screen, which is the value-preset PBI.

Then four rows, each with **four things in this order**: the preset's name, a
**description** — what the framework is and when a team uses it, in a sentence or two —
its composed formula, and its one honest line where it has one. The description is the
half a formula cannot supply: `Reach × Business impact × Confidence ÷ Effort` says what
RICE computes and nothing about when it is the right ranking, and someone picking a
framework from a list of four is choosing between judgements, not between arithmetic. It
reads as prose above the formula, which is the mechanical detail under it.

Descriptions are **catalog text**, keyed by preset id — shown, never written to the
`.base` — like the honest lines beside them and unlike the names above them.
Picking one draws the preview; **nothing is written until Apply**:

1. the indicator now — its name and its composed formula,
2. the indicator after — the same two, from the preset,
3. **the value model is unchanged and no stored total is affected.**

Both lines are drawn the same way, and the preview is drawn only once something is picked:
reserving its height leaves a hole above the buttons in the state the dialog opens in.

**The list is the only scroller.** Four described presets are taller than a short pane, and
`.modal` caps its own height — so a content block that scrolls as one carries Apply and
Cancel below the fold, which the harness showed at a 620px window. The dialog's content is
a flex column, the list takes `flex: 1 1 auto; min-height: 0`, and the intro, the preview
and the buttons stay put and take their own height first. `min-height: 0` is the
load-bearing half: without it a flex item refuses to shrink below its content and the
column overflows exactly as before.

Line 3 is extension 2a: the count is not computed, because for an indicator preset it is
zero by construction, and it is reported as unchanged rather than as a bare zero. Cancel
sets no option and writes no note. Apply sets exactly the three config keys above and
writes no note either — a preset changes configuration, never a vault.

Reached from a fourth button in `src/view/estimation/toolbar.ts`, beside ✨, undo and the
count.

### 6. Drawing it

**The table** (`src/view/estimation/renderTable.ts`) takes a seventh column, after effort
and before currency.

- Its header is the label, falling back to a generic word — `Indicator` — when nothing has
  named it. **Not the composed formula**: measured in the harness, `Adjusted value ÷
  Effort` clips to `Adjusted …` in a 72px column, which names nothing at all, while `RICE`
  fits with room. The formula is the header's TOOLTIP only — its accessible name stays the
  visible word plus the sort direction when active, which is what `sortHeader` already
  builds for every other column: a name that replaced `RICE` with the formula would take
  the visible label away from a screen reader and leave speech input with no way to say
  which header to click. The
  panel beside the table spells it in full, which is where a decomposition belongs anyway.
- Its cell is the rounded figure, or an em-dash whose tooltip names the operand that
  blocked it.
- It sorts through the machinery already there: `SortColumn`, `SORT_COLUMNS` and
  `columnValue` each gain one entry, and the comparator's existing rule — absence
  partitions after the sorted block in **both** directions — is what puts an uncomputable
  indicator with the unmeasured without a line of new code.
- `ESTIMATION_SORT_VALUES` in `src/storage/viewStateStore.ts` gains `indicator:asc` and
  `indicator:desc`, and its comment names seven columns and fourteen values rather than
  six and twelve. Spelled out there independently, as that module's own rule requires:
  stored state is read defensively, never trusted as a type.

**The panel** (`src/view/estimation/panel.ts`): the hardcoded value-to-effort line becomes
the configured indicator — its name or formula, its figure, and where it has none, the
operand that blocked it. It stays where it is, beside the confidence-adjusted value, which
is the epic's rule that a merged number appears beside its inputs and never instead of
them.

A seventh column makes narrow panes one column worse, and the harness measured the band it
costs. `Keeping columns whole under a narrow pane` records the row's own minimum at 588px
and the view's threshold at about **940px**; a fixed 72px column plus its 8px gap raises
those to 668px and about **1020px**. So panes between roughly 940 and 1020px lose the
currency column to this change — screenshotted at 1000px, where the baseline still draws
`Currency` and its chips (truncated at the edge) and the seventh column pushes them off
entirely. Below 940px it is already gone today, and at 1200px the title column absorbs the
new column and everything is whole. That
is `docs/requirements/Keeping columns whole under a narrow pane.md`, already Open with its
mechanism recorded, and it is not pulled in here.

## What is not built

- **Value presets.** The PBI is narrowed to indicator presets and a sibling PBI is added
  under `Presets for the known frameworks` for the value half — dimensions and weights
  swapped in one pick, with the real invalidation count from
  `Knowing what a model change invalidated`, and WSJF's cost-of-delay dimensions with it.
- **Summed operands.** Refused by the Feature, and refusing them is what keeps two
  implementations from disagreeing about a preset.
- **An operand picker.** Three text boxes, not a control that lists the vocabulary.
- **Narrow-pane stacking**, and **the invalidation count** — both Open PBIs of their own.

## What proves it

| Claim | Check |
| --- | --- |
| The operand shape computes a product over an optional divisor | `test/domain/` over `computeIndicator` |
| An unanswered operand, a divisor ≤ 0, and an unknown operand id each give no figure and name the operand | the same, one case each |
| A scale operand reads clamped, so a `-2` confidence never inverts a ranking | a multiplier case per side of the range |
| A divisor of 0 or below is refused, stored and resolved alike | the fixture's `Zero effort` and `Negative effort` notes, plus a `lessIsBetter` dimension over `0-10` answered at its top |
| `ease` reverses effort on its declared range, so ICE needs no divisor | one case at each end of the range |
| The default indicator equals what `renderDerived` computes today for every in-range item | the shipped fixture's `Full profile`, asserted against the same arithmetic |
| A dimension id colliding with a built-in resolves to the built-in | one case over a model declaring a dimension called `effort` |
| An indicator preset leaves the value model untouched | a fingerprint asserted equal across every preset applied |
| An indicator persists nothing | no `PropertyWrite` names an indicator key; applying a preset issues zero note writes |
| An uncomputable indicator sorts with the unmeasured | `test/view/estimation/sort.test.ts`, both directions |
| An empty operand list draws no column and no panel line | one case over a cleared `indicatorOperands` |
| The header's accessible name keeps the visible label | one case over a labelled and an unlabelled indicator |
| Cancelling writes nothing | a view test spying on `config.set` and `applyPropertyWrites` |
| Applying writes exactly three config keys | the same test |
| Preset names are data; descriptions, kind sentence and notes are text | `test/i18n/projections.test.ts` |

`npm run check` is the gate, as always. The harness has now answered the layout — the
column's fit, the header's width, the dialog's shape — in Obsidian's DEFAULT colours. What
it cannot answer is still owed a live-vault check: those colours under a community theme,
and the dialog against a real vault's modal chrome (ADR 0020).

## Register changes

- `Starting from a known framework` is narrowed to indicator presets; its acceptance
  criteria about dimensions added and dropped move to the new sibling.
- A new PBI under `Presets for the known frameworks` for value presets, ordered after it,
  naming its dependency on `Knowing what a model change invalidated`.
- `CHANGELOG.md` gains an `[Unreleased]` entry.
