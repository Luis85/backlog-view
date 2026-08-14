import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings';
import { settingsFrom, settingsWith } from '../helpers/settings';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { settingsInconsistency } from '../../src/domain/settingsConsistency';
import { FakeViewConfig } from '../helpers/vault';

/**
 * Whether a `BacklogSettings` is one `resolveSettings` could have produced — the predicate,
 * the assertion `buildModel` makes with it, and the two test constructors that have to
 * agree with it. Split out of `settings.test.ts` when that file hit its budget: this is a
 * subject of its own (what a FIXTURE may be) rather than one more resolver option.
 *
 * See `docs/issues/A hand-built fixture can model a state the producer cannot produce.md`.
 */

/** Stand-in for BasesViewConfig backed by a plain object. */
function fakeConfig(values: Record<string, unknown> = {}) {
	return new FakeViewConfig(values) as never;
}

describe('settingsInconsistency, and what the only producer guarantees', () => {
	/**
	 * The claim `assertResolvedSettings` rests on: in production `resolveSettings` is the
	 * only producer, so the throw is unreachable. Checked across a spread of configurations
	 * rather than left as an argument — the whole point of the assertion is that it can
	 * only ever fire on a hand-built fixture.
	 *
	 * These are the option shapes the relationships are actually about: a key with no list,
	 * a list with no key, a shared key, an overridden list under a falling-back key, a tags
	 * property aimed at each of the four that outrank it, and nothing at all.
	 */
	const CONFIGS: Record<string, unknown>[] = [
		{},
		{ stateProperty: 'note.status' },
		{ stateProperty: 'note.status', stateValues: 'New, Active, Done', doneValues: 'Done' },
		{ stateValues: 'New, Done' },
		{ deliverableStateProperty: 'note.docStatus' },
		{ deliverableStateProperty: 'note.docStatus', deliverableStateValues: 'Draft, Published' },
		{ stateProperty: 'note.status', stateValues: 'New, Done', deliverableStateValues: 'Draft, Published' },
		{ stateProperty: 'note.status', deliverableStateProperty: 'note.status' },
		{ stateProperty: 'note.status', doneValues: '' },
		{ deliverableDoneValues: '' },
		{ tagsProperty: 'note.parent' },
		{ tagsProperty: 'note.order' },
		{ tagsProperty: 'note.type' },
		{ tagsProperty: 'note.status', stateProperty: 'note.status' },
	];

	it.each(CONFIGS)('resolveSettings emits a consistent object for %o', (options) => {
		expect(settingsInconsistency(resolveSettings(fakeConfig(options) as never))).toBeNull();
	});

	it('names each relationship it can see broken, so the message points at the fixture', () => {
		// The other direction: the predicate is only worth having if it actually rejects.
		// Hand-built on purpose — this is the one place a literal is the subject.
		const base = defaultSettings();
		expect(settingsInconsistency({ ...base, doneValues: [] })).toContain('doneValues');
		expect(settingsInconsistency({ ...base, deliverableDoneValues: [] })).toContain('deliverableDoneValues');
		// The one that bit: a populated requirements list beside an empty Deliverable one
		// under a falling-back key — the resolver would have copied `states` across.
		expect(settingsInconsistency({ ...base, stateKey: 'status', states: ['New'] })).toContain('deliverableStates');
		expect(settingsInconsistency({ ...base, tagsKey: 'parent' })).toContain('tagsKey');
		// The roster is a resolver-produced list like the vocabularies beside it: it goes
		// through `list()` and `dedupe()`, so a fixture holding what those would have
		// changed is a fixture the producer could not have emitted.
		expect(settingsInconsistency({ ...base, resourceNames: [' Alice'] })).toContain('resourceNames');
		expect(settingsInconsistency({ ...base, resourceNames: ['Alice', 'alice'] })).toContain('resourceNames');
	});

	it('rejects a per-state map the resolver would have emptied, key or value', () => {
		// The maps are `nameTable` over the configured states, so a key naming a state the
		// workflow does not have is one the resolver would have dropped — and so is a value
		// it refuses. Raised in review as half a job: a key rule that ignores the value
		// beside it reads as covering both.
		const workflow = settingsWith({ states: ['Active', 'Done'], doneValues: ['Done'] });
		expect(settingsInconsistency({ ...workflow, wipLimits: { draft: 2 } })).toContain('wipLimits names draft');
		// A limit on a DONE state is the same defect through the other door: WIP is what
		// sits between started and finished, so `limitedStates` excludes them.
		expect(settingsInconsistency({ ...workflow, wipLimits: { done: 2 } })).toContain('wipLimits names done');
		expect(settingsInconsistency({ ...workflow, wipLimits: { active: 0 } })).toContain('parseWipLimit would discard');
		expect(settingsInconsistency({ ...workflow, wipLimits: { active: 1.5 } })).toContain('parseWipLimit would discard');
		expect(settingsInconsistency({ ...workflow, columnPolicies: { active: '  ' } })).toContain('trim or drop');
		// Surrounding whitespace is as unproducible as an empty string: the resolver stores
		// `str(...).trim()`, so a policy is kept trimmed or not at all.
		expect(settingsInconsistency({ ...workflow, columnPolicies: { active: ' ship it ' } })).toContain('trim or drop');
		expect(settingsInconsistency({ ...workflow, columnPolicies: { draft: 'x' } })).toContain('columnPolicies names draft');
		// And the reachable configuration is still accepted, so this cannot become
		// "rejects every map".
		expect(settingsInconsistency({ ...workflow, wipLimits: { active: 3 }, columnPolicies: { done: 'ship it' } })).toBeNull();
	});

	it('rejects a colour map the resolver would have emptied, key or value', () => {
		// The third per-state map, and the one whose VALUE is painted directly: a fixture
		// holding a colour the resolver would have dropped asserts a colour no picker could
		// produce. Raised in review on the change that added the map, which is the same
		// half-a-job shape the two maps above already record twice.
		const workflow = settingsWith({ states: ['Active', 'Done'], doneValues: ['Done'] });
		expect(settingsInconsistency({ ...workflow, stateColors: { draft: '#ff0000' } })).toContain('stateColors names draft');
		// Shorthand, a capital and surrounding space are all unproducible: the resolver
		// stores exactly what `stateColor` returns, lowercased and in one of its two shapes.
		expect(settingsInconsistency({ ...workflow, stateColors: { active: '#abc' } })).toContain('would discard');
		expect(settingsInconsistency({ ...workflow, stateColors: { active: '#FF0000' } })).toContain('would discard');
		expect(settingsInconsistency({ ...workflow, stateColors: { active: ' red' } })).toContain('would discard');
		expect(settingsInconsistency({ ...workflow, stateColors: { active: 'rebeccapurple' } })).toContain('would discard');
		// Unlike the two maps above, a DONE state may be coloured — the choice is simply
		// inert — and so may a Deliverable state, since this map spans both vocabularies.
		const both = settingsWith({ states: ['Active'], deliverableStates: ['Draft'], deliverableStateKey: 'ds' });
		// Both stored shapes are producible, and a done state may carry either — the dialog
		// offers the row and the intro says it does nothing.
		expect(settingsInconsistency({ ...workflow, stateColors: { done: '#00ff00' } })).toBeNull();
		expect(settingsInconsistency({ ...both, stateColors: { active: '#ff0000', draft: 'cyan' } })).toBeNull();
	});

	it('treats an emptied list as the resolver does — absent, not a rejection', () => {
		// Found by review: every list reaches the resolver through `list()`, which turns an
		// emptied option into `[]`, so it cannot tell "never set" from "cleared" either. A
		// caller writing `doneValues: []` is writing what an emptied option produces, and
		// the resolver's answer to that is the default. `settingsWith` derives it now
		// rather than refusing a configuration a user can actually set.
		expect(settingsWith({ doneValues: [] })).toEqual(settingsFrom({ doneValues: '' }));
		expect(settingsWith({ deliverableDoneValues: [] })).toEqual(settingsFrom({ deliverableDoneValues: '' }));
		expect(settingsWith({ stateKey: 'status', states: ['New'], deliverableStates: [] })).toEqual(
			settingsFrom({ stateProperty: 'note.status', stateValues: 'New', deliverableStateValues: '' }),
		);
		// With a key of its own the Deliverable done list takes its OWN default rather than
		// following the requirements one — a different branch of the same rule.
		expect(settingsWith({ deliverableStateKey: 'docStatus', deliverableDoneValues: [] })).toEqual(
			settingsFrom({ deliverableStateProperty: 'note.docStatus', deliverableDoneValues: '' }),
		);
	});

	it('rejects a vocabulary the resolver would have deduplicated, and only a vocabulary', () => {
		// Raised in review with the consequence named: `states: ['Active', 'active']` gives
		// the board two configured columns for one state, which no user can reach —
		// `resolveSettings` applies `dedupe(list(...))` case-insensitively.
		const base = defaultSettings();
		expect(
			settingsInconsistency({
				...base,
				states: ['Active', 'active'],
				deliverableStates: ['Active', 'active'],
				testStates: ['Active', 'active'],
			}),
		).toContain('states repeats');
		expect(settingsInconsistency({ ...base, horizonValues: ['Now', 'NOW'] })).toContain('horizonValues repeats');
		expect(settingsInconsistency({ ...base, startedStates: ['A', 'a'] })).toContain('startedStates repeats');
		// The two DONE lists are deliberately exempt: they take `list()` without `dedupe()`,
		// so a repeat there is a configuration a user can actually set, and rejecting it
		// would refuse a real vault. This is the half of the rule that keeps it honest.
		expect(settingsInconsistency({ ...base, doneValues: ['Done', 'done'] })).toBeNull();
		expect(settingsInconsistency({ ...base, deliverableDoneValues: ['Done', 'done'] })).toBeNull();
		// TRIMMING is the wider rule and covers all six, done lists included: every list
		// reaches the resolver through `list()`, which trims and drops empties. Checking the
		// narrower set against the wider rule is the mistake this predicate kept making, so
		// the two spans are asserted apart.
		// `deliverableStates`/`testStates` set alongside, or the copy rule above fires first
		// and this asserts the wrong message — the predicate returns the FIRST broken
		// relationship.
		expect(
			settingsInconsistency({ ...base, states: [' Active '], deliverableStates: [' Active '], testStates: [' Active '] }),
		).toContain('states holds');
		expect(settingsInconsistency({ ...base, doneValues: ['Done ', 'Closed'] })).toContain('doneValues holds');
		expect(settingsInconsistency({ ...base, horizonValues: ['Now', ''] })).toContain('horizonValues holds');
	});

	it('accepts what the resolver would have produced for that same fixture', () => {
		// The pair to the case above, so "rejects" cannot quietly become "rejects everything".
		const base = defaultSettings();
		expect(
			settingsInconsistency({ ...base, stateKey: 'status', states: ['New'], deliverableStates: ['New'], testStates: ['New'] }),
		).toBeNull();
		expect(settingsInconsistency(base)).toBeNull();
	});
});

