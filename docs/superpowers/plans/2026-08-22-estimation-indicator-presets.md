# Indicator presets, and opening the note being scored — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the estimation view a configurable prioritization indicator with four framework presets, and a way to open the note being scored.

**Architecture:** Two independent phases in one increment. **Phase A** adds an `Indicator` — a product of named operands over an optional divisor — resolved from three new view options, computed on read in `domain/weightedScore.ts`, drawn as a seventh table column and one panel line, and set in one pick by a dialog under `ui/`. It persists nothing and enters no fingerprint. **Phase B** gives the panel an Open note control and routes it, and the table's existing `Enter`, through the backlog view's own `OpenController`.

**Tech Stack:** TypeScript, esbuild, vitest (node for `domain/`, jsdom for `view/`), Obsidian 1.12.0 typings, plain CSS partials.

## Global Constraints

- **Layers:** `main → commands → view → storage → domain`; each may reach anything below it and nothing above. `ui/` is a leaf importing only `obsidian` and `i18n/`. `i18n/` imports nothing. Violations fail `npm run lint`.
- **`ui/` may not import `domain/`.** The preset dialog therefore takes plain rows and returns a picked id; the view assembles those rows.
- **400-line cap** per file in `src/` and per CSS partial; 450 in `test/`.
- **i18n:** `view/estimation/` and `ui/` are swept — every sentence goes through `t()`, and a capitalised literal at a setter, at `new Notice`, at a bare `setTooltip`, or in one of the twelve option-bag properties fails lint. `domain/estimationOptions.ts`, `domain/defaultModel.ts` and the new `domain/estimationPresets.ts` are **not** swept: their option names stay plain English literals, matching the file they sit in. Preset **names** are data (written into the `.base`); descriptions, notes and operand labels are catalog text.
- **The indicator persists nothing.** It never reaches `domain/estimationWritePlan.ts`, never enters `modelFingerprint`, and no code added by this plan calls `applyPropertyWrites`.
- **Definition of done:** `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) passes. Coverage thresholds in `vitest.config.mts` only ever go up.
- **Commits:** one per task, message in the repo's style (lowercase `feat:`/`fix:`/`docs:` prefix, imperative). No model identifier anywhere in a commit message.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/domain/scoringModel.ts` (modify) | The `Indicator` type and the reserved built-in operand ids |
| `src/domain/weightedScore.ts` (modify) | Operand resolution, `computeIndicator`, `indicatorFormula`, and `countAnswer` shared with `computeTotal` |
| `src/domain/estimationSettings.ts` (modify) | Resolves the indicator off the view config, beside (never inside) the `ScoringModel` |
| `src/domain/estimationOptions.ts` (modify) | The three Indicator boxes in the options menu |
| `src/domain/estimationItems.ts` (modify) | `EstimationItem.indicator`, computed once per item at build |
| `src/domain/estimationPresets.ts` (create) | The four presets, data only, no imports |
| `src/view/estimation/renderTable.ts` (modify) | The seventh column, its header, its sort |
| `src/view/estimation/panel.ts` (modify) | The indicator line, and the Open note control |
| `src/view/estimation/toolbar.ts` (modify) | The presets button |
| `src/view/estimation/estimationView.ts` (modify) | Owns the `OpenController`; opens the preset dialog; passes the indicator to the model build |
| `src/ui/estimationPresetDialog.ts` (create) | The picker and its preview, over plain rows |
| `src/view/openTarget.ts` (modify) | Parameter narrowed from `BacklogItem` to what it reads |
| `src/domain/itemHandling.ts` (modify) | A per-view default target |
| `src/storage/viewStateStore.ts` (modify) | Two more `estimationSort` values |
| `styles/estimationPresets.css` (create) | The dialog's own rules |

---

## Phase A — the indicator and its presets

### Task 1: The indicator's shape and its arithmetic

**Files:**
- Modify: `src/domain/scoringModel.ts`
- Modify: `src/domain/weightedScore.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/domain/indicator.test.ts` (create)

**Interfaces:**
- Consumes: `ScoringModel`, `ScaleConfig`, `ScoringDimension`, `TotalResult`, `round2` — all existing.
- Produces:
  - `interface Indicator { label: string; operands: string[]; divisor: string | null }` (`scoringModel.ts`)
  - `const INDICATOR_BUILTINS: readonly string[]` (`scoringModel.ts`)
  - `interface IndicatorInputs { answers: ReadonlyMap<string, number | null>; confidence: number | null; effort: number | null; complexity: number | null; result: TotalResult | null }` (`weightedScore.ts`)
  - `interface IndicatorFigure { value: number | null; blockedBy: string | null }` (`weightedScore.ts`)
  - `function computeIndicator(model: ScoringModel, indicator: Indicator, inputs: IndicatorInputs): IndicatorFigure | null`
  - `function indicatorFormula(model: ScoringModel, indicator: Indicator): string`

- [ ] **Step 1: Write the failing test**

Create `test/domain/indicator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { configured } from '../helpers/estimationModel';
import { Indicator } from '../../src/domain/scoringModel';
import { computeIndicator, computeTotal, IndicatorInputs, indicatorFormula } from '../../src/domain/weightedScore';

const FULL: Record<string, number> = {
	'strategic-alignment': 5,
	'customer-value': 4,
	'business-impact': 4,
	reach: 3,
	'risk-reduction': 2,
	compliance: 1,
	'time-criticality': 4,
	enablement: 3,
};

function inputs(over: Partial<IndicatorInputs> = {}, answers: Record<string, number> = FULL): IndicatorInputs {
	const model = configured();
	const map = new Map<string, number | null>(Object.entries(answers));
	return { answers: map, confidence: 4, effort: 2, complexity: 1, result: computeTotal(model, map), ...over };
}

function ind(over: Partial<Indicator> = {}): Indicator {
	return { label: '', operands: ['adjustedValue'], divisor: 'effort', ...over };
}

describe('the indicator', () => {
	it('multiplies its operands and divides by its divisor', () => {
		const model = configured();
		const figure = computeIndicator(model, ind({ operands: ['reach', 'business-impact'], divisor: null }), inputs());
		expect(figure).toEqual({ value: 12, blockedBy: null });
	});

	it('is nothing at all when no operand is named', () => {
		expect(computeIndicator(configured(), ind({ operands: [] }), inputs())).toBeNull();
	});

	it('has no figure, naming the operand, when one is unanswered', () => {
		const figure = computeIndicator(configured(), ind({ operands: ['reach', 'confidence'], divisor: null }), inputs({ confidence: null }));
		expect(figure).toEqual({ value: null, blockedBy: 'Confidence' });
	});

	it('has no figure, naming the id itself, when an operand names nothing', () => {
		const figure = computeIndicator(configured(), ind({ operands: ['reeech'], divisor: null }), inputs());
		expect(figure).toEqual({ value: null, blockedBy: 'reeech' });
	});

	it('reads a scale operand CLAMPED, so an out-of-range confidence never inverts the ranking', () => {
		const model = configured();
		const low = computeIndicator(model, ind({ operands: ['confidence'], divisor: null }), inputs({ confidence: -2 }));
		const high = computeIndicator(model, ind({ operands: ['confidence'], divisor: null }), inputs({ confidence: 9 }));
		expect(low).toEqual({ value: 1, blockedBy: null });
		expect(high).toEqual({ value: 5, blockedBy: null });
	});

	it('refuses a divisor of zero or below as STORED, before the clamp can repair it', () => {
		const model = configured();
		expect(computeIndicator(model, ind(), inputs({ effort: 0 }))).toEqual({ value: null, blockedBy: 'Effort' });
		expect(computeIndicator(model, ind(), inputs({ effort: -2 }))).toEqual({ value: null, blockedBy: 'Effort' });
	});

	it('refuses a divisor that RESOLUTION turns nonpositive', () => {
		// `lessIsBetter` over 0-10, answered at its top, resolves to 0 — which would divide
		// to Infinity while passing any check on what the note holds.
		const model = configured({ 'dimRange.reach': '0-10', 'dimLessIsBetter.reach': true });
		const figure = computeIndicator(model, ind({ operands: ['value'], divisor: 'reach' }), inputs({}, { ...FULL, reach: 10 }));
		expect(figure).toEqual({ value: null, blockedBy: 'Reach' });
	});

	it('reads `ease` as the effort scale reversed on its own range', () => {
		const model = configured();
		const figure = computeIndicator(model, ind({ operands: ['ease'], divisor: null }), inputs({ effort: 2 }));
		expect(figure).toEqual({ value: 4, blockedBy: null });
	});

	it('rounds the adjusted value BEFORE dividing, exactly as the panel line did', () => {
		// total 1.01 at confidence 3 over effort 2: 0.31 through the rounded adjusted value,
		// 0.30 if only the final figure is rounded. `Full profile` lands on the same number
		// either way, so it cannot tell these two paths apart and this case is what does.
		const model = configured();
		const figure = computeIndicator(model, ind(), {
			answers: new Map(),
			confidence: 3,
			effort: 2,
			complexity: null,
			result: { total: 1.01, coverage: { answered: 1, enabled: 8 }, clamped: [], terms: [] },
		});
		expect(figure).toEqual({ value: 0.31, blockedBy: null });
	});

	it('composes a formula from operand labels', () => {
		expect(indicatorFormula(configured(), ind({ operands: ['reach', 'confidence'], divisor: 'effort' }))).toBe(
			'Reach × Confidence ÷ Effort',
		);
		expect(indicatorFormula(configured(), ind({ operands: ['value'], divisor: null }))).toBe('Value');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/indicator.test.ts`
