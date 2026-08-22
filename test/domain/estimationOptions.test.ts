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

/** Every group's heading, in order — how a test asks what the panel would show as the
 *  list of dimension (and Model/Scales) headings, without caring which group is at which
 *  index. */
function groupNames(options: ReturnType<typeof getEstimationViewOptions>): string[] {
	return options.filter((g) => 'displayName' in g).map((g) => (g as { displayName: string }).displayName);
}

/** The `Label` box for one dimension id — the box `dimensionGroup`'s own rule keeps pinned
 *  to the SHIPPED value in both `default` and `placeholder`, never the current one. */
function labelItem(options: ReturnType<typeof getEstimationViewOptions>, id: string) {
	return flatten(options).find((o) => o.key === dimOption(id, 'label')) as { default?: string; placeholder?: string };
}

/** The `Weight` box for one dimension id, the same shape as `labelItem` above — this one
 *  asserts the `displayName`, the box's own rule sentence, rather than its default. */
function weightItem(options: ReturnType<typeof getEstimationViewOptions>, id: string) {
	return flatten(options).find((o) => o.key === dimOption(id, 'weight')) as { displayName?: string };
}

describe('getEstimationViewOptions', () => {
	it('declares the Model group: dimensions, output range, value and stamp properties', () => {
		const keys = flatten(getEstimationViewOptions(new FakeViewConfig({}))).map((o) => o.key);
		expect(keys).toEqual(expect.arrayContaining(['dimensions', 'outputRange', 'valueProperty', 'stampProperty']));
		// And the one option here that is not a scoring key: the property a note's TYPE is
		// read from, which is what keeps a `Resource` off this table. It has to be OFFERED
		// rather than only read — the option is per view in Bases, so the backlog view's own
		// pick cannot answer for this one, and a vault keeping types under `kind` would
		// otherwise sit on the shipped fallback and score its people.
		expect(keys).toContain('typeProperty');
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
		const names = groupNames(groups);
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

describe('a dimension group is headed the way the panel heads it', () => {
	it('heads the group by the RESOLVED label, including an override', () => {
		const options = getEstimationViewOptions(new FakeViewConfig({ 'dimLabel.reach': 'Blast radius' }));
		expect(groupNames(options)).toContain('Blast radius');
		expect(groupNames(options)).not.toContain('Reach');
	});

	it('heads an id outside the shipped eight by its own label rather than its slug', () => {
		const options = getEstimationViewOptions(new FakeViewConfig({ dimensions: 'novelty', 'dimLabel.novelty': 'Novelty' }));
		expect(groupNames(options)).toContain('Novelty');
	});

	it("keeps the SHIPPED label in the Label box's own default and placeholder", () => {
		// The half a careless fix breaks. `dimensionGroup`'s rule is that a box's `default` and
		// `placeholder` are the SHIPPED value and never the CURRENT one, or a dimension already
		// overridden shows its override as though nothing had been chosen. A group HEADING is not
		// a candidate value — it names which dimension the boxes belong to — so only the heading
		// moves to the resolved label.
		const item = labelItem(getEstimationViewOptions(new FakeViewConfig({ 'dimLabel.reach': 'Blast radius' })), 'reach');
		expect(item.default).toBe('Reach');
		expect(item.placeholder).toBe('Reach');
	});

	it('names the weight rule at the box that produces the mistake', () => {
		// The refusal stays (extension 3b, register-backed). What changes is that the rule is
		// legible before the mistake is made rather than only after.
		const item = weightItem(getEstimationViewOptions(new FakeViewConfig({})), 'reach');
		expect(item.displayName).toBe('Weight (% of 100)');
	});
});
