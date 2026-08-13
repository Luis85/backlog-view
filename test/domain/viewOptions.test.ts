import { describe, expect, it } from 'vitest';
import { BasesViewConfig } from 'obsidian';
import { getViewOptions } from '../../src/domain/viewOptions';
import { defaultTypeFolder } from '../../src/domain/typeVocabulary';
import { FakeViewConfig } from '../helpers/vault';


/**
 * The schema is persisted user data: every `key` here is written into a `.base`
 * file and read back by `resolveSettings`, so these tests are a rename alarm as
 * much as a coverage exercise.
 */
/** Stand-in for BasesViewConfig backed by a plain object. */
function fakeConfig(values: Record<string, unknown> = {}) {
	return { get: (key: string) => values[key], getAsPropertyId: () => null } as never;
}

describe('getViewOptions', () => {
	it('shows each type folder default under THIS view home folder', () => {
		const flat = getViewOptions(fakeConfig({ homeFolder: 'Roadmap' })).flatMap((o) =>
			'items' in o ? o.items : [o],
		);
		const shown = (key: string) => flat.find((o) => o.key === key) as { default?: string };
		// The box must advertise what creation will actually do, or restoring the shown
		// default silently moves the type back to the shipped layout.
		expect(shown('typeFolder.epic').default).toBe('Roadmap/requirements');
		expect(shown('typeFolder.bug').default).toBe('Roadmap/bugs');
		expect(shown('typeFolder.epic').default).toBe(defaultTypeFolder('Epic', 'Roadmap'));
	});

	it('declares every config key the view reads', () => {
		const flat = getViewOptions(fakeConfig()).flatMap((o) => ('items' in o ? o.items : [o]));
		const keys = flat.map((o) => o.key);
		expect(keys).toEqual(
			expect.arrayContaining([
				'parentProperty',
				'orderProperty',
				'typeProperty',
				'hierarchyOnly',
				'inferFolderHierarchy',
				'stateProperty',
				'doneValues',
				'homeFolder',
				'showCounts',
			]),
		);
	});

	it('leaves the focus level to the view toolbar', () => {
		const flat = getViewOptions(fakeConfig()).flatMap((o) => ('items' in o ? o.items : [o]));
		expect(flat.some((o) => o.key === 'focusLevel')).toBe(false);
	});

	it('declares a folder option per type, not one mapping to typo', () => {
		const flat = getViewOptions(fakeConfig()).flatMap((o) => ('items' in o ? o.items : [o]));
		const keys = flat.map((o) => o.key);
		// The vocabulary is fixed, so the schema is static and names every type it has.
		expect(keys).toEqual(
			expect.arrayContaining([
				'typeFolder.epic',
				'typeFolder.feature',
				'typeFolder.pbi',
				'typeFolder.task',
				'typeFolder.issue',
				'typeFolder.bug',
			]),
		);
		// And no option offers the vocabulary itself for editing.
		expect(keys).not.toContain('levels');
		expect(keys).not.toContain('extraTypes');
	});
	it('declares the progress and display option keys', () => {
		const flat = getViewOptions(fakeConfig()).flatMap((o) => ('items' in o ? o.items : [o]));
		expect(flat.map((o) => o.key)).toEqual(
			expect.arrayContaining(['stateValues', 'showCompleted', 'tagsProperty', 'propertyColumnWidth']),
		);
	});

	it('declares the roadmap axis: properties to name, values prefilled, nothing detected', () => {
		const flat = getViewOptions(fakeConfig()).flatMap((o) => ('items' in o ? o.items : [o]));
		expect(flat.map((o) => o.key)).toEqual(
			expect.arrayContaining(['horizonProperty', 'horizonValues', 'startProperty', 'targetProperty']),
		);
		// The canonical triple ships as an editable default, not a fixed list.
		const values = flat.find((o) => o.key === 'horizonValues') as { default?: string };
		expect(values.default).toBe('Now, Next, Later');
		// The date pickers suggest the ecosystem's names without assuming them: no
		// default value, only placeholders — nothing is picked by name-matching.
		const start = flat.find((o) => o.key === 'startProperty') as { default?: string; placeholder?: string };
		const target = flat.find((o) => o.key === 'targetProperty') as { default?: string; placeholder?: string };
		expect(start.default).toBeUndefined();
		expect(target.default).toBeUndefined();
		expect(start.placeholder).toBe('start');
		expect(target.placeholder).toBe('due');
	});

	it('offers the resource roster beside the axis, with nothing prefilled', () => {
		const flat = getViewOptions(fakeConfig()).flatMap((o) => ('items' in o ? o.items : [o]));
		const roster = flat.find((o) => o.key === 'resourceNames') as { default?: string };
		expect(roster).toBeDefined();
		// Unlike the horizons above: nobody declares who exists, so there is no canonical
		// list to ship and an empty box is the configured state rather than a cleared one.
		expect(roster.default).toBeUndefined();
	});

	it('limits the property pickers to note properties', () => {
		const flat = getViewOptions(fakeConfig()).flatMap((o) => ('items' in o ? o.items : [o]));
		const parent = flat.find((o) => o.key === 'parentProperty') as {
			filter: (prop: string) => boolean;
		};
		expect(parent.filter('note.parent')).toBe(true);
		expect(parent.filter('file.name')).toBe(false);
		expect(parent.filter('formula.x')).toBe(false);
	});

	it('generates a limit and a policy box per configured state', () => {
		const flat = getViewOptions(fakeConfig({ stateValues: 'New, In review, Done', doneValues: 'Done' })).flatMap(
			(o) => ('items' in o ? o.items : [o]),
		);
		const keys = flat.map((o) => o.key);
		expect(keys).toContain('wipLimit.new');
		expect(keys).toContain('wipLimit.in review');
		expect(keys).toContain('columnPolicy.new');
		expect(keys).toContain('columnPolicy.done');
		// A done column has no limit to set, so it is not offered one.
		expect(keys).not.toContain('wipLimit.done');
	});

	it('exposes a Deliverables group with its own state property, states and done values', () => {
		const groups = getViewOptions(fakeConfig());
		const group = groups.find((g) => 'displayName' in g && g.displayName === 'Deliverables');
		if (!group || !('items' in group)) throw new Error('Deliverables group missing');
		const keys = group.items.map((item) => item.key);
		expect(keys).toEqual(['deliverableStateProperty', 'deliverableStateValues', 'deliverableDoneValues']);
	});

	it('exposes a Test management group with its own state property, states and done values', () => {
		const groups = getViewOptions(fakeConfig());
		const group = groups.find((g) => 'displayName' in g && g.displayName === 'Test management');
		if (!group || !('items' in group)) throw new Error('Test management group missing');
		const keys = group.items.map((item) => item.key);
		expect(keys).toEqual(['testStateProperty', 'testStateValues', 'testDoneValues']);
	});

	it('never keys a colour box to a state only the test workflow declares', () => {
		// Not an omission: `stateColors` is keyed by the state VALUE, so a test state spelled
		// like a requirements state shares that state's colour key already, and a test-ONLY
		// state is in no palette at all (`statePalettes` builds only Work and Deliverables) —
		// a box for it would key a colour nothing ever paints.
		//
		// Scoped to the WHOLE schema, not to the Test management group alone:
		// `testManagementGroup()` takes no config, so a check confined to its own items could
		// never fail — a `stateColor.draft` box added to Progress or Deliverables instead
		// would pass it. Verified by experiment: adding `stateColorOption('Draft')` to
		// `progressGroup`'s items fails this exact assertion.
		const config = new FakeViewConfig({
			stateValues: 'New, Active, Done',
			deliverableStateValues: 'Concept, Review, Published',
			testStateValues: 'Draft, Ready, Approved',
		}) as unknown as BasesViewConfig;
		const keys = getViewOptions(config)
			.flatMap((g) => ('items' in g ? g.items : [g]))
			.map((i) => i.key);
		expect(keys.filter((k) => k === 'stateColor.draft' || k === 'stateColor.ready' || k === 'stateColor.approved')).toEqual([]);
	});

	it('offers neither until a workflow is stated', () => {
		// With no `stateValues` the board falls back to observed values, which are not a
		// workflow anyone agreed. Limits and policies are agreements; there is nothing
		// to attach them to, so the Progress group is unchanged.
		const keys = getViewOptions(fakeConfig())
			.flatMap((o) => ('items' in o ? o.items : [o]))
			.map((o) => o.key);
		expect(keys.filter((k) => k.startsWith('wipLimit.') || k.startsWith('columnPolicy.'))).toEqual([]);
	});
});