Expected: FAIL — `computeIndicator is not a function`.

- [ ] **Step 3: Add the shape to `src/domain/scoringModel.ts`**

Add after the `ScoringModel` interface:

```ts
/**
 * A prioritization indicator: a product of named operands over an optional divisor, and
 * nothing else — no expression, and nothing parses one.
 *
 * It lives BESIDE the model rather than inside it (`EstimationSettings`), and that
 * placement is the mechanical statement of the rule: an indicator persists nothing, so
 * nothing that fingerprints or writes the total can reach it.
 */
export interface Indicator {
	/** '' = unnamed; the table header falls back to a generic word. */
	label: string;
	/** Multiplied together, in order. EMPTY means no indicator at all, not a product of one. */
	operands: string[];
	/** Divides the product; null = no divisor. */
	divisor: string | null;
}

/**
 * The operand ids that are not dimension ids, and they are RESERVED: resolution asks this
 * list first, so a vault that declares a dimension called `effort` gets the scale here and
 * the dimension keeps its weight in the value model. Namespacing every operand
 * (`dim:reach`) was the alternative and costs a prefix in four presets and both text boxes
 * to answer a collision nobody has had.
 */
export const INDICATOR_BUILTINS = ['confidence', 'effort', 'complexity', 'ease', 'value', 'adjustedValue'] as const;
```

- [ ] **Step 4: Add the catalog keys to `src/i18n/en.ts`**

Beside the existing `estimation.column.*` block:

```ts
	'estimation.column.indicator': 'Indicator',
	'estimation.operand.ease': 'Ease',
	'estimation.operand.value': 'Value',
	'estimation.operand.adjustedValue': 'Adjusted value',
```

The three scale operands reuse `estimation.panel.confidence`, `estimation.panel.effort` and `estimation.panel.complexity`, which already hold exactly those words — a second key for the same noun is a second thing to translate and a second thing to get out of step.

- [ ] **Step 5: Extract the shared answer arithmetic in `src/domain/weightedScore.ts`**

Replace the body of `computeTotal`'s loop so both it and the operand resolver read one function:

```ts
/**
 * One dimension's answer as the total COUNTS it: clamped to the declared range, direction
 * applied, and reported back in the dimension's own units.
 *
 * Extracted from `computeTotal` rather than restated, because the indicator's operands
 * must read a dimension exactly as the decomposition beside them reports it — a second
 * copy of this is a clone `npm run analyze` catches, and a second copy that DRIFTS is a
 * RICE whose reach disagrees with the reach two lines above it.
 */
function countAnswer(d: ScoringDimension, raw: number): { clamped: boolean; counted: number; score: number } {
	const value = Math.min(d.max, Math.max(d.min, raw));
	const proportion = (value - d.min) / (d.max - d.min);
	const counted = d.lessIsBetter ? 1 - proportion : proportion;
	return { clamped: value !== raw, counted, score: round2(d.min + counted * (d.max - d.min)) };
}
```

and inside `computeTotal`'s `for` loop, replace the five lines from `const value = …` through `terms.push(…)` with:

```ts
		const { clamped: outOfRange, counted, score } = countAnswer(d, raw);
		if (outOfRange) clamped.push(d.id);
		terms.push({ label: d.label, score, weight: d.weight });
		weighted += counted * d.weight;
		weightSum += d.weight;
```

Import `ScoringDimension` alongside `ScoringModel` at the top of the file.

- [ ] **Step 6: Add operand resolution and `computeIndicator`**

Append to `src/domain/weightedScore.ts` (and add `Indicator`, `ScaleConfig` to the `./scoringModel` import, and `import { t } from '../i18n/t'`):

```ts
/** What one item brings to an indicator — exactly the subset of `EstimationItem` that
 *  exists while the item is being built, so `estimationItems.ts` passes the fields it has
 *  rather than a second shape assembled for this. */
export interface IndicatorInputs {
	answers: ReadonlyMap<string, number | null>;
	confidence: number | null;
	effort: number | null;
	complexity: number | null;
	result: TotalResult | null;
}

/** A figure, or the name of the ONE operand that blocked it — never a code, because this
 *  string is what the cell's tooltip and the panel line say out loud. */
export interface IndicatorFigure {
	value: number | null;
	blockedBy: string | null;
}

/** What the arithmetic uses, what the note holds, and what to call it when either is
 *  missing. `stored` is null wherever the operand has no stored source at all (`value`,
 *  `adjustedValue`) — the divisor's own check skips those. */
interface ResolvedOperand {
	label: string;
	value: number | null;
	stored: number | null;
}

function operandLabel(model: ScoringModel, id: string): string {
	switch (id) {
		case 'confidence':
			return t('estimation.panel.confidence');
		case 'effort':
			return t('estimation.panel.effort');
		case 'complexity':
			return t('estimation.panel.complexity');
		case 'ease':
			return t('estimation.operand.ease');
		case 'value':
			return t('estimation.operand.value');
		case 'adjustedValue':
			return t('estimation.operand.adjustedValue');
		default:
			// The dimension's own label, or the id itself where nothing answers to it: an
			// operand naming nothing is reported per item rather than as a model problem,
			// because a model problem replaces the whole table and blocks every write over a
			// figure that persists nothing.
			return model.dimensions.find((d) => d.id === id)?.label ?? id;
	}
}

/** A scale answer, CLAMPED to its declared range — the number the panel row above it
 *  reports. Raw would invert a ranking: a stored confidence of `-2` makes a product fall
 *  as its other operands rise. */
function scaleOperand(scale: ScaleConfig, held: number | null, label: string): ResolvedOperand {
	if (held === null) return { label, value: null, stored: null };
	return { label, value: Math.min(scale.max, Math.max(scale.min, held)), stored: held };
}

function resolveOperand(model: ScoringModel, inputs: IndicatorInputs, id: string): ResolvedOperand {
	const label = operandLabel(model, id);
	if (id === 'confidence') return scaleOperand(model.confidence, inputs.confidence, label);
	if (id === 'effort') return scaleOperand(model.effort, inputs.effort, label);
	if (id === 'complexity') return scaleOperand(model.complexity, inputs.complexity, label);
	if (id === 'ease') {
		// The effort scale reversed on its OWN range — `lessIsBetter` reaching a scale, not
		// `1 ÷ effort`, which is a different ranking wearing the name.
		const effort = scaleOperand(model.effort, inputs.effort, label);
		const value = effort.value === null ? null : model.effort.min + model.effort.max - effort.value;
		return { label, value, stored: effort.stored };
	}
	if (id === 'value') return { label, value: inputs.result?.total ?? null, stored: null };
	if (id === 'adjustedValue') {
		if (inputs.result === null || inputs.confidence === null) return { label, value: null, stored: null };
		const confidence = scaleOperand(model.confidence, inputs.confidence, label).value as number;
		// Rounded HERE, before it is multiplied or divided — `renderDerived`'s own order, and
		// keeping it is what makes "no in-range item's number moves" true rather than nearly
		// true: at a total of 1.01, confidence 3, effort 2, rounding first gives 0.31 and
		// rounding only the final figure gives 0.30.
		return { label, value: round2((inputs.result.total * confidence) / model.confidence.max), stored: null };
	}
	const dimension = model.dimensions.find((d) => d.id === id);
	const raw = dimension ? inputs.answers.get(dimension.id) : undefined;
	if (!dimension || raw === null || raw === undefined) return { label, value: null, stored: null };
	return { label, value: countAnswer(dimension, raw).score, stored: raw };
}

/**
 * The indicator for one item: the product of its operands over its divisor, or the name
 * of the operand that blocked it — and `null` for an indicator with no operands at all,
 * which is no indicator rather than a product of one (a product of nothing is 1, which
 * would draw a column of constant ones under a blank header).
 */
export function computeIndicator(model: ScoringModel, indicator: Indicator, inputs: IndicatorInputs): IndicatorFigure | null {
	if (indicator.operands.length === 0) return null;
	let product = 1;
	for (const id of indicator.operands) {
		const operand = resolveOperand(model, inputs, id);
		if (operand.value === null) return { value: null, blockedBy: operand.label };
		product *= operand.value;
	}
	if (indicator.divisor === null) return { value: round2(product), blockedBy: null };
	const divisor = resolveOperand(model, inputs, indicator.divisor);
	// Refused at BOTH ends of the same resolution: what the note HOLDS, because a scale's
	// minimum is normally 1 and the clamp would repair exactly the case this refuses; and
	// what the model MAKES of it, because a `lessIsBetter` dimension over `0-10` answered at
	// its top resolves to 0 and would divide to Infinity while the stored value looks fine.
	if (divisor.value === null || divisor.value <= 0 || (divisor.stored !== null && divisor.stored <= 0)) {
		return { value: null, blockedBy: divisor.label };
	}
	return { value: round2(product / divisor.value), blockedBy: null };
}

/** `Reach × Business impact × Confidence ÷ Effort` — every NAME from the catalog; the two
 *  symbols are not words and are the same in every locale this ships in, so nothing here
 *  is a sentence built out of translated fragments. */
export function indicatorFormula(model: ScoringModel, indicator: Indicator): string {
	const product = indicator.operands.map((id) => operandLabel(model, id)).join(' × ');
	return indicator.divisor === null ? product : `${product} ÷ ${operandLabel(model, indicator.divisor)}`;
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/domain/indicator.test.ts test/domain/scoringModel.test.ts test/domain/stamps.test.ts`
Expected: PASS — including the existing total and stamp suites, which `countAnswer` must not have changed.

