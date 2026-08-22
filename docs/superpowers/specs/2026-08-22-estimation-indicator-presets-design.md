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
frame. Screenshots at 1200px and 900px, both schemes, headless Chromium. Four things it
settled, each one a change to what this design said before it was drawn:

1. **A composed formula cannot be a column header.** `Adjusted value ÷ Effort` in the 72px
   numeric column clips to `Adjusted …`, which names nothing. A short name (`RICE`) fits
   exactly. So the fallback is a generic word, not the formula — decision below.
2. **Four presets of one kind do not each need a kind chip.** Every row read `Indicator`,
   four times, saying nothing. The kind is stated once, above the list.
3. **The preview's two lines were asymmetric** — the current indicator by name, the new one
   by name *and* formula. Both are drawn the same way.
4. **The seventh column worsens a clip that is already there.** At a 900px window the
   currency column is cut off by the pane's edge **today, before this change** — the same
   screenshot without the mock shows a sliver of a currency chip at the edge. At 1200px the
   title column absorbs the new column's ~80px down toward its 96px floor and everything
   fits. So this increment does not introduce the narrow-pane defect and does not fix it;
   `Keeping columns whole under a narrow pane` still owns it.

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
| `confidence`, `effort`, `complexity` | that scale's answer on the item, as its panel row reads it |
| `value` | the model's own output — the weighted total |
| `adjustedValue` | the confidence-adjusted value |

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
| ICE | business impact × confidence | effort |
| WSJF | value | effort |
| Value over effort | adjusted value | effort |

**Two of them read a textbook form through this shape, and each says so in one line.**

- **ICE** is impact × confidence × *ease*, and this model has effort rather than ease.
  Ease is read as `1 ÷ effort`, so ICE ships as a divisor rather than a third factor. The
  entry says it.
- **WSJF** is cost of delay ÷ job size, and cost of delay is a *sum* of value, time
  criticality and risk/enablement — a form the shape cannot express, and the Feature
  refuses summed operands rather than growing one. So WSJF ships as the value total over
  effort: the right shape, read through this model's own value. The entry says it, and the
  cost-of-delay dimensions arrive with the value preset.

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

Then four rows, each naming the preset, its composed formula and its one honest line.
Picking one draws the preview; **nothing is written until Apply**:

1. the indicator now — its name and its composed formula,
2. the indicator after — the same two, from the preset,
3. **the value model is unchanged and no stored total is affected.**

Both lines are drawn the same way, and the preview is drawn only once something is picked:
reserving its height leaves a hole above the buttons in the state the dialog opens in.

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
  fits with room. The formula is the header's tooltip and its accessible name, and the
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

A seventh column makes narrow panes one column worse, and the harness measured how much:
at 1200px the title column absorbs it and every column is whole; at 900px the currency
column falls off the pane's edge — which it already does today, without this change. That
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
| An indicator preset leaves the value model untouched | a fingerprint asserted equal across every preset applied |
| An indicator persists nothing | no `PropertyWrite` names an indicator key; applying a preset issues zero note writes |
| An uncomputable indicator sorts with the unmeasured | `test/view/estimation/sort.test.ts`, both directions |
| Cancelling writes nothing | a view test spying on `config.set` and `applyPropertyWrites` |
| Applying writes exactly three config keys | the same test |
| Preset names are data, kind words and notes are text | `test/i18n/projections.test.ts` |

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
