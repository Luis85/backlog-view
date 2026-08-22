import { describe, expect, it } from 'vitest';
import { configured } from '../helpers/estimationModel';
import { Indicator } from '../../src/domain/scoringModel';
import { computeIndicator, computeTotal, IndicatorInputs, indicatorFormula } from '../../src/domain/weightedScore';
import { buildEstimationModel } from '../../src/domain/estimationItems';
import { FakeVault } from '../helpers/vault';

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
		// Confidence bound (unlike `configured()`'s own default) so a null answer is truly
		// unanswered rather than unbound — the pair this test is half of is in the
		// "CONTROLLER AMENDMENT 1" block below.
		const model = configured({ confidenceProperty: 'note.confidence' });
		const figure = computeIndicator(model, ind({ operands: ['reach', 'confidence'], divisor: null }), inputs({ confidence: null }));
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'Confidence', reason: 'unanswered' } });
	});

	it('has no figure, naming the id itself, when an operand names nothing', () => {
		const figure = computeIndicator(configured(), ind({ operands: ['reeech'], divisor: null }), inputs());
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'reeech', reason: 'unknown' } });
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
		const nonpositive = { value: null, blockedBy: { operand: 'Effort', reason: 'nonpositive' } };
		expect(computeIndicator(model, ind(), inputs({ effort: 0 }))).toEqual(nonpositive);
		expect(computeIndicator(model, ind(), inputs({ effort: -2 }))).toEqual(nonpositive);
	});

	it('refuses a divisor that RESOLUTION turns nonpositive', () => {
		// `lessIsBetter` over 0-10, answered at its top, resolves to 0 — which would divide
		// to Infinity while passing any check on what the note holds.
		const model = configured({ 'dimRange.reach': '0-10', 'dimLessIsBetter.reach': true });
		const figure = computeIndicator(model, ind({ operands: ['value'], divisor: 'reach' }), inputs({}, { ...FULL, reach: 10 }));
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'Reach', reason: 'nonpositive' } });
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

	it('multiplies the UNROUNDED dimension value, not the display score, so a fractional answer is not lost', () => {
		// `reach` in range: 1.004 rounds to a `score` of 1, but the arithmetic must carry the
		// unrounded 1.004 forward — `1.004 × confidence(5) = 5.02`, not `5`. Reading `score`
		// here would round BEFORE multiplying and collapse two distinguishable answers onto
		// one figure, exactly the failure `docs/requirements/Ranking the items by value.md`
		// warns a prioritization order cannot afford.
		const model = configured();
		const figure = computeIndicator(
			model,
			ind({ operands: ['reach', 'confidence'], divisor: null }),
			inputs({ confidence: 5 }, { ...FULL, reach: 1.004 }),
		);
		expect(figure).toEqual({ value: 5.02, blockedBy: null });
	});

	it('gives a reserved id to the built-in even when a dimension claims the same name', () => {
		// The collision INDICATOR_BUILTINS exists to decide. A vault may legitimately declare a
		// dimension called `effort`; the operand must still resolve to the effort SCALE, and the
		// dimension must keep its own weight in the value model, untouched.
		const model = configured();
		model.dimensions.push({
			id: 'effort',
			label: 'Effort',
			key: 'note.effort-dimension',
			min: 1,
			max: 5,
			weight: 10,
			lessIsBetter: false,
			rubric: ['a', 'b', 'c', 'd', 'e'],
		});
		const figure = computeIndicator(model, ind({ operands: ['effort'], divisor: null }), inputs({ effort: 3 }));
		expect(figure).toEqual({ value: 3, blockedBy: null });
	});

	// CONTROLLER AMENDMENT 1: a scale with no key bound to it is a different failure from a
	// bound scale nobody has answered — the repair is not the same, so the reason must not
	// be either. Three pairs, one per operand that reads a scale.
	it('says an unbound scale is unbound, not unanswered — the repair is a different one', () => {
		// `configured()` binds no confidence/effort/complexity property by default, which is
		// exactly the state this reports on: the panel draws a bare label row for such a scale
		// (`panel.ts`'s `spec.key === ''` return), so "not answered" sends the reader to a
		// control that is not there.
		const model = configured();
		const figure = computeIndicator(model, ind({ operands: ['effort'], divisor: null }), inputs({ effort: null }));
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'Effort', reason: 'unbound' } });
	});

	it('still says unanswered when the scale IS bound and the note simply has no value', () => {
		// The pair that makes the previous test mean something: same null value, different
		// reason, decided by whether a property is bound.
		const model = configured({ effortProperty: 'note.effort' });
		const figure = computeIndicator(model, ind({ operands: ['effort'], divisor: null }), inputs({ effort: null }));
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'Effort', reason: 'unanswered' } });
	});

	it('blocks a derived ease on EFFORT, unbound — the reader binds Effort, never "Ease"', () => {
		// A blocker naming 'Ease' told the reader to bind a property to something nothing
		// binds to; the repair is always Effort, whichever way ease is blocked.
		const model = configured();
		const figure = computeIndicator(model, ind({ operands: ['ease'], divisor: null }), inputs({ effort: null }));
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'Effort', reason: 'unbound' } });
	});

	it('still blocks a derived ease on EFFORT when effort IS bound and the note has no value for it', () => {
		const model = configured({ effortProperty: 'note.effort' });
		const figure = computeIndicator(model, ind({ operands: ['ease'], divisor: null }), inputs({ effort: null }));
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'Effort', reason: 'unanswered' } });
	});

	it('blocks a derived adjustedValue on CONFIDENCE, unbound — the reader answers Confidence, never "Adjusted value"', () => {
		const model = configured();
		const figure = computeIndicator(model, ind({ operands: ['adjustedValue'], divisor: null }), inputs({ confidence: null }));
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'Confidence', reason: 'unbound' } });
	});

	it('still blocks a derived adjustedValue on CONFIDENCE when confidence IS bound and the note has no value for it', () => {
		const model = configured({ confidenceProperty: 'note.confidence' });
		const figure = computeIndicator(model, ind({ operands: ['adjustedValue'], divisor: null }), inputs({ confidence: null }));
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'Confidence', reason: 'unanswered' } });
	});

	it('names adjustedValue itself when NO dimension is answered — that failure is not about confidence', () => {
		// The one adjustedValue block that keeps self-naming: `inputs.result === null` says
		// nothing about whether confidence is bound, so there is no source scale to blame.
		const model = configured({ confidenceProperty: 'note.confidence' });
		const figure = computeIndicator(model, ind({ operands: ['adjustedValue'], divisor: null }), {
			answers: new Map(),
			confidence: 4,
			effort: null,
			complexity: null,
			result: null,
		});
		expect(figure).toEqual({ value: null, blockedBy: { operand: 'Adjusted value', reason: 'unanswered' } });
	});

	it('keeps the FORMULA reading the operand the reader configured, even though the blocker now names the source scale', () => {
		// The blocker and the formula answer different questions on purpose — see
		// `ResolvedOperand`'s own comment. A "fix" that renamed the operand everywhere would
		// quietly change what the column header and the preset dialog display too.
		expect(indicatorFormula(configured(), ind({ operands: ['adjustedValue'], divisor: 'effort' }))).toBe('Adjusted value ÷ Effort');
	});

	it('divides by a derived ease even when the stored effort is zero — ease has no stored source', () => {
		// effort 0 clamps to the scale minimum, so ease is at its MAXIMUM. Reporting that as a
		// nonpositive divisor described the raw effort, not the operand the reader configured.
		// value operand = FULL profile's total, 3.55; ease = 1 + 5 − clamp(0, 1, 5) = 5;
		// 3.55 ÷ 5 = 0.71.
		const model = configured({ effortProperty: 'note.effort' });
		const figure = computeIndicator(model, ind({ operands: ['value'], divisor: 'ease' }), inputs({ effort: 0 }));
		expect(figure?.blockedBy).toBeNull();
		expect(figure?.value).toBe(0.71);
	});

	it('still refuses a stored effort of zero when EFFORT itself is the divisor', () => {
		// The pair that keeps the first test honest: the stored check is not being removed, it is
		// being applied to the operand that actually has a stored source.
		const model = configured({ effortProperty: 'note.effort' });
		const figure = computeIndicator(model, ind({ operands: ['value'], divisor: 'effort' }), inputs({ effort: 0 }));
		expect(figure?.blockedBy).toEqual({ operand: 'Effort', reason: 'nonpositive' });
	});

	it('composes a formula from operand labels', () => {
		expect(indicatorFormula(configured(), ind({ operands: ['reach', 'confidence'], divisor: 'effort' }))).toBe(
			'Reach × Confidence ÷ Effort',
		);
		expect(indicatorFormula(configured(), ind({ operands: ['value'], divisor: null }))).toBe('Value');
	});
});

describe('the indicator on a built item', () => {
	it('is computed once per item, and is null when no operand is named', () => {
		const vault = new FakeVault();
		vault.addFile('Full.md', { frontmatter: { ...FULL, confidence: 4, effort: 2 } });
		// `effort` is a fixed scale, unbound by `configured()`'s own default (see
		// `weightedScore.test.ts`'s "reads the fixed scales when bound") — bound here so the
		// item this builds actually carries the effort the frontmatter states.
		const model = configured({ effortProperty: 'note.effort' });
		const withOne = buildEstimationModel(vault.app, vault.entries(), model, ind({ operands: ['effort'], divisor: null }));
		expect(withOne.items[0].indicator).toEqual({ value: 2, blockedBy: null });
		const withNone = buildEstimationModel(vault.app, vault.entries(), model, ind({ operands: [] }));
		expect(withNone.items[0].indicator).toBeNull();
	});
});