- [ ] **Step 8: Commit**

```bash
git add src/domain/scoringModel.ts src/domain/weightedScore.ts src/i18n/en.ts test/domain/indicator.test.ts
git commit -m "feat: an indicator is a product of named operands over an optional divisor"
```

---

### Task 2: Resolving the indicator from the view options

**Files:**
- Modify: `src/domain/estimationSettings.ts`
- Modify: `src/domain/estimationOptions.ts`
- Test: `test/domain/estimationIndicatorSettings.test.ts` (create)

**Interfaces:**
- Consumes: `Indicator` (Task 1), `configReaders`, `resolveEstimationSettings`.
- Produces: `EstimationSettings` gains `indicator: Indicator`. Option keys `indicatorLabel`, `indicatorOperands`, `indicatorDivisor`.

- [ ] **Step 1: Write the failing test**

Create `test/domain/estimationIndicatorSettings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveEstimationSettings } from '../../src/domain/estimationSettings';
import { getEstimationViewOptions } from '../../src/domain/estimationOptions';
import { FakeViewConfig } from '../helpers/vault';
import { configuredValues } from '../helpers/estimationModel';

function resolve(over: Record<string, unknown> = {}) {
	return resolveEstimationSettings(new FakeViewConfig(configuredValues(over)) as never);
}

describe('the indicator, read off the view options', () => {
	it('defaults to what the panel already computed: the adjusted value over effort', () => {
		expect(resolve().indicator).toEqual({ label: '', operands: ['adjustedValue'], divisor: 'effort' });
	});

	it('takes the operands, the divisor and the name that were configured', () => {
		const indicator = resolve({
			indicatorLabel: 'RICE',
			indicatorOperands: 'reach, business-impact, confidence',
			indicatorDivisor: 'effort',
		}).indicator;
		expect(indicator).toEqual({ label: 'RICE', operands: ['reach', 'business-impact', 'confidence'], divisor: 'effort' });
	});

	it('reads a cleared operand box as no indicator, never as the default', () => {
		expect(resolve({ indicatorOperands: '' }).indicator.operands).toEqual([]);
	});

	it('reads a cleared divisor box as no divisor', () => {
		expect(resolve({ indicatorDivisor: '' }).indicator.divisor).toBeNull();
	});

	it('offers an Indicator group with the three boxes', () => {
		const groups = getEstimationViewOptions(new FakeViewConfig(configuredValues()) as never);
		const group = groups.find((g) => g.displayName === 'Indicator');
		expect(group?.items.map((item) => item.key)).toEqual(['indicatorLabel', 'indicatorOperands', 'indicatorDivisor']);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/estimationIndicatorSettings.test.ts`
Expected: FAIL — `indicator` is undefined on the settings.

- [ ] **Step 3: Resolve it in `src/domain/estimationSettings.ts`**

Import `Indicator` from `./scoringModel`, extend the interface and add the resolver:

```ts
export interface EstimationSettings {
	model: ScoringModel;
	/** BESIDE the model, never inside it: an indicator persists nothing, so nothing that
	 *  fingerprints or writes the total can reach it (`scoringModel.ts`'s own note). */
	indicator: Indicator;
}

/** The shipped indicator — exactly what `panel.ts` hardcoded before this: the
 *  confidence-adjusted value over effort. An existing saved view's number does not move. */
const DEFAULT_INDICATOR: Indicator = { label: '', operands: ['adjustedValue'], divisor: 'effort' };

/**
 * `clearable` for both lists, and that is the whole rule: an option whose default is a
 * REAL value has to tell "never set" from "cleared", or a reader can never turn the
 * indicator off — and turning it off is how the seventh column goes away again.
 */
function resolveIndicator(read: Readers): Indicator {
	return {
		label: read.text('indicatorLabel'),
		operands: read.clearable('indicatorOperands', DEFAULT_INDICATOR.operands, () => read.list('indicatorOperands')),
		divisor: read.clearable('indicatorDivisor', DEFAULT_INDICATOR.divisor, () => read.text('indicatorDivisor') || null),
	};
}
```

and return it from `resolveEstimationSettings`:

```ts
	return {
		model: { /* unchanged */ },
		indicator: resolveIndicator(read),
	};
```

- [ ] **Step 4: Add the options group in `src/domain/estimationOptions.ts`**

Add `indicatorGroup()` to the returned array — `return [modelGroup(), ...settings.model.dimensions.map(dimensionGroup), scalesGroup(), indicatorGroup()];` — and:

```ts
/** The indicator's three boxes. Text, not a property picker: an operand is an id from this
 *  model's own vocabulary, never a frontmatter key. Editing one is what "editable
 *  afterwards" means — swapping an operand or dropping the divisor is an edit to a box, so
 *  no new control type is needed. */
function indicatorGroup(): BasesAllOptions {
	return {
		type: 'group',
		displayName: 'Indicator',
		items: [
			{
				type: 'text',
				key: 'indicatorLabel',
				displayName: 'Name',
				placeholder: 'RICE',
			},
			{
				type: 'text',
				key: 'indicatorOperands',
				displayName: 'Operands (multiplied, in order)',
				default: 'adjustedValue',
				placeholder: 'adjustedValue',
			},
			{
				type: 'text',
				key: 'indicatorDivisor',
				displayName: 'Divisor',
				default: 'effort',
				placeholder: 'effort',
			},
		],
	};
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/domain/estimationIndicatorSettings.test.ts test/domain/estimationOptions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/estimationSettings.ts src/domain/estimationOptions.ts test/domain/estimationIndicatorSettings.test.ts
git commit -m "feat: the indicator is three view options, defaulting to what the panel drew"
```

---

### Task 3: Every item carries its indicator

**Files:**
- Modify: `src/domain/estimationItems.ts`
- Modify: `src/view/estimation/estimationView.ts:` (the two `buildEstimationModel` calls)
- Modify: `src/view/estimation/init.ts` (its `buildEstimationModel` call)
- Test: `test/domain/indicator.test.ts` (extend)

**Interfaces:**
- Consumes: `computeIndicator`, `IndicatorFigure` (Task 1); `EstimationSettings.indicator` (Task 2).
- Produces: `EstimationItem.indicator: IndicatorFigure | null`; `buildEstimationModel(app, entries, model, indicator)`.

- [ ] **Step 1: Write the failing test**

Append to `test/domain/indicator.test.ts`:

```ts
import { buildEstimationModel } from '../../src/domain/estimationItems';
import { FakeVault } from '../helpers/vault';

describe('the indicator on a built item', () => {
	it('is computed once per item, and is null when no operand is named', () => {
		const vault = new FakeVault();
		vault.addFile('Full.md', { frontmatter: { ...FULL, confidence: 4, effort: 2 } });
		const model = configured();
		const withOne = buildEstimationModel(vault.app, vault.entries(), model, ind({ operands: ['effort'], divisor: null }));
		expect(withOne.items[0].indicator).toEqual({ value: 2, blockedBy: null });
		const withNone = buildEstimationModel(vault.app, vault.entries(), model, ind({ operands: [] }));
		expect(withNone.items[0].indicator).toBeNull();
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/indicator.test.ts`
Expected: FAIL — `buildEstimationModel` takes three arguments.

- [ ] **Step 3: Carry it on the item**

In `src/domain/estimationItems.ts`, import `computeIndicator`, `IndicatorFigure` and `Indicator`; add the field:

```ts
	/** This model's indicator for this item, or null when none is configured — derived on
	 *  read and written nowhere, which is why it sits beside `result` rather than in it. */
	indicator: IndicatorFigure | null;
```

extend the signature and compute it after `result`:

```ts
export function buildEstimationModel(
	app: App,
	entries: BasesEntry[],
	model: ScoringModel,
	indicator: Indicator,
): EstimationModel {
```

```ts
		const confidence = readNumber(ownValue(fm, model.confidence.key));
		const effort = readNumber(ownValue(fm, model.effort.key));
		const complexity = readNumber(ownValue(fm, model.complexity.key));
		const item: EstimationItem = {
			file,
			entry,
			title: file.basename,
			answers,
			confidence,
			effort,
			complexity,
			storedTotal,
			storedStamp,
			result,
			indicator: computeIndicator(model, indicator, { answers, confidence, effort, complexity, result }),
			currency: currencyOf(model, { storedTotal, storedStamp, result }, fingerprint),
			ownKeys: new Set(bound.filter((key) => ownValue(fm, key) !== undefined)),
		};
```

- [ ] **Step 4: Update the three call sites**

`src/view/estimation/estimationView.ts` — in `render()`:

```ts
		this.model = buildEstimationModel(this.app, this.data?.data ?? [], model, this.settings.indicator);
```

`src/view/estimation/init.ts` — in `runEstimationInit`, the model rebuilt before the batch:

```ts
	view.model = buildEstimationModel(view.app, view.data?.data ?? [], model, view.settings.indicator);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/domain test/view/estimation`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/estimationItems.ts src/view/estimation/estimationView.ts src/view/estimation/init.ts test/domain/indicator.test.ts
