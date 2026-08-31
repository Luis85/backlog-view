import { afterEach, describe, expect, it } from 'vitest';
import type { BasesAllOptions, BasesViewConfig } from 'obsidian';
import { Catalog, setLocale } from '../../src/i18n/t';
import { getViewOptions } from '../../src/domain/viewOptions';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { defaultResourceFolder, defaultTypeFolder } from '../../src/domain/typeVocabulary';
import { FakeViewConfig } from '../helpers/vault';
import { MARK, markedCatalog } from '../i18n/fixtures';


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
		// Not a `typeFolder.*` key — `Resource` is never in `ALL_TYPES` — but it tracks
		// the same resolved home folder every type folder does.
		expect(shown('resourceFolder').default).toBe('Roadmap/resources');
		expect(shown('resourceFolder').default).toBe(defaultResourceFolder('Roadmap'));
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
		expect(flat.map((o) => o.key)).toEqual(expect.arrayContaining(['stateValues', 'tagsProperty']));
		// The property column width is NOT one of them any more: it is a per-column pick a
		// reader drags, stored per device in the view-state store (ADR 0011), and a value
		// is one or the other rather than an option with a stored override beside it.
		expect(flat.map((o) => o.key)).not.toContain('propertyColumnWidth');
		// Nor is the completed-items eye, since 2026-08-30, under that same rule: it is the
		// toolbar's toggle and the view-state store's, never a shared default.
		expect(flat.map((o) => o.key)).not.toContain('showCompleted');
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

	it('exposes a Release group with the membership property and the roadmap’s own date key', () => {
		const groups = getViewOptions(fakeConfig());
		const group = groups.find((g) => 'displayName' in g && g.displayName === 'Release');
		if (!group || !('items' in group)) throw new Error('Release group missing');
		expect(group.items.map((item) => item.key)).toEqual(['releaseProperty', 'releaseDateProperty']);
		const property = group.items[0] as { placeholder?: string; type: string };
		expect(property.type).toBe('property');
		// The suggested key `resolveSettings` adopts on backfill, the way every other
		// optional property's placeholder is its own suggestion.
		expect(property.placeholder).toBe('release');
	});

	it('ships a real default for the release date property, unlike every optional one', () => {
		// The three model mappings' shape, not `PROPERTY_TABLE`'s: this key is READ and never
		// written, so it is not an optional write target at all — and a marker overlay nobody
		// configured is a feature nobody finds ([[A release on the dated axis]]). `target-date`
		// is the same key the release view suggests for the same date, which is sharing a
		// suggestion rather than sharing a setting: neither view reads the other's config.
		const groups = getViewOptions(fakeConfig());
		const group = groups.find((g) => 'displayName' in g && g.displayName === 'Release');
		if (!group || !('items' in group)) throw new Error('Release group missing');
		const dateOption = group.items[1] as { default?: string; placeholder?: string; type: string };
		expect(dateOption.type).toBe('property');
		expect(dateOption.default).toBe('note.target-date');
		expect(dateOption.placeholder).toBe('target-date');
	});

	it('exposes an Iterations group with the two properties and the four board options', () => {
		// No state PROPERTY here — the iteration board reads the product state key and
		// narrows it, so there is no second one to configure. Three of the four that ARE
		// here say how it narrows: which product states fall in the two outer columns, and
		// how long a derived iteration runs. The fourth, `iterationBars`, is the roadmap's
		// own reading rather than the board's — whether an iteration draws as a point or a
		// span — and it sits in this group anyway because the property it narrows
		// (`iteration`) is declared here. The goal is a property of a different kind again:
		// what the iteration is FOR, not how it moves.
		const groups = getViewOptions(fakeConfig());
		const group = groups.find((g) => 'displayName' in g && g.displayName === 'Iterations');
		if (!group || !('items' in group)) throw new Error('Iterations group missing');
		const keys = group.items.map((item) => item.key);
		expect(keys).toEqual([
			'iterationProperty',
			'iterationGoalProperty',
			'iterationOpenStates',
			'iterationResolvedStates',
			'iterationLengthDays',
			'iterationsOnTimeline',
			'iterationBars',
		]);
	});

	it('withholds the bar reading while iterations are off the timeline, and keeps the stored value', () => {
		// `iterationBars` chooses between two readings of an iteration on the grid, so with
		// nothing drawn there is no reading to choose — the toggle would be a control that
		// obeys nothing. The stored value survives being unoffered: `resolveSettings` reads
		// the key from the `.base` either way, so turning the timeline back on restores the
		// reading rather than resetting it to lines.
		const off = fakeConfig({ iterationsOnTimeline: false, iterationBars: true });
		const group = getViewOptions(off).find((g) => 'displayName' in g && g.displayName === 'Iterations');
		if (!group || !('items' in group)) throw new Error('Iterations group missing');
		expect(group.items.map((item) => item.key)).not.toContain('iterationBars');
		expect(resolveSettings(off).iterationBars).toBe(true);
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


/**
 * Every key this schema declares, frozen. Not a sample and not `arrayContaining`: the
 * checks above name the keys a feature cares about, and this one is the alarm for the
 * key nobody was looking at — a `.base` file holds these verbatim, so a rename is a
 * silent reset of that option for every vault that set it.
 *
 * Ordered, because the order is what the menu draws in. A key that moves group is a
 * change worth stating out loud even though nothing persisted breaks.
 */
const KEYS = [
	'parentProperty',
	'orderProperty',
	'typeProperty',
	'hierarchyOnly',
	'showOutsideParents',
	'inferFolderHierarchy',
	'stateProperty',
	'stateValues',
	'doneValues',
	'startedStates',
	'startedDateProperty',
	'finishedDateProperty',
	'assigneeProperty',
	'deliverableStateProperty',
	'deliverableStateValues',
	'deliverableDoneValues',
	'iterationProperty',
	'iterationGoalProperty',
	'iterationOpenStates',
	'iterationResolvedStates',
	'iterationLengthDays',
	'iterationsOnTimeline',
	'iterationBars',
	'releaseProperty',
	'releaseDateProperty',
	'testStateProperty',
	'testStateValues',
	'testDoneValues',
	'horizonProperty',
	'horizonValues',
	'startProperty',
	'targetProperty',
	'dependsOnProperty',
	'riskProperty',
	'riskValues',
	'priorityProperty',
	'priorityValues',
	'homeFolder',
	'typeFolder.epic',
	'typeFolder.feature',
	'typeFolder.pbi',
	'typeFolder.task',
	'typeFolder.issue',
	'typeFolder.bug',
	'typeFolder.idea',
	'typeFolder.deliverable',
	'typeFolder.improvement',
	'typeFolder.milestone',
	'typeFolder.iteration',
	// No `typeFolder.release`, and the gap is the assertion: the release view carries its
	// own `releaseFolder` option (2026-08-24), so a box here would be a second value naming
	// the same folder with nothing reading it. `typeFolder.iteration` stays right above it
	// for the contrast — no surface offers that type either, but the board's scope picker
	// still files the note it makes by this option.
	'typeFolder.test suite',
	'typeFolder.test case',
	'typeFolder.absence',
	'resourceFolder',
	'openIn',
	'tagsProperty',
	'showCounts',
];

const flatten = (options: BasesAllOptions[]) => options.flatMap((o) => ('items' in o ? o.items : [o]));

describe('the persisted key set', () => {
	it('is exactly this, and every type folder is derived from the canonical name', () => {
		expect(flatten(getViewOptions(fakeConfig())).map((o) => o.key)).toEqual(KEYS);
	});

	it('adds only the two generated per-state keys when a workflow is configured', () => {
		const keys = flatten(getViewOptions(fakeConfig({ stateValues: 'New, Done', doneValues: 'Done' }))).map((o) => o.key);
		expect(keys.filter((key) => !KEYS.includes(key))).toEqual(['wipLimit.new', 'columnPolicy.new', 'columnPolicy.done']);
	});
});

/**
 * The other half of the same file's subject: what a `.base` reads back is data and must
 * not move, and everything a reader SEES is text and must come from the catalog. They sit
 * on adjacent lines of one object literal, which is the arrangement in which a sweep makes
 * a mistake, so both directions are asked of the same function.
 *
 * The whole catalog goes behind a marker and the assertion is on the REMAINDER — the
 * `projections.test.ts` construction, for its reason: a list of the labels somebody
 * remembered checks the labels that already work. What is left unmarked here has to be
 * exactly the data, so a literal spelled at a new option fails without anyone naming it,
 * and a key given to a value the resolver reads back fails too.
 */
const xx: Catalog = markedCatalog();

/**
 * Every word the menu shows: a group's name, an option's name, its placeholder, and the
 * LABELS a dropdown offers.
 *
 * That last one was missing and hid a whole control. `openIn`'s heading was keyed while its
 * three choices stayed English, and this collector read only `displayName` and
 * `placeholder`, so the remainder came back clean over a dropdown that was half translated.
 * A collector that skips a field cannot be corrected by adding cases to the assertion — it
 * has to read everything a person can see, or it speaks for less than it claims to.
 *
 * The dropdown's KEYS are deliberately not collected: they are what a `.base` stores and
 * what `resolveItemHandling` matches, so they are data and belong unmarked.
 */
function shown(options: BasesAllOptions[]): string[] {
	const words: string[] = [];
	for (const option of options) {
		if (option.displayName !== undefined) words.push(option.displayName);
		if ('items' in option) {
			for (const item of option.items) {
				if (item.displayName !== undefined) words.push(item.displayName);
				if ('placeholder' in item && item.placeholder !== undefined) words.push(item.placeholder);
				const choices = (item as { options?: Record<string, string> }).options;
				if (choices) words.push(...Object.values(choices));
			}
		}
	}
	return [...new Set(words)].sort();
}

const unmarked = (options: BasesAllOptions[]): string[] => shown(options).filter((word) => !word.startsWith(MARK));

describe('the options menu reads its words from the catalog', () => {
	afterEach(() => setLocale('en'));

	it('leaves unmarked only the keys a picker suggests and the defaults a box mirrors', () => {
		setLocale('xx', { xx });
		// A configured workflow, so the two generated boxes are drawn and their state — the
		// user's own word — is checked to arrive as a parameter rather than as prose.
		expect(unmarked(getViewOptions(fakeConfig({ stateValues: 'New, Done', doneValues: 'Done' })))).toEqual([
			// The frontmatter keys a property picker suggests: what the backfill would adopt
			// and write, so a locale that changed one would set up a different property.
			'assignee',
			'dependsOn',
			// The home folder, which is the type folders' placeholder when one is configured:
			// the user's own path, and the branch beside the catalog's fallback below.
			'docs',
			'due',
			'finished',
			'goal',
			'horizon',
			// `doneValues` and its two mirrors, whose placeholder IS the default they fall
			// back to when the box is cleared.
			'Done, Closed, Completed, Removed',
			'iteration',
			// `horizonValues`, `riskValues` and `priorityValues`, mirrors of their own
			// defaults too — the words belong to the reader, so the box shows what parsing
			// them gives back.
			'1 - High, 2 - Normal, 3 - Low',
			"1 - Must, 2 - Should, 3 - Could, 4 - Won't",
			'Now, Next, Later',
			'order',
			'parent',
			'priority',
			'release',
			'risk',
			'start',
			'started',
			'status',
			'tags',
			// The roadmap's own release-date key — its placeholder AND its default, since it is
			// the one property option here that ships a real one (see the Release group above).
			'target-date',
			'type',
			// `iterationLengthDays`, the shipped default rendered as the number it is.
			'14',
		].sort());
	});

	it('draws the type-folder placeholder from the catalog when no home folder is set', () => {
		setLocale('xx', { xx });
		// The one placeholder that LOOKS like a mirrored default and is not: nothing reads it
		// back — `resolveFolders` falls to `defaultTypeFolder` — so the fallback half is
		// plain UI text. With a home folder set it is the user's own path (above); with none
		// it is this word, and a fixture reaching one branch would leave the other free.
		const folders = flatten(getViewOptions(fakeConfig({ homeFolder: '' }))).filter((o) => o.key.startsWith('typeFolder.'));
		expect(folders.length).toBeGreaterThan(0);
		expect([...new Set(folders.map((o) => ('placeholder' in o ? o.placeholder : undefined)))]).toEqual([MARK + 'Home folder']);
	});

	it('names a generated box after the state it is for, as a parameter', () => {
		setLocale('xx', { xx });
		const flat = flatten(getViewOptions(fakeConfig({ stateValues: 'In review', doneValues: 'Done' })));
		expect(flat.find((o) => o.key === 'wipLimit.in review')?.displayName).toBe(MARK + 'WIP limit for In review');
		expect(flat.find((o) => o.key === 'columnPolicy.in review')?.displayName).toBe(MARK + 'Policy for In review');
	});
});
