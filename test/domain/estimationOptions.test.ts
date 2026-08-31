import { afterEach, describe, expect, it } from 'vitest';
import { Catalog, setLocale } from '../../src/i18n/t';
import { getEstimationViewOptions } from '../../src/domain/estimationOptions';
import { dimOption } from '../../src/domain/estimationSettings';
import { DEFAULT_DIMENSIONS } from '../../src/domain/defaultModel';
import { FakeViewConfig } from '../helpers/vault';
import { MARK, markedCatalog } from '../i18n/fixtures';

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

/**
 * The other half of the same file's subject, `viewOptions.test.ts`'s construction over this
 * view's own menu: what a `.base` reads back is data and must not move, and everything a
 * reader SEES is text and comes from the catalog. They sit on adjacent lines of one object
 * literal, which is the arrangement in which a sweep makes a mistake.
 *
 * The whole catalog goes behind a marker and the assertion is on the REMAINDER, so a
 * literal spelled at a new option fails without anyone naming it, and a key given to a
 * value the resolver reads back fails too. The expected remainder is DERIVED from
 * `DEFAULT_DIMENSIONS` rather than spelled out — the shipped model is the one source both
 * the boxes and this list read, so adding a ninth dimension does not edit this test, and
 * keying one of its words still fails it.
 */
const xx: Catalog = markedCatalog();

/** Every word the menu shows: a group's heading, an option's name, and its placeholder. */
function shown(options: ReturnType<typeof getEstimationViewOptions>): string[] {
	const words: string[] = [];
	for (const option of options) {
		if (option.displayName !== undefined) words.push(option.displayName);
		if (!('items' in option)) continue;
		for (const item of option.items) {
			if (item.displayName !== undefined) words.push(item.displayName);
			if ('placeholder' in item && item.placeholder !== undefined) words.push(item.placeholder);
		}
	}
	return [...new Set(words)].sort();
}

describe("the estimation view's options menu reads its words from the catalog", () => {
	afterEach(() => setLocale('en'));

	it('leaves unmarked only the keys a picker suggests and the shipped model a box mirrors', () => {
		setLocale('xx', { xx });
		const unmarked = shown(getEstimationViewOptions(new FakeViewConfig({}))).filter((word) => !word.startsWith(MARK));

		expect(unmarked).toEqual(
			[
				// The frontmatter keys the fixed pickers suggest — what the backfill adopts
				// and writes, so a locale that changed one would set up a different property.
				// `type` is the newest of them: the property this view reads a note's TYPE
				// from, so that it can refuse a `Resource`. Its own placeholder is a
				// frontmatter key like the rest and stays out of the catalog; its
				// displayName is ordinary text and goes through it.
				'type',
				'business-value',
				'business-value-model',
				'complexity',
				'confidence',
				'effort',
				// The fifth picker, and the one that is not a scoring key: the property this
				// view reads a note's TYPE from, to refuse a `Resource`. Its suggestion is a
				// frontmatter key like the four above it — a locale that translated it would
				// read the type from a property no note carries and score people.
				'type',
				// The dimensions box mirrors its own default, so clearing it falls back to the
				// list on screen.
				DEFAULT_DIMENSIONS.map((d) => d.id).join(', '),
				// Both range boxes mirror the shipped pair the same way.
				'1-5',
				// Per dimension: the property its picker suggests (the id), the shipped weight,
				// and the shipped LABEL — the group's heading and the Label box's own default.
				// The label is a value the user may override in that box, so it is a shipped
				// default like `Now, Next, Later` rather than text.
				...DEFAULT_DIMENSIONS.flatMap((d) => [d.id, String(d.weight), d.label]),
				// The indicator's three boxes. `adjustedValue` and `effort` are OPERAND IDS
				// — this model's own vocabulary, mirrored from the shipped default the same
				// way the ranges are — and `RICE` is a preset NAME, which is what the Name
				// box holds and what a preset writes into the `.base`. A locale that
				// translated any of the three would configure an indicator that resolves to
				// nothing, or name one differently per language.
				'adjustedValue',
				'RICE',
			]
				.filter((word, i, all) => all.indexOf(word) === i)
				.sort(),
		);
	});
});