git commit -m "feat: every estimation item carries its indicator"
```

---

### Task 4: The seventh column, and its sort

**Files:**
- Modify: `src/view/estimation/renderTable.ts`
- Modify: `src/storage/viewStateStore.ts`
- Test: `test/view/estimation/indicatorColumn.test.ts` (create)

**Interfaces:**
- Consumes: `EstimationItem.indicator` (Task 3), `indicatorFormula` (Task 1), `EstimationView.settings.indicator` (Task 2).
- Produces: a header button with `data-col="indicator"`, a row cell with `data-col="indicator"`, and the `estimationSort` values `indicator:asc` / `indicator:desc`.

- [ ] **Step 1: Write the failing test**

Create `test/view/estimation/indicatorColumn.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', {
		frontmatter: { 'strategic-alignment': 5, 'customer-value': 4, confidence: 4, effort: 2 },
	});
	vault.addFile('NoEffort.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4 } });
	return vault;
}

function values(over: Record<string, unknown> = {}): Record<string, unknown> {
	return configuredValues({ confidenceProperty: 'note.confidence', effortProperty: 'note.effort', ...over });
}

function cell(containerEl: HTMLElement, path: string): HTMLElement {
	return containerEl.querySelector(`.pbl-est-row[data-path="${path}"] [data-col="indicator"]`) as HTMLElement;
}

function head(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector('.pbl-est-head [data-col="indicator"]');
}

describe('the indicator column', () => {
	it('draws a figure, and leaves a blocked cell empty with the operand in its tooltip', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		expect(cell(containerEl, 'Full.md').textContent).not.toBe('');
		expect(cell(containerEl, 'NoEffort.md').textContent).toBe('');
		expect(cell(containerEl, 'NoEffort.md').title).toContain('Effort');
	});

	it('heads the column with the configured name, and its formula as the tooltip', () => {
		const { containerEl } = makeEstimationView(fixture(), values({ indicatorLabel: 'RICE' }));
		expect(head(containerEl)?.textContent).toBe('RICE');
		expect(head(containerEl)?.title).toContain('Adjusted value ÷ Effort');
	});

	it('falls back to a generic word, never to the formula, when nothing has named it', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		expect(head(containerEl)?.textContent).toBe('Indicator');
		expect(head(containerEl)?.title).toBe('Adjusted value ÷ Effort');
	});

	it('draws no column at all when no operand is named', () => {
		const { containerEl } = makeEstimationView(fixture(), values({ indicatorOperands: '' }));
		expect(head(containerEl)).toBeNull();
		expect(containerEl.querySelectorAll('[data-col="indicator"]')).toHaveLength(0);
	});

	it('ignores a stored sort naming the column when no indicator is drawn', () => {
		const { containerEl } = makeEstimationView(fixture(), values({ indicatorOperands: '' }));
		// Nothing is drawn for the indicator, so nothing can show or change that pick — the
		// pass falls back to Base order rather than sorting by a column that is not there.
		expect([...containerEl.querySelectorAll('.pbl-est-row')].map((row) => (row as HTMLElement).dataset.path)).toEqual([
			'Full.md',
			'NoEffort.md',
		]);
		expect(containerEl.querySelector('[aria-sort]')).toBeNull();
	});

	it('sorts by it, putting the item with no figure last in both directions', () => {
		const { containerEl } = makeEstimationView(fixture(), values());
		const order = (): string[] =>
			[...containerEl.querySelectorAll('.pbl-est-row')].map((row) => (row as HTMLElement).dataset.path as string);
		const header = head(containerEl) as HTMLElement;
		header.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(order()).toEqual(['Full.md', 'NoEffort.md']);
		(head(containerEl) as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(order()).toEqual(['Full.md', 'NoEffort.md']);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/estimation/indicatorColumn.test.ts`
Expected: FAIL — no element matches `[data-col="indicator"]`.

- [ ] **Step 3: Widen the sort vocabulary**

In `src/storage/viewStateStore.ts`, add to `ESTIMATION_SORT_VALUES`:

```ts
	'indicator:asc',
	'indicator:desc',
```

and correct its doc comment: the column list gains `|indicator` and "the twelve combinations" becomes "the fourteen combinations".

- [ ] **Step 4: Draw and sort the column in `src/view/estimation/renderTable.ts`**

Import `indicatorFormula`. Then:

```ts
type SortColumn = 'title' | 'total' | 'coverage' | 'confidence' | 'effort' | 'indicator' | 'currency';
const SORT_COLUMNS: readonly SortColumn[] = ['title', 'total', 'coverage', 'confidence', 'effort', 'indicator', 'currency'];
```

Give `HeaderSpec` an optional tooltip and set it in `sortHeader`, right after the label span:

```ts
interface HeaderSpec {
	column: SortColumn;
	cls: string;
	label: string;
	/** Supplementary only. The accessible name stays the visible label (plus the direction
	 *  when active), or a screen reader loses the word the reader can see and speech input
	 *  has no way to name the header it is looking at. */
	title?: string;
}
```

```ts
	if (spec.title) btn.title = spec.title;
```

In `renderHead`, between the effort and currency headers — the whole header takes the indicator, so give `renderHead` the settings it already has through `view`:

```ts
	const indicator = view.settings.indicator;
	if (indicator.operands.length > 0) {
		sortHeader(
			view,
			head,
			{
				column: 'indicator',
				cls: 'pbl-est-cell',
				label: indicator.label || t('estimation.column.indicator'),
				title: indicatorFormula(view.settings.model, indicator),
			},
			pick,
		);
	}
```

In `renderRow`, between the effort cell and the currency chip — `renderRow` gains the indicator as a parameter from `renderRows`, which gains it from its caller:

```ts
	if (indicator.operands.length > 0) {
		const cell = row.createDiv({ cls: 'pbl-est-cell', attr: { 'data-col': 'indicator' } });
		numberCell(cell, item.indicator?.value ?? null, null);
		// The blocked operand as a tooltip, and the cell left EMPTY so the stylesheet's own
		// `:empty::before` dash draws the absence exactly as every other numeric column does.
		if (item.indicator?.blockedBy) cell.title = t('estimation.indicator.blocked', { operand: item.indicator.blockedBy });
	}
```

Narrow the pick to what this pass actually draws — one guard, at the one column that can
be absent. `restoreSort` keeps loading the stored value, so the pick comes back when the
operands do; what it must not do is apply a sort no header can show or change:

```ts
/**
 * The pick as this PASS can honour it: a stored `indicator:*` under a cleared operands box
 * names a column that is not drawn, so nothing could show its direction or click it away.
 * Ignored for the render, never cleared from the store — clearing would be a render pass
 * writing to the view-state store, which is the one thing a render must not do.
 */
function drawablePick(view: EstimationView, pick: SortPick | null): SortPick | null {
	if (pick?.column !== 'indicator') return pick;
	return view.settings.indicator.operands.length > 0 ? pick : null;
}
```

and use it where `renderTable` resolves the pick, before both `renderHead` and
`sortedItems` read it — one call, so the header and the rows can never disagree about
which sort this pass is drawing.

In `columnValue`, add the case:

```ts
		case 'indicator':
			return item.indicator?.value ?? null;
```

- [ ] **Step 5: Add the catalog key**

In `src/i18n/en.ts`:

```ts
	'estimation.indicator.blocked': 'No figure: {operand} is not answered',
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/view/estimation test/storage`
Expected: PASS, including the existing `sort.test.ts` — its six-column loop still passes because the indicator header is an addition, not a rename.

- [ ] **Step 7: Commit**

```bash
git add src/view/estimation/renderTable.ts src/storage/viewStateStore.ts src/i18n/en.ts test/view/estimation/indicatorColumn.test.ts
git commit -m "feat: the prioritized list takes an indicator column that sorts"
```

---

### Task 5: The panel's indicator line

**Files:**
- Modify: `src/view/estimation/panel.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/view/estimation/panel.test.ts` (extend)

**Interfaces:**
- Consumes: `EstimationItem.indicator`, `indicatorFormula`, `EstimationView.settings.indicator`.
- Produces: nothing new — `renderDerived` changes shape internally.

- [ ] **Step 1: Write the failing test**

Append to `test/view/estimation/panel.test.ts` (reusing that file's existing helpers for mounting and selecting):

```ts
	it('names the indicator by its configured name, and by its formula when unnamed', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues({
			confidenceProperty: 'note.confidence',
			effortProperty: 'note.effort',
			indicatorLabel: 'RICE',
		}));
		selectItem(containerEl, 'Full.md');
		const lines = [...containerEl.querySelectorAll('.pbl-est-derived span')].map((el) => el.textContent);
		expect(lines.some((line) => line?.startsWith('RICE:'))).toBe(true);
	});

	it('says which operand blocked it rather than dropping the line', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues({
			confidenceProperty: 'note.confidence',
		}));
		selectItem(containerEl, 'Full.md');
		const lines = [...containerEl.querySelectorAll('.pbl-est-derived span')].map((el) => el.textContent);
		expect(lines.some((line) => line?.includes('Effort'))).toBe(true);
	});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/estimation/panel.test.ts`
Expected: FAIL — the line still reads `Value to effort: …`.

- [ ] **Step 3: Replace `renderDerived`'s second line**

In `src/view/estimation/panel.ts`, `renderDerived` takes the indicator and the model:

```ts
/**
 * Confidence-adjusted value and the configured indicator — each derived on read and
 * written nowhere (`docs/requirements/The weighted score.md`). The indicator sits BESIDE
 * the value it is computed from, never instead of it, which is the epic's rule about a
 * merged number.
 *
 * A blocked indicator says which operand blocked it rather than dropping the line: a line
 * that vanishes reads as "this view has no opinion", and the reader is about to score.
 */
