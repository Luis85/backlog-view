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
