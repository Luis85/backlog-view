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

	it('trims a padded divisor to match the operand vocabulary', () => {
		expect(resolve({ indicatorDivisor: ' effort ' }).indicator.divisor).toBe('effort');
	});

	it('reads a whitespace-only divisor as cleared, not as a name', () => {
		expect(resolve({ indicatorDivisor: '   ' }).indicator.divisor).toBeNull();
	});

	it('offers an Indicator group with the three boxes', () => {
		const groups = getEstimationViewOptions(new FakeViewConfig(configuredValues()) as never);
		const group = groups.find((g) => g.displayName === 'Indicator');
		expect(group?.items.map((item) => item.key)).toEqual(['indicatorLabel', 'indicatorOperands', 'indicatorDivisor']);
	});
});