function renderDerived(panelEl: HTMLElement, item: EstimationItem, model: ScoringModel, indicator: Indicator): void {
	if (!item.result || item.confidence === null) return;
	const scale = model.confidence;
	const adjusted = round2((item.result.total * readAs(item.confidence, scale.min, scale.max)) / scale.max);
	const derived = panelEl.createDiv({ cls: 'pbl-est-derived' });
	derived.createSpan({ text: t('estimation.panel.adjustedValue', { value: adjusted }) });
	if (!item.indicator) return;
	const name = indicator.label || indicatorFormula(model, indicator);
	derived.createSpan({
		text:
			item.indicator.value === null
				? t('estimation.panel.indicatorBlocked', { name, operand: item.indicator.blockedBy ?? '' })
				: t('estimation.panel.indicator', { name, value: item.indicator.value }),
	});
}
```

and its call site becomes `renderDerived(header, item, scoringModel, view.settings.indicator)`.

- [ ] **Step 4: Add the catalog keys, and delete the one they replace**

In `src/i18n/en.ts`, remove `'estimation.panel.valueToEffort'` and add:

```ts
	'estimation.panel.indicator': '{name}: {value}',
	'estimation.panel.indicatorBlocked': '{name}: no figure — {operand} is not answered',
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/view/estimation test/i18n`
Expected: PASS. If `test/i18n/projections.test.ts` fails on an unmarked string, the operand labels are being drawn as data — check they come from `t()` in `operandLabel`.

- [ ] **Step 6: Commit**

```bash
git add src/view/estimation/panel.ts src/i18n/en.ts test/view/estimation/panel.test.ts
git commit -m "feat: the panel draws the configured indicator, or the operand blocking it"
```

---

### Task 6: The four presets, as data

**Files:**
- Create: `src/domain/estimationPresets.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/domain/estimationPresets.test.ts` (create)

**Interfaces:**
- Produces: `interface IndicatorPreset { id: string; name: string; operands: string[]; divisor: string | null }` and `const INDICATOR_PRESETS: IndicatorPreset[]`.

- [ ] **Step 1: Write the failing test**

Create `test/domain/estimationPresets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { INDICATOR_PRESETS } from '../../src/domain/estimationPresets';
import { configured } from '../helpers/estimationModel';
import { computeIndicator, indicatorFormula, modelFingerprint } from '../../src/domain/weightedScore';

describe('the shipped indicator presets', () => {
	it('ships RICE, ICE, WSJF and value over effort', () => {
		expect(INDICATOR_PRESETS.map((p) => p.name)).toEqual(['RICE', 'ICE', 'WSJF', 'Value over effort']);
	});

	it('gives ICE an ease operand and no divisor, as the Feature defines it', () => {
		const ice = INDICATOR_PRESETS.find((p) => p.id === 'ice');
		expect(ice?.operands).toContain('ease');
		expect(ice?.divisor).toBeNull();
	});

	it('names only operands this model can resolve', () => {
		const model = configured();
		for (const preset of INDICATOR_PRESETS) {
			const formula = indicatorFormula(model, { label: preset.name, operands: preset.operands, divisor: preset.divisor });
			// An unresolvable id composes as the raw id, which is always lowercase-hyphenated;
			// every label this model can resolve is a capitalised word.
			expect(formula).not.toMatch(/(^|[×÷] )[a-z-]+([ ]|$)/);
		}
	});

	it('leaves the value model untouched: no preset moves the fingerprint', () => {
		const model = configured();
		const before = modelFingerprint(model);
		for (const preset of INDICATOR_PRESETS) {
			computeIndicator(model, { label: preset.name, operands: preset.operands, divisor: preset.divisor }, {
				answers: new Map([['reach', 3]]),
				confidence: 4,
				effort: 2,
				complexity: 1,
				result: null,
			});
		}
		expect(modelFingerprint(model)).toBe(before);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/estimationPresets.test.ts`
Expected: FAIL — cannot resolve `../../src/domain/estimationPresets`.

- [ ] **Step 3: Write the preset data**

Create `src/domain/estimationPresets.ts`:

```ts
/**
 * The shipped indicator presets — data only, no imports, `defaultModel.ts`'s own shape and
 * for the same reason: a preset's NAME is written into the `.base`, so it must not depend
 * on which locale wrote it. Everything a reader is shown ABOUT a preset — its description
 * and the line naming what it reads through this model — is catalog text, keyed by id in
 * `view/estimation/presets.ts`.
 *
 * All four are INDICATOR presets, which is why none of them declares a kind: an indicator
 * persists nothing, so applying any of them leaves the value model and every stored total
 * exactly as they were. A value preset is a second kind and a second PBI.
 */
export interface IndicatorPreset {
	id: string;
	name: string;
	operands: string[];
	divisor: string | null;
}

export const INDICATOR_PRESETS: IndicatorPreset[] = [
	{ id: 'rice', name: 'RICE', operands: ['reach', 'business-impact', 'confidence'], divisor: 'effort' },
	// Impact × confidence × EASE, no divisor — the Feature's own definition. Ease is the
	// effort scale reversed on its range, not `1 ÷ effort`, which is a different ranking.
	{ id: 'ice', name: 'ICE', operands: ['business-impact', 'confidence', 'ease'], divisor: null },
	// Cost of delay over job size, read through this model's own value. A vault that
	// declares a cost-of-delay dimension points the operand at it and gets the real thing.
	{ id: 'wsjf', name: 'WSJF', operands: ['value'], divisor: 'effort' },
	{ id: 'value-over-effort', name: 'Value over effort', operands: ['adjustedValue'], divisor: 'effort' },
];
```

- [ ] **Step 4: Add the descriptions and notes to `src/i18n/en.ts`**

```ts
	'estimation.preset.rice.description':
		'Favours work that reaches many people, changes something that matters to them, and rests on evidence — then divides by what it costs. Widely used where the audience of one item differs a lot from the next.',
	'estimation.preset.rice.note': '',
	'estimation.preset.ice.description':
		'RICE without reach: a quicker score for a backlog whose items all touch roughly the same audience, so counting that audience adds nothing.',
	'estimation.preset.ice.note': 'Ease is the effort scale reversed on its own range.',
	'estimation.preset.wsjf.description':
		"SAFe's scheduling score: what delay costs, over how big the job is. Answers what to do first when everything in the list is worth doing.",
	'estimation.preset.wsjf.note':
		'Cost of delay is read as the value total, job size as effort. Point the numerator at a cost-of-delay dimension to get the real thing.',
	'estimation.preset.valueOverEffort.description':
		'The plainest ranking there is — value you are confident in, over what it takes. A reasonable default before a team commits to a named framework.',
	'estimation.preset.valueOverEffort.note': '',
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/domain/estimationPresets.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/estimationPresets.ts src/i18n/en.ts test/domain/estimationPresets.test.ts
git commit -m "feat: four indicator presets, as data"
```

---

### Task 7: The picker, its preview, and the toolbar button

**Files:**
- Create: `src/ui/estimationPresetDialog.ts`
- Create: `src/view/estimation/presets.ts`
- Create: `styles/estimationPresets.css`
- Modify: `styles/index.css`
- Modify: `src/view/estimation/toolbar.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/view/estimation/presets.test.ts` (create)

**Interfaces:**
- Consumes: `INDICATOR_PRESETS` (Task 6), `indicatorFormula` (Task 1), `EstimationView.config`, `EstimationView.refresh()`.
- Produces:
  - `interface PresetRow { id: string; name: string; formula: string; description: string; note: string }` (`ui/estimationPresetDialog.ts`)
  - `function openPresetDialog(app: App, rows: PresetRow[], current: string, onApply: (id: string) => void): void` (`ui/estimationPresetDialog.ts`)
  - `function openEstimationPresets(view: EstimationView): void` (`view/estimation/presets.ts`)

- [ ] **Step 1: Write the failing test**

Create `test/view/estimation/presets.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { Modal } from '../../helpers/obsidian-mock';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4, effort: 2 } });
	return vault;
}

