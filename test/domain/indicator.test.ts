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

	it('composes a formula from operand labels', () => {
		expect(indicatorFormula(configured(), ind({ operands: ['reach', 'confidence'], divisor: 'effort' }))).toBe(
			'Reach × Confidence ÷ Effort',
		);
		expect(indicatorFormula(configured(), ind({ operands: ['value'], divisor: null }))).toBe('Value');
	});
});