describe('settingsWith reproduces what the resolver would have derived', () => {
	/**
	 * The drift detector for `test/helpers/settings.ts`. `settingsWith` applies the
	 * resolver's relationships by hand, so it can fall behind the resolver — and the way
	 * that shows up is a fixture quietly missing a derivation rather than anything failing.
	 *
	 * Each case names the fields a caller would set and the OPTIONS that produce the same
	 * base, and asserts the two constructors agree in full. A derivation the resolver has
	 * and the helper lacks makes the pair disagree.
	 *
	 * What this does NOT do, since the gap is worth stating rather than papering over:
	 * nothing forces a NEW relationship to be added to this table. It catches drift for
	 * the relationships listed, which is what a hand-written pair table can do.
	 */
	const PAIRS: { name: string; fields: Partial<BacklogSettings>; options: Record<string, unknown> }[] = [
		{ name: 'nothing configured', fields: {}, options: {} },
		{
			name: 'a workflow, so the Deliverable lists follow it',
			fields: { stateKey: 'status', states: ['New', 'Active', 'Done'], doneValues: ['Done'] },
			options: { stateProperty: 'note.status', stateValues: 'New, Active, Done', doneValues: 'Done' },
		},
		{
			name: 'a states list with no property, which still copies across',
			fields: { states: ['New', 'Done'] },
			options: { stateValues: 'New, Done' },
		},
		{
			name: 'a Deliverable workflow of its own, so nothing is copied',
			fields: {
				stateKey: 'status',
				states: ['New', 'Done'],
				deliverableStateKey: 'docStatus',
				deliverableStates: ['Draft', 'Published'],
				deliverableDoneValues: ['Published'],
			},
			options: {
				stateProperty: 'note.status',
				stateValues: 'New, Done',
				deliverableStateProperty: 'note.docStatus',
				deliverableStateValues: 'Draft, Published',
				deliverableDoneValues: 'Published',
			},
		},
		{
			name: 'a tags property aimed at the state key, which yields',
			fields: { stateKey: 'status', tagsKey: 'status' },
			options: { stateProperty: 'note.status', tagsProperty: 'note.status' },
		},
		{
			name: 'a test workflow of its own, so nothing is copied',
			fields: { testStateKey: 'testStatus', testDoneValues: [] },
			options: { testStateProperty: 'note.testStatus', testDoneValues: '' },
		},
	];

	it.each(PAIRS)('$name', ({ fields, options }) => {
		expect(settingsWith(fields)).toEqual(settingsFrom(options));
	});
});