function open(containerEl: HTMLElement): HTMLElement {
	(containerEl.querySelector('.pbl-est-presets') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
	return Modal.lastOpened?.contentEl as HTMLElement;
}

function row(contentEl: HTMLElement, id: string): HTMLElement {
	return contentEl.querySelector(`.pbl-est-preset[data-preset="${id}"]`) as HTMLElement;
}

function click(el: HTMLElement): void {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('starting from a known framework', () => {
	it('lists the four presets, each with a description and a formula', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		expect(contentEl.querySelectorAll('.pbl-est-preset')).toHaveLength(4);
		expect(row(contentEl, 'rice').querySelector('.pbl-est-preset-desc')?.textContent).toContain('Favours work');
		expect(row(contentEl, 'rice').querySelector('.pbl-est-preset-formula')?.textContent).toBe(
			'Reach × Business impact × Confidence ÷ Effort',
		);
	});

	it('writes nothing until Apply, and nothing at all on Cancel', () => {
		const { containerEl, config } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(row(contentEl, 'rice'));
		expect(config.setCalls).toHaveLength(0);
		click(contentEl.querySelector('.pbl-est-preset-cancel') as HTMLElement);
		expect(config.setCalls).toHaveLength(0);
	});

	it('sets exactly the three indicator keys on Apply, and writes no note', () => {
		const { containerEl, config } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(row(contentEl, 'rice'));
		click(contentEl.querySelector('.pbl-est-preset-apply') as HTMLElement);
		expect(config.setCalls.map((call) => call.key).sort()).toEqual([
			'indicatorDivisor',
			'indicatorLabel',
			'indicatorOperands',
		]);
		expect(config.values.indicatorOperands).toBe('reach, business-impact, confidence');
		expect(config.values.indicatorLabel).toBe('RICE');
	});

	it('says the value model is unchanged, and states the kind once rather than per row', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const contentEl = open(containerEl);
		click(row(contentEl, 'wsjf'));
		expect(contentEl.querySelector('.pbl-est-preview')?.textContent).toContain('value model is unchanged');
		expect(contentEl.querySelectorAll('.pbl-est-preset-kind')).toHaveLength(0);
		expect(contentEl.querySelector('.pbl-est-preset-kinds')?.textContent).toContain('beside the business value');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/estimation/presets.test.ts`
Expected: FAIL — no `.pbl-est-presets` button exists.

- [ ] **Step 3: Write the dialog**

Create `src/ui/estimationPresetDialog.ts`:

```ts
import { App, Modal } from 'obsidian';
import { t } from '../i18n/t';

/**
 * The preset picker and its preview. `ui/` is a leaf that knows about no layer, so this
 * takes plain ROWS and hands back the id that was picked — the view assembles the rows
 * from `domain/estimationPresets.ts` and the catalog, and the view is what writes.
 *
 * `stateColorsDialog.ts`'s shape, with one difference that is load-bearing: that dialog
 * reports each change as it happens, and this one writes only on Apply, because a preset
 * is one act over three configuration keys rather than a live preview.
 */
export interface PresetRow {
	id: string;
	/** The framework's own name — data, written into the `.base` by the caller. */
	name: string;
	formula: string;
	description: string;
	/** How this model reads a form the shape cannot express verbatim; '' where there is none. */
	note: string;
}

class PresetDialog extends Modal {
	private picked: string | null = null;

	constructor(
		app: App,
		private readonly rows: PresetRow[],
		private readonly current: string,
		private readonly onApply: (id: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText(t('estimation.presets.title'));
		contentEl.empty();
		contentEl.addClass('pbl-est-presets-dialog');
		// The kind, stated ONCE. Four rows each carrying an `Indicator` chip said the same
		// word four times; the chip comes back the day a second kind is on screen.
		contentEl.createEl('p', { cls: 'pbl-est-preset-kinds', text: t('estimation.presets.kinds') });
		const list = contentEl.createDiv({ cls: 'pbl-est-preset-list' });
		const preview = contentEl.createDiv({ cls: 'pbl-est-preview' });
		const actions = contentEl.createDiv({ cls: 'modal-button-container' });
		const apply = actions.createEl('button', { cls: 'mod-cta pbl-est-preset-apply', text: t('estimation.presets.apply') });
		apply.disabled = true;
		const cancel = actions.createEl('button', { cls: 'pbl-est-preset-cancel', text: t('estimation.presets.cancel') });
		cancel.addEventListener('click', () => this.close());
		apply.addEventListener('click', () => {
			if (!this.picked) return;
			this.onApply(this.picked);
			this.close();
		});
		for (const row of this.rows) this.renderRow(list, row, preview, apply);
	}

	private renderRow(list: HTMLElement, row: PresetRow, preview: HTMLElement, apply: HTMLButtonElement): void {
		const el = list.createDiv({ cls: 'pbl-est-preset', attr: { role: 'button', tabindex: '0', 'data-preset': row.id } });
		el.createDiv({ cls: 'pbl-est-preset-name', text: row.name });
		el.createDiv({ cls: 'pbl-est-preset-desc', text: row.description });
		el.createDiv({ cls: 'pbl-est-preset-formula', text: row.formula });
		if (row.note) el.createDiv({ cls: 'pbl-est-preset-note', text: row.note });
		const pick = (): void => {
			for (const other of Array.from(list.children)) other.removeClass('pbl-selected');
			el.addClass('pbl-selected');
			this.picked = row.id;
			apply.disabled = false;
			this.drawPreview(preview, row);
		};
		el.addEventListener('click', pick);
		el.addEventListener('keydown', (evt) => {
			if (evt.key !== 'Enter' && evt.key !== ' ') return;
			evt.preventDefault();
			pick();
		});
	}

	/** Drawn only once something is picked: reserving its height leaves a hole above the
	 *  buttons in the state the dialog opens in. Both lines are drawn the same way. */
	private drawPreview(preview: HTMLElement, row: PresetRow): void {
		preview.empty();
		preview.createEl('h4', { text: t('estimation.presets.whatChanges') });
		const line = (label: string, value: string): void => {
			const el = preview.createDiv({ cls: 'pbl-est-preview-row' });
			el.createSpan({ cls: 'pbl-est-preview-label', text: label });
			el.createSpan({ text: value });
		};
		line(t('estimation.presets.now'), this.current);
		line(t('estimation.presets.after'), `${row.name} — ${row.formula}`);
		// The invalidation count, true by construction rather than computed: an indicator
		// persists nothing, so no stored total can be affected by any of these.
		preview.createEl('p', { cls: 'pbl-est-preview-note', text: t('estimation.presets.unchanged') });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export function openPresetDialog(app: App, rows: PresetRow[], current: string, onApply: (id: string) => void): void {
	new PresetDialog(app, rows, current, onApply).open();
}
```

- [ ] **Step 4: Write the view's half**

Create `src/view/estimation/presets.ts`:

```ts
import { openPresetDialog, PresetRow } from '../../ui/estimationPresetDialog';
import { INDICATOR_PRESETS } from '../../domain/estimationPresets';
import { indicatorFormula } from '../../domain/weightedScore';
import { t } from '../../i18n/t';
import type { EstimationView } from './estimationView';

/**
 * The estimation view's half of the preset picker: it assembles the rows (data from
 * `domain/`, prose from the catalog), and it is what WRITES — three configuration keys and
 * nothing else. `ui/` knows about no layer, so the dialog itself does neither.
 *
 * Keyed statically rather than by `estimation.preset.${id}.description`: `t` derives its
 * key type from the catalog, so a static key is a compile error when it is missing and an
 * interpolated one is not.
 */
const PRESET_TEXT: Record<string, { description: string; note: string }> = {};

function presetText(id: string): { description: string; note: string } {
	// Built per call, never at module scope: `initLocale()` runs in `onload`, so a `const`
	// holding `t()` would freeze English at import time — `openTargetOptions`' own rule.
	const text: Record<string, { description: string; note: string }> = {
		rice: { description: t('estimation.preset.rice.description'), note: t('estimation.preset.rice.note') },
		ice: { description: t('estimation.preset.ice.description'), note: t('estimation.preset.ice.note') },
		wsjf: { description: t('estimation.preset.wsjf.description'), note: t('estimation.preset.wsjf.note') },
		'value-over-effort': {
			description: t('estimation.preset.valueOverEffort.description'),
			note: t('estimation.preset.valueOverEffort.note'),
		},
	};
	return text[id] ?? PRESET_TEXT[id] ?? { description: '', note: '' };
}

export function openEstimationPresets(view: EstimationView): void {
	const model = view.settings.model;
	const rows: PresetRow[] = INDICATOR_PRESETS.map((preset) => ({
		id: preset.id,
		name: preset.name,
		formula: indicatorFormula(model, { label: preset.name, operands: preset.operands, divisor: preset.divisor }),
		...presetText(preset.id),
	}));
	const indicator = view.settings.indicator;
	const formula = indicatorFormula(model, indicator);
	const current = indicator.operands.length === 0 ? t('estimation.presets.none') : indicator.label ? `${indicator.label} — ${formula}` : formula;
	openPresetDialog(view.app, rows, current, (id) => {
		const preset = INDICATOR_PRESETS.find((entry) => entry.id === id);
		if (!preset) return;
		// Three keys, and nothing else — no note is written by configuring an indicator.
		view.config.set('indicatorLabel', preset.name);
		view.config.set('indicatorOperands', preset.operands.join(', '));
		view.config.set('indicatorDivisor', preset.divisor ?? '');
		view.refresh();
	});
}
```

Delete the unused `PRESET_TEXT` constant and its reference in `presetText` before committing — it is written here only to show the fallback shape, and `npm run analyze` reports it dead. The final `presetText` ends with `return text[id] ?? { description: '', note: '' };`.

- [ ] **Step 5: Add the toolbar button**

In `src/view/estimation/toolbar.ts`, after the undo button and before the spacer:

```ts
	const presets = iconButton(bar, 'calculator', t('estimation.toolbar.presets'), 'pbl-est-presets');
	presets.addEventListener('click', () => openEstimationPresets(view));
```

with `import { openEstimationPresets } from './presets';` at the top.

- [ ] **Step 6: Add the catalog keys**

```ts
	'estimation.toolbar.presets': 'Start from a known framework',
	'estimation.presets.title': 'Start from a known framework',
	'estimation.presets.kinds':
		'These configure the indicator that sits beside the business value. The value model is unchanged, whichever you pick.',
	'estimation.presets.whatChanges': 'What this changes',
	'estimation.presets.now': 'Indicator now',
	'estimation.presets.after': 'Indicator after',
	'estimation.presets.none': 'None',
	'estimation.presets.unchanged': 'The value model is unchanged, and no stored total is affected.',
	'estimation.presets.apply': 'Apply',
	'estimation.presets.cancel': 'Cancel',
```

- [ ] **Step 7: Write the stylesheet partial**

Create `styles/estimationPresets.css`:

```css
/* The preset picker's own rules (`src/ui/estimationPresetDialog.ts`). Everything outside
   this file that the dialog draws — the modal frame, its title, its button container — is
   Obsidian's own and is deliberately not restyled here. */

.pbl-est-presets-dialog {
	display: flex;
	flex-direction: column;
	max-height: 100%;
	min-height: 0;
}

.pbl-est-preset-kinds {
	margin: 0 0 var(--size-4-3);
	font-size: var(--font-ui-small);
	color: var(--text-muted);
}

/* The LIST is the only scroller, and `min-height: 0` is the load-bearing half: `.modal`
   caps its own height, so a content block that scrolls as one carries Apply and Cancel
   below the fold — measured in the harness at a 620px window. Without `min-height: 0` a
   flex item refuses to shrink below its content and the column overflows exactly as
   before. */
.pbl-est-preset-list {
	display: flex;
	flex-direction: column;
	gap: var(--size-4-2);
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
}

.pbl-est-preset {
	padding: var(--size-4-2) var(--size-4-3);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-m);
	cursor: pointer;
}

.pbl-est-preset:hover {
	background-color: var(--background-modifier-hover);
}

.pbl-est-preset.pbl-selected {
	border-color: var(--interactive-accent);
}

.pbl-est-preset-name {
	font-weight: var(--font-medium);
	color: var(--text-normal);
}

.pbl-est-preset-desc {
	margin: var(--size-2-2) 0;
	font-size: var(--font-ui-small);
	color: var(--text-muted);
}

.pbl-est-preset-formula {
	font-size: var(--font-ui-small);
	color: var(--text-normal);
}

.pbl-est-preset-note {
	font-size: var(--font-ui-smaller);
	color: var(--text-faint);
}

.pbl-est-preview {
	flex: 0 0 auto;
	margin-top: var(--size-4-4);
}

.pbl-est-preview h4 {
	margin: 0 0 var(--size-4-2);
	font-size: var(--font-ui-small);
	color: var(--text-muted);
}

.pbl-est-preview-row {
	display: flex;
	gap: var(--size-4-2);
	font-size: var(--font-ui-small);
}

.pbl-est-preview-label {
	flex: 0 0 120px;
	color: var(--text-muted);
}

.pbl-est-preview-note {
	margin-top: var(--size-4-2);
	font-size: var(--font-ui-small);
	color: var(--text-muted);
}
```

and add to `styles/index.css`, at the end:

```css
/* Position NOT load-bearing: every selector here is this dialog's own vocabulary
   (`.pbl-est-preset*`, `.pbl-est-preview*`), declared in no other partial, and the
   `.pbl-est-presets-dialog` class sits on Obsidian's `.modal-content`, which this
   stylesheet does not otherwise target. */
@import "./estimationPresets.css";
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run test/view/estimation/presets.test.ts && npm run build && npm run lint`
Expected: PASS, and the build's stylesheet assembly accepts the new partial.

- [ ] **Step 9: Commit**

```bash
git add src/ui/estimationPresetDialog.ts src/view/estimation/presets.ts src/view/estimation/toolbar.ts styles/estimationPresets.css styles/index.css src/i18n/en.ts test/view/estimation/presets.test.ts
git commit -m "feat: pick a framework and the indicator is configured in one act"
```

---

## Phase B — opening the note being scored

### Task 8: One open controller, two views

**Files:**
- Modify: `src/view/openTarget.ts`
- Modify: `src/domain/itemHandling.ts`
- Modify: `src/domain/estimationOptions.ts`
- Modify: `src/view/estimation/estimationView.ts`
- Test: `test/view/estimation/openNote.test.ts` (create)

**Interfaces:**
- Consumes: `OpenController`, `OpenContext`, `resolveItemHandling`, `OpenTarget`.
- Produces:
  - `OpenController.open(ctx: OpenContext, item: { file: TFile }, evt: MouseEvent | KeyboardEvent): void` — parameter narrowed.
  - `defaultItemHandling(openIn: OpenTarget = 'active'): ItemHandling` and `resolveItemHandling(config, fallback: OpenTarget = 'active')`.
  - `EstimationView.opener: OpenController` and `EstimationView.openNote(item: EstimationItem, evt: MouseEvent | KeyboardEvent): void`.
  - `EstimationSettings` gains `openIn: OpenTarget`.

- [ ] **Step 1: Write the failing test**

Create `test/view/estimation/openNote.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4, effort: 2 } });
	return vault;
}

describe('opening the note being scored', () => {
	it('defaults to opening beside the view, not over it', () => {
		const { view } = makeEstimationView(fixture(), configuredValues());
		expect(view.settings.openIn).toBe('split');
	});

	it('honours a target the reader named', () => {
		const { view } = makeEstimationView(fixture(), configuredValues({ openIn: 'tab' }));
		expect(view.settings.openIn).toBe('tab');
	});

	it('opens the item it was given', () => {
		const { view } = makeEstimationView(fixture(), configuredValues({ openIn: 'tab' }));
		const openFile = vi.fn();
		(view.app.workspace as unknown as Record<string, unknown>).getLeaf = () => ({ openFile });
		const item = view.model?.byPath.get('Full.md');
		view.openNote(item!, new MouseEvent('click'));
		expect(openFile).toHaveBeenCalledWith(item!.file);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/estimation/openNote.test.ts`
Expected: FAIL — `settings.openIn` is undefined.

- [ ] **Step 3: Narrow the controller's parameter**

In `src/view/openTarget.ts`, replace the `BacklogItem` import with `TFile` from `obsidian` and change both signatures:

```ts
/** What either entry point needs of an item, which is only where it lives. Narrowed from
 *  `BacklogItem` when the estimation view became the second caller: this module never read
 *  anything else off one, and a controller that demands the backlog's own item type cannot
 *  be reused by a view that has a different one. */
type Openable = { file: TFile };
```

```ts
	open(ctx: OpenContext, item: Openable, evt: MouseEvent | KeyboardEvent): void {
```

```ts
	openIn(ctx: OpenContext, item: Openable, target: OpenTarget): void {
```

- [ ] **Step 4: Let the default differ per view**

In `src/domain/itemHandling.ts`:

```ts
/**
 * `active` is Obsidian's own default and the backlog's. The estimation view passes
 * `split`, and the difference is the point rather than an inconsistency: a tree is
 * something you leave, and a scoring panel is something you come back to between every
 * point — a note that replaced it would cost the reader the surface they were working on.
 */
export function defaultItemHandling(openIn: OpenTarget = 'active'): ItemHandling {
	return { openIn };
}

export function resolveItemHandling(config: BasesViewConfig, fallback: OpenTarget = 'active'): ItemHandling {
	const raw = config.get('openIn');
	const offered = typeof raw === 'string' && (OPEN_TARGET_KEYS as readonly string[]).includes(raw);
	return { openIn: offered ? (raw as OpenTarget) : defaultItemHandling(fallback).openIn };
}
```

- [ ] **Step 5: Resolve it into the estimation settings and offer the box**

In `src/domain/estimationSettings.ts`, import `OpenTarget` and `resolveItemHandling` from `./itemHandling`, extend the interface with `openIn: OpenTarget`, and add to the returned object:

```ts
		// `split` rather than `active`: this view is the surface being scored on.
		openIn: resolveItemHandling(config, 'split').openIn,
```

In `src/domain/estimationOptions.ts`, import `openTargetOptions` and `defaultItemHandling` from `./itemHandling` and add to `modelGroup()`'s items:

```ts
			{
				type: 'dropdown',
				key: 'openIn',
				displayName: 'Open in',
				options: openTargetOptions(),
				default: defaultItemHandling('split').openIn,
			},
```

- [ ] **Step 6: Give the view a controller**

In `src/view/estimation/estimationView.ts`, import `OpenController` from `../openTarget` and add:

```ts
	/** One per view, and it holds state between opens — the side pane it last used. */
	readonly opener = new OpenController();

	/**
	 * Where a note opens, asked in ONE place: the panel's control and the table's `Enter`
	 * both land here, so this view has one idea of opening rather than two, and the
	 * hardcoded `getLeaf(false)` that used to replace this very view is gone.
	 */
	openNote(item: EstimationItem, evt: MouseEvent | KeyboardEvent): void {
		this.opener.open({ app: this.app, viewEl: this.viewEl, settings: { openIn: this.settings.openIn } }, item, evt);
	}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/view test/domain`
Expected: PASS — including the backlog view's own open tests, which the narrowed parameter must not have changed.

- [ ] **Step 8: Commit**

```bash
git add src/view/openTarget.ts src/domain/itemHandling.ts src/domain/estimationSettings.ts src/domain/estimationOptions.ts src/view/estimation/estimationView.ts test/view/estimation/openNote.test.ts
git commit -m "feat: the estimation view opens notes through the shared controller"
```

---

### Task 9: The Open note control, and the row's Enter

**Files:**
- Modify: `src/view/estimation/panel.ts`
- Modify: `src/view/estimation/renderTable.ts`
- Modify: `styles/estimationPanel.css`
- Modify: `src/i18n/en.ts`
- Test: `test/view/estimation/openNote.test.ts` (extend)

**Interfaces:**
- Consumes: `EstimationView.openNote` (Task 8).
- Produces: a `button.pbl-est-open` inside `.pbl-est-header`.

- [ ] **Step 1: Write the failing test**

Append to `test/view/estimation/openNote.test.ts`:

```ts
import { selectItem } from '../../helpers/estimation';

describe('the Open note control', () => {
	it('sits in the panel header and opens the item the panel is showing', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const openFile = vi.fn();
		(view.app.workspace as unknown as Record<string, unknown>).getLeaf = () => ({ openFile });
		selectItem(containerEl, 'Full.md');
		const btn = containerEl.querySelector('.pbl-est-header button.pbl-est-open') as HTMLElement;
		expect(btn.getAttribute('aria-label')).toBe('Open note');
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(openFile).toHaveBeenCalledWith(view.model?.byPath.get('Full.md')?.file);
	});

	it('opens nothing when the item has left the base since the panel drew', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const openFile = vi.fn();
		(view.app.workspace as unknown as Record<string, unknown>).getLeaf = () => ({ openFile });
		selectItem(containerEl, 'Full.md');
		const btn = containerEl.querySelector('.pbl-est-header button.pbl-est-open') as HTMLElement;
		// The row is gone from the model the click will resolve against.
		view.model?.byPath.delete('Full.md');
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(openFile).not.toHaveBeenCalled();
	});

	it('writes nothing: the undo slot is exactly as it was', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		(view.app.workspace as unknown as Record<string, unknown>).getLeaf = () => ({ openFile: vi.fn() });
		selectItem(containerEl, 'Full.md');
		const before = view.gate.canUndo();
		(containerEl.querySelector('.pbl-est-header button.pbl-est-open') as HTMLElement).dispatchEvent(
			new MouseEvent('click', { bubbles: true }),
		);
		expect(view.gate.canUndo()).toBe(before);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/estimation/openNote.test.ts`
Expected: FAIL — no `.pbl-est-open` element.

- [ ] **Step 3: Draw the control**

In `src/view/estimation/panel.ts`, inside the header block, right after the title:

```ts
	const header = panelEl.createDiv({ cls: 'pbl-est-header' });
	const titleRow = header.createDiv({ cls: 'pbl-est-title-row' });
	titleRow.createDiv({ cls: 'pbl-est-title', text: item.title });
	// In the STICKY header rather than at the panel's foot: the reader needs the note
	// exactly when they are eight dimensions down and cannot answer one from the rubric.
	const open = titleRow.createEl('button', {
		cls: 'pbl-icon-btn pbl-est-open',
		attr: { type: 'button', 'aria-label': t('estimation.panel.openNote'), title: t('estimation.panel.openNote'), 'data-action': 'open' },
	});
	setIcon(open, 'file-text');
```

and in `wirePanelEvents`, before the cleanup branch:

```ts
		if (target.dataset.action === 'open') {
			// Resolved against the CURRENT model at click time, never the item this panel
			// closed over: a Bases pass can remove the row between the draw and the click,
			// and opening *something* would be worse than opening nothing — the reader is
			// about to score whatever they read.
			const live = view.model?.byPath.get(item.file.path);
			if (live) view.openNote(live, evt);
			return;
		}
```

- [ ] **Step 4: Route the table's Enter through the same method**

In `src/view/estimation/renderTable.ts`, replace the `Enter` branch body:

```ts
		if (evt.key === 'Enter') {
			const item = view.selectedPath ? model.byPath.get(view.selectedPath) : undefined;
			if (item) view.openNote(item, evt);
		}
```

- [ ] **Step 5: Add the catalog key and the layout rule**

`src/i18n/en.ts`:

```ts
	'estimation.panel.openNote': 'Open note',
```

`styles/estimationPanel.css`:

```css
/* The title and its Open note control on one line, the control pinned to the end — the
   header is `position: sticky`, so this row stays reachable however far the reader has
   scrolled down the dimensions. */
.pbl-est-title-row {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
}

.pbl-est-title-row .pbl-est-title {
	flex: 1 1 auto;
	min-width: 0;
}

.pbl-est-open {
	flex: 0 0 auto;
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/view/estimation`
Expected: PASS, including `keyboard.test.ts` — `Enter` still opens, through a different route.

- [ ] **Step 7: Commit**

```bash
git add src/view/estimation/panel.ts src/view/estimation/renderTable.ts styles/estimationPanel.css src/i18n/en.ts test/view/estimation/openNote.test.ts
git commit -m "feat: open the note being scored from the panel header"
```

---

### Task 10: The register, and the changelog

**Files:**
- Modify: `docs/requirements/Starting from a known framework.md`
- Create: `docs/requirements/Starting from a value framework.md`
- Modify: `docs/requirements/Opening the note being scored.md` (status)
- Modify: `docs/requirements/Ranking the items by value.md` (status of the two shipped PBIs is untouched — see below)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Narrow the preset PBI to its indicator half**

In `docs/requirements/Starting from a known framework.md`, replace the two-kinds paragraph with a sentence saying this PBI ships the indicator presets, and that value presets are `[[Starting from a value framework]]`. In `## Where it lives`, name the exact paths, because `docs-check.mjs` rule 7 requires every module in `src/` to be specified by a note and a superpowers spec does not count:

```markdown
The preset data is `src/domain/estimationPresets.ts`, data beside `src/domain/defaultModel.ts`
for the same reason the rubric sentences are data. The indicator's own shape is in
`src/domain/scoringModel.ts` and its arithmetic in `src/domain/weightedScore.ts`; it is
resolved from the view options by `src/domain/estimationSettings.ts` and offered by
`src/domain/estimationOptions.ts`, computed per item in `src/domain/estimationItems.ts`,
and drawn by `src/view/estimation/renderTable.ts` and `src/view/estimation/panel.ts`.
The picker is `src/ui/estimationPresetDialog.ts`, over rows assembled by
`src/view/estimation/presets.ts` — `ui/` knows about no layer, so the dialog takes plain
rows and hands back the id that was picked.
```

- [ ] **Step 2: Add the sibling PBI for value presets**

Create `docs/requirements/Starting from a value framework.md`, `type: PBI`, `parent: "[[Presets for the known frameworks]]"`, `order: 20`, `status: Open`, carrying the acceptance criteria this increment dropped: dimensions added and dropped named before anything is written, each weight before and after, and the count of stored totals the change would turn foreign — which is why it depends on `[[Knowing what a model change invalidated]]`. Say that WSJF's cost-of-delay dimensions arrive with it.

- [ ] **Step 3: Flip the statuses of what shipped**

Set `status: Done` and `finished: 2026-08-22` on `docs/requirements/Starting from a known framework.md` and `docs/requirements/Opening the note being scored.md`. Leave every other estimation PBI as it is — several read `Open` while describing shipped behaviour, and correcting the whole set is its own change rather than a line in this one.

- [ ] **Step 4: Write the changelog entries**

Under `## [Unreleased]` → `### Added` in `CHANGELOG.md`:

```markdown
- **The estimation view ranks by a framework you pick.** A new toolbar action offers RICE,
  ICE, WSJF and value over effort; picking one previews what it would change and configures
  the indicator in one act, without touching the value model or any stored total. The
  indicator is a product of named operands over an optional divisor — no expression, and
  nothing parses one — so swapping an operand afterwards is an edit to a text box. It takes
  a column in the table that sorts, with an item whose operands are unanswered sorting with
  the unmeasured rather than at one end, and it draws beside the confidence-adjusted value
  in the panel. Clear the operands box and there is no indicator and no column.

- **Open the note you are scoring, from the panel.** The item's name in the panel header now
  carries an Open note control, and the table's `Enter` goes the same way — both through the
  same controller the backlog view uses, so the estimation view gains an `Open in` setting
  and, on its default, opens the note beside itself rather than over itself.
```

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: all five steps pass.

- [ ] **Step 6: Commit**

```bash
git add docs CHANGELOG.md
git commit -m "docs: record the indicator presets and the open-note control"
```

---

## Self-review

**Spec coverage.** Indicator shape → Task 1. Operand vocabulary including `ease` → Task 1. Three no-figure cases plus the empty operand list → Tasks 1 and 4. Divisor refused stored and resolved → Task 1. Reserved built-ins → Task 1 (`operandLabel` asks the built-ins before the dimensions). Three config keys and the default → Task 2. Per-item computation → Task 3. Seventh column, header fallback to a generic word with the formula as tooltip only, sort with the unmeasured last, store vocabulary → Task 4. Panel line beside the adjusted value → Task 5. Four presets as data, descriptions and notes as catalog text → Task 6. Dialog with the kind stated once, symmetric preview, list-only scroller, cancel writing nothing, apply setting exactly three keys → Task 7. PBI: the control in the sticky header, the stale-item branch, the modifier and split branches (inherited from `OpenController`, asserted by the backlog's own suite), `Enter` routed through one method, writing nothing → Tasks 8 and 9. Register and changelog → Task 10.

**Known gap, stated rather than left implicit:** the narrow-pane band (roughly 940–1020px) is not addressed by any task here. It belongs to `Keeping columns whole under a narrow pane`, which stays Open.

**Type consistency.** `IndicatorFigure` is the return of `computeIndicator` and the type of `EstimationItem.indicator` in Tasks 1, 3, 4 and 5. `Indicator` is produced in Task 1, resolved in Task 2, consumed in Tasks 3–5 and 7. `PresetRow` is produced by `ui/estimationPresetDialog.ts` and built in `view/estimation/presets.ts`, both in Task 7. `openNote(item, evt)` is defined in Task 8 and called in Task 9.
