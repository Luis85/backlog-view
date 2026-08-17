import { describe, expect, it } from 'vitest';
import { getEstimationViewOptions } from '../../src/domain/estimationOptions';
import { dimOption } from '../../src/domain/estimationSettings';
import { DEFAULT_DIMENSIONS } from '../../src/domain/defaultModel';
import { FakeViewConfig } from '../helpers/vault';

/** Every option across every group, the way `viewOptions.test.ts` flattens the backlog's own. */
function flatten(options: ReturnType<typeof getEstimationViewOptions>) {
	return options.flatMap((o) => ('items' in o ? o.items : [o]));
}

function groupNamed(options: ReturnType<typeof getEstimationViewOptions>, displayName: string) {
	const group = options.find((g) => 'displayName' in g && g.displayName === displayName);
	if (!group || !('items' in group)) throw new Error(`${displayName} group missing`);
	return group;
}

describe('getEstimationViewOptions', () => {
	it('declares the Model group: dimensions, output range, value and stamp properties', () => {
		const keys = flatten(getEstimationViewOptions(new FakeViewConfig({}))).map((o) => o.key);
		expect(keys).toEqual(expect.arrayContaining(['dimensions', 'outputRange', 'valueProperty', 'stampProperty']));
	});

	it('the dimensions box defaults to the shipped eight ids, comma-joined', () => {
		const flat = flatten(getEstimationViewOptions(new FakeViewConfig({})));
		const dims = flat.find((o) => o.key === 'dimensions') as { default?: string };
		expect(dims.default).toBe(DEFAULT_DIMENSIONS.map((d) => d.id).join(', '));
	});

	it('offers one group per shipped dimension, its weight defaulting to the shipped weight', () => {
		const reach = groupNamed(getEstimationViewOptions(new FakeViewConfig({})), 'Reach');
		const keys = reach.items.map((i) => i.key);
		expect(keys).toEqual([
			dimOption('reach', 'property'),
			dimOption('reach', 'weight'),
			dimOption('reach', 'range'),
			dimOption('reach', 'lessIsBetter'),
			dimOption('reach', 'label'),
		]);
		const weight = reach.items.find((i) => i.key === dimOption('reach', 'weight')) as { default?: string };
		expect(weight.default).toBe('10');
	});

	it('is config-aware: a custom dimensions list drives which groups are offered, unknown ids included', () => {
		const groups = getEstimationViewOptions(new FakeViewConfig({ dimensions: 'reach, my-custom' }));
		const names = groups.filter((g) => 'displayName' in g).map((g) => (g as { displayName: string }).displayName);
		expect(names).toContain('Reach');
		// An id with no shipped row falls back to itself as both the label and the group name.
		expect(names).toContain('my-custom');
		const custom = groupNamed(groups, 'my-custom');
		const weight = custom.items.find((i) => i.key === dimOption('my-custom', 'weight')) as { default?: string };
		// No shipped default to show for an id nothing ships — the box carries none.
		expect(weight.default).toBe('');
	});

	it('declares the Scales group: confidence, effort and complexity properties', () => {
		const keys = flatten(getEstimationViewOptions(new FakeViewConfig({}))).map((o) => o.key);
		expect(keys).toEqual(expect.arrayContaining(['confidenceProperty', 'effortProperty', 'complexityProperty']));
	});

	it('limits every property picker to note properties', () => {
		const flat = flatten(getEstimationViewOptions(new FakeViewConfig({})));
		const value = flat.find((o) => o.key === 'valueProperty') as { filter: (p: string) => boolean };
		expect(value.filter('note.business-value')).toBe(true);
		expect(value.filter('file.name')).toBe(false);
		const dimProperty = flat.find((o) => o.key === dimOption('reach', 'property')) as {
			filter: (p: string) => boolean;
		};
		expect(dimProperty.filter('note.reach')).toBe(true);
		expect(dimProperty.filter('formula.x')).toBe(false);
		const scaleProperty = flat.find((o) => o.key === 'confidenceProperty') as { filter: (p: string) => boolean };
		expect(scaleProperty.filter('note.confidence')).toBe(true);
	});

	it('rubric sentences get no options-menu box this round — stored keys only, hand-editable in the .base', () => {
		const keys = flatten(getEstimationViewOptions(new FakeViewConfig({}))).map((o) => o.key);
		expect(keys.some((k) => k.startsWith('dimRubric.') || k.startsWith('scaleRubric.'))).toBe(false);
	});
});
