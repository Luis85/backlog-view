import type { BasesViewConfig } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { FakeViewConfig } from '../helpers/vault';
import {
	DEFAULT_DONE_VALUES,
	DEFAULT_RELEASED_VALUES,
	defaultSettings,
	horizonMenuValues,
	stateMenuValues,
} from '../../src/domain/settings';
import { adoptableProperties, resolvedTestStateKey } from '../../src/domain/optionalProperties';
import { configProblems } from '../../src/domain/settingsConsistency';
import { en } from '../../src/i18n/en';
import { setLocale } from '../../src/i18n/t';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { ALL_TYPES, byName, defaultTypeFolder, EXTRA_TYPES, LEVELS, MARKER_TYPES, TEST_LEVELS } from '../../src/domain/typeVocabulary';

/** Stand-in for BasesViewConfig backed by a plain object. */
function fakeConfig(values: Record<string, unknown> = {}): FakeViewConfig {
	return new FakeViewConfig(values);
}

describe('resolveSettings', () => {
	it('falls back to defaults for an empty config', () => {
		expect(resolveSettings(fakeConfig())).toEqual(defaultSettings());
	});

	it('reads configured note properties, stripping the note. prefix', () => {
		const settings = resolveSettings(
			fakeConfig({
				parentProperty: 'note.up',
				orderProperty: 'note.rank',
				typeProperty: 'note.kind',
			}),
		);
		expect(settings.parentKey).toBe('up');
		expect(settings.orderKey).toBe('rank');
		expect(settings.typeKey).toBe('kind');
	});

	it('ignores non-note properties and keeps the default key', () => {
		const settings = resolveSettings(fakeConfig({ parentProperty: 'file.name' }));
		expect(settings.parentKey).toBe('parent');
	});

	it('reads toggles and normalizes the home folder', () => {
		const settings = resolveSettings(
			fakeConfig({
				showCounts: false,
				homeFolder: '/Backlog/Items/',
			}),
		);
		expect(settings.showCounts).toBe(false);
		expect(settings.homeFolder).toBe('Backlog/Items');
	});

	it('resolves a hand-edited folder to the spelling the vault uses', () => {
		// The `.base` file is text somebody may edit outside the options, and a Windows or
		// doubled separator survives that edit. `storage/` normalizes on the way to disk, so
		// a setting left raw here is a folder the generated README names and this plugin
		// never writes to — the document sending an outside editor somewhere else.
		const settings = resolveSettings(
			fakeConfig({ homeFolder: 'work\\backlog', 'typeFolder.bug': 'work//backlog//defects/' }),
		);
		expect(settings.homeFolder).toBe('work/backlog');
		expect(settings.typeFolders.bug).toBe('work/backlog/defects');
	});

	it('reads a folder of separators alone as no folder at all', () => {
		// `normalizePath` answers '/' for anything that normalizes away — the vault root
		// spelled as a folder that does not exist, which would be created as one.
		expect(resolveSettings(fakeConfig({ homeFolder: '\\\\' })).homeFolder).toBe('');
		expect(resolveSettings(fakeConfig({ homeFolder: '   ' })).homeFolder).toBe('');
	});

	it('scopes the view to the hierarchy unless the toggle is turned off', () => {
		expect(resolveSettings(fakeConfig()).hierarchyOnly).toBe(true);
		expect(resolveSettings(fakeConfig({ hierarchyOnly: false })).hierarchyOnly).toBe(false);
	});

	it('iterationsOnTimeline defaults on and resolves the toggle', () => {
		expect(resolveSettings(new FakeViewConfig({})).iterationsOnTimeline).toBe(true);
		expect(resolveSettings(new FakeViewConfig({ iterationsOnTimeline: false })).iterationsOnTimeline).toBe(false);
	});

	it('iterationBars defaults off and resolves the toggle', () => {
		expect(resolveSettings(new FakeViewConfig({})).iterationBars).toBe(false);
		expect(resolveSettings(new FakeViewConfig({ iterationBars: true })).iterationBars).toBe(true);
	});

	it('reads a WIP limit and a policy for each configured state', () => {
		const settings = resolveSettings(
			fakeConfig({
				stateValues: 'New, In review, Done',
				doneValues: 'Done',
				'wipLimit.in review': '3',
				'columnPolicy.in review': 'Reviewed by someone who did not write it',
			}),
		);
		expect(settings.wipLimits['in review']).toBe(3);
		expect(settings.columnPolicies['in review']).toBe('Reviewed by someone who did not write it');
	});

	it('refuses a limit on a done state, even one hand-written into the base', () => {
		// Extension 1b: WIP is what sits between started and finished, so a done
		// column has no limit — and the SETTINGS are where that is decided, not the
		// schema, or a key left behind by re-marking a state as done would revive it.
		const settings = resolveSettings(
			fakeConfig({ stateValues: 'New, Done', doneValues: 'Done', 'wipLimit.done': '2', 'columnPolicy.done': 'Nothing left to do' }),
		);
		expect(settings.wipLimits['done']).toBeUndefined();
		// A policy is not a limit: a done column can carry a working agreement.
		expect(settings.columnPolicies['done']).toBe('Nothing left to do');
	});

	it('refuses a limit on a state that is done by DEFAULT, with doneValues unset', () => {
		// The commonest configuration there is: nobody sets `doneValues`, so it falls
		// back to DEFAULT_DONE_VALUES — and a set built from the raw config value would
		// be empty and grant `Done` a limit the rest of the app says it cannot have.
		const settings = resolveSettings(fakeConfig({ stateValues: 'New, Done', 'wipLimit.done': '3' }));
		expect(settings.doneValues).toContain('Done');
		expect(settings.wipLimits['done']).toBeUndefined();
	});

	it('treats an unparseable limit as no limit, never as zero', () => {
		// A `.base` file is hand-editable, so every one of these can arrive. An unset
		// limit is NOT a limit of zero — extension 1a says so, and zero would put every
		// column permanently over.
		for (const raw of ['', '   ', '0', '-2', 'three', '2.5', 'NaN']) {
			const settings = resolveSettings(fakeConfig({ stateValues: 'New', 'wipLimit.new': raw }));
			expect(settings.wipLimits['new'], `limit from ${JSON.stringify(raw)}`).toBeUndefined();
		}
		expect(resolveSettings(fakeConfig({ stateValues: 'New', 'wipLimit.new': ' 4 ' })).wipLimits['new']).toBe(4);
	});

	it('keys a state named after something on Object.prototype without inheriting it', () => {
		// State values are user data. `table['constructor']` finds a function, and every
		// truthy guard downstream passes — the defect this project has now shipped three
		// times on three different tables.
		const settings = resolveSettings(fakeConfig({ stateValues: 'constructor, toString', 'wipLimit.constructor': '2' }));
		expect(settings.wipLimits['constructor']).toBe(2);
		expect(byName(settings.wipLimits, 'toString')).toBeUndefined();
		expect(byName(settings.columnPolicies, 'constructor')).toBeUndefined();
	});

	it('ignores a limit or policy for a state the workflow does not name', () => {
		const settings = resolveSettings(fakeConfig({ stateValues: 'New', 'wipLimit.archived': '1', 'columnPolicy.archived': 'gone' }));
		expect(settings.wipLimits['archived']).toBeUndefined();
		expect(settings.columnPolicies['archived']).toBeUndefined();
	});
});

describe('resolveSettings progress options', () => {
	it('parses done values and falls back to the defaults', () => {
		const custom = resolveSettings(fakeConfig({ stateProperty: 'note.status', doneValues: 'Shipped, Won’t do' }));
		expect(custom.stateKey).toBe('status');
		expect(custom.doneValues).toEqual(['Shipped', 'Won’t do']);

		const defaults = resolveSettings(fakeConfig());
		expect(defaults.stateKey).toBe('');
		expect(defaults.doneValues.length).toBeGreaterThan(0);
	});

	it('parses workflow states, dropping duplicates case-insensitively', () => {
		const settings = resolveSettings(fakeConfig({ stateValues: 'New, Active, active, Done' }));
		expect(settings.states).toEqual(['New', 'Active', 'Done']);
		expect(resolveSettings(fakeConfig()).states).toEqual([]);
	});

});

describe('configProblems', () => {
	it('reports properties sharing a frontmatter key', () => {
		expect(configProblems(defaultSettings())).toEqual([]);
		const clash = configProblems(settingsWith({ orderKey: 'parent' }));
		expect(clash).toHaveLength(1);
		expect(clash[0]).toContain('parent and order');
	});

	it('does not gate a view whose state property happens to be the tags key', () => {
		// The tags column gives way instead: it would render nowhere in this config,
		// so reporting a collision would only turn a working view read-only.
		const settings = resolveSettings(fakeConfig({ stateProperty: 'note.tags' }));
		expect(settings.stateKey).toBe('tags');
		expect(settings.tagsKey).toBe('');
		expect(configProblems(settings)).toEqual([]);
	});

	it('refuses an axis key colliding with a key the plugin owns', () => {
		const clash = configProblems(settingsWith({ horizonKey: 'parent' }));
		expect(clash).toHaveLength(1);
		expect(clash[0]).toContain('parent and horizon');
	});

	it('refuses axis keys colliding with each other — start and target cannot share', () => {
		// One key cannot store a span, and a horizon sharing either is two semantics
		// on one field.
		const span = configProblems(settingsWith({ startKey: 'when', targetKey: 'when' }));
		expect(span).toHaveLength(1);
		expect(span[0]).toContain('start and target');

		const mixed = configProblems(settingsWith({ horizonKey: 'plan', startKey: 'plan' }));
		expect(mixed[0]).toContain('horizon and start');
	});

	it('says it in fragments, from the catalog, down to the word for each property', () => {
		// The whole catalog behind a marker: what the collision renders is a `settings.*`
		// fragment with a `property.*` word per role, and both halves have to show it.
		// English hides half of this — `property.parent` IS "parent" — so a role spelled
		// straight into the sentence reads identically until a role whose word differs
		// from its id joins, which is why the pair here is the started date and the tags key.
		setLocale('xx', {
			xx: Object.fromEntries(Object.entries(en).map(([key, entry]) => [key, `XX ${String(entry)}`])),
		});
		try {
			expect(configProblems(resolveSettings(fakeConfig({ startedDateProperty: 'note.tags' })))).toEqual([
				'XX the XX started date and XX tags properties share the key "tags"',
			]);
		} finally {
			setLocale('en');
		}
	});

	it('refuses an axis key aimed at the tags key — a fresh mistake, not a legacy view', () => {
		const settings = resolveSettings(fakeConfig({ horizonProperty: 'note.tags' }));
		expect(settings.tagsKey).toBe('tags');
		const clash = configProblems(settings);
		expect(clash).toHaveLength(1);
		expect(clash[0]).toContain('horizon and tags');
	});
});

describe('three workflows may share one state key', () => {
	function sharing(extra: Record<string, unknown> = {}) {
		return resolveSettings(
			new FakeViewConfig({
				parentProperty: 'note.parent',
				orderProperty: 'note.order',
				typeProperty: 'note.type',
				stateProperty: 'note.status',
				deliverableStateProperty: 'note.status',
				testStateProperty: 'note.status',
				...extra,
			}),
		);
	}

	it('reports no collision when every user of the key is a workflow state', () => {
		expect(configProblems(sharing())).toEqual([]);
	});

	it('still reports one when a label of any other kind joins them', () => {
		// The exemption is about workflows, not about "these labels" — one more property on
		// the key is an ordinary clash and has to read as one.
		const problems = configProblems(sharing({ riskProperty: 'note.status' }));
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain('"status"');
	});
});

describe('resolveSettings roadmap options', () => {
	it('reads the axis properties, unset by default — the axis is declared, never guessed', () => {
		const defaults = resolveSettings(fakeConfig());
		expect(defaults.horizonKey).toBe('');
		expect(defaults.startKey).toBe('');
		expect(defaults.targetKey).toBe('');

		const configured = resolveSettings(
			fakeConfig({ horizonProperty: 'note.horizon', startProperty: 'note.start', targetProperty: 'note.due' }),
		);
		expect(configured.horizonKey).toBe('horizon');
		expect(configured.startKey).toBe('start');
		expect(configured.targetKey).toBe('due');
	});

	it('ships the horizon values prefilled and keeps a cleared list cleared', () => {
		// A default vocabulary, not a fixed one: untouched falls back to the canonical
		// triple, edited is honored, and cleared means "no bucket axis" — not a reset.
		expect(resolveSettings(fakeConfig()).horizonValues).toEqual(['Now', 'Next', 'Later']);
		expect(resolveSettings(fakeConfig({ horizonValues: 'This quarter, Beyond' })).horizonValues).toEqual([
			'This quarter',
			'Beyond',
		]);
		expect(resolveSettings(fakeConfig({ horizonValues: '' })).horizonValues).toEqual([]);
		expect(resolveSettings(fakeConfig({ horizonValues: 'Now, now, Later' })).horizonValues).toEqual([
			'Now',
			'Later',
		]);
	});
});

describe('resolveSettings display options', () => {
	it('reads the tags property, defaulting to the frontmatter tags key', () => {
		expect(resolveSettings(fakeConfig()).tagsKey).toBe('tags');
		expect(resolveSettings(fakeConfig({ tagsProperty: 'note.labels' })).tagsKey).toBe('labels');
	});

	it('treats a cleared tags property as off, not as unset', () => {
		// Unlike the state property, this one defaults to a real key — clearing it in
		// the view options has to be able to turn tag editing off.
		expect(resolveSettings(fakeConfig({ tagsProperty: '' })).tagsKey).toBe('');
		expect(resolveSettings(fakeConfig({ tagsProperty: null })).tagsKey).toBe('');
		// A property this view cannot write is equally "off"
		expect(resolveSettings(fakeConfig({ tagsProperty: 'file.tags' })).tagsKey).toBe('');
	});

});

describe('stateMenuValues', () => {
	it('prefers the configured states verbatim', () => {
		const settings = settingsWith({ states: ['New', 'Active', 'Done'] });
		expect(stateMenuValues(settings, ['Blocked'])).toEqual(['New', 'Active', 'Done']);
	});

	it('falls back to observed values when they already include a done state', () => {
		const settings = defaultSettings();
		expect(stateMenuValues(settings, ['Active', 'Closed'])).toEqual(['Active', 'Closed']);
	});

	it('appends the first done value so marking done is always offered', () => {
		const settings = defaultSettings();
		expect(stateMenuValues(settings, ['Active'])).toEqual(['Active', 'Done']);
		expect(stateMenuValues(settings, [])).toEqual(['Done']);
	});
});

describe('horizonMenuValues', () => {
	const withHorizons = (values: string[]) => (settingsWith({ horizonKey: 'horizon', horizonValues: values }));

	it('offers the declared vocabulary first, in declared order', () => {
		expect(horizonMenuValues(withHorizons(['Now', 'Next', 'Later']), [])).toEqual(['Now', 'Next', 'Later']);
	});

	it('adds every observed value the declaration does not name', () => {
		// The union, not the state menu's either/or: an undeclared horizon is a bucket
		// the roadmap already draws, so a menu without it could not reach a target the
		// drag can. Order follows the buckets: declared first, then as first seen.
		expect(horizonMenuValues(withHorizons(['Now', 'Next']), ['Someday', 'Now'])).toEqual([
			'Now',
			'Next',
			'Someday',
		]);
	});

	it('matches the declaration case-insensitively, keeping the declared casing', () => {
		expect(horizonMenuValues(withHorizons(['Now']), ['now'])).toEqual(['Now']);
	});

	it('offers the observed values alone when nothing is declared', () => {
		expect(horizonMenuValues(withHorizons([]), ['Q3', 'Q4'])).toEqual(['Q3', 'Q4']);
	});
});

describe('the test workflow resolves like the Deliverable one', () => {
	it('falls back to the requirements key, states and EFFECTIVE done values when unbound', () => {
		const settings = resolveSettings(
			new FakeViewConfig({
				stateProperty: 'note.status',
				stateValues: 'Draft, Ready, Approved',
				doneValues: 'Approved',
			}),
		);
		expect(settings.testStateKey).toBe('');
		expect(resolvedTestStateKey(settings)).toBe('status');
		expect(settings.testStates).toEqual(['Draft', 'Ready', 'Approved']);
		expect(settings.testDoneValues).toEqual(['Approved']);
	});

	it('takes the shipped defaults, never the requirements customization, on its OWN key', () => {
		// An own distinct key is a genuinely independent workflow: borrowing a list read
		// through a DIFFERENT property is the bug the Deliverable resolver was written for.
		const settings = resolveSettings(
			new FakeViewConfig({
				stateProperty: 'note.status',
				stateValues: 'Draft, Ready, Approved',
				doneValues: 'Approved',
				testStateProperty: 'note.testStatus',
			}),
		);
		expect(settings.testStateKey).toBe('testStatus');
		expect(resolvedTestStateKey(settings)).toBe('testStatus');
		expect(settings.testStates).toEqual([]);
		expect(settings.testDoneValues).toEqual(DEFAULT_DONE_VALUES);
	});

	it('leaves the test key unbound on a first-run setup, so it shares status', () => {
		// `state` is declared FIRST in PROPERTY_TABLE and adopts `status`, which the loop then
		// adds to `taken`; the "don't suggest an already-taken key" guard skips every later
		// row suggesting it. That ordering IS the "tests default to status" rule.
		const config = new FakeViewConfig({}) as unknown as BasesViewConfig;
		const adopted = adoptableProperties(config, resolveSettings(config));
		expect(adopted.find((p) => p.option === 'stateProperty')?.suggested).toBe('status');
		expect(adopted.some((p) => p.option === 'testStateProperty')).toBe(false);
	});
});

describe('the marker category', () => {
	it('declares every marker outside both the ladder and the extra types', () => {
		// The whole point of the third category: every rule that reads EXTRA_TYPES keeps
		// meaning exactly what `Types beside the ladder` says it means. Looped over
		// MARKER_TYPES rather than named at 'Milestone' alone, so a third marker joining
		// the category is covered without anyone remembering to extend this test.
		expect(MARKER_TYPES).toEqual(['Milestone', 'Iteration', 'Release']);
		for (const marker of MARKER_TYPES) {
			expect(LEVELS).not.toContain(marker);
			expect(EXTRA_TYPES).not.toContain(marker);
		}
		expect(ALL_TYPES).toEqual([...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES, ...TEST_LEVELS.filter((t) => t !== 'Task')]);
	});

	it('ships the marker a folder of its own under the home folder', () => {
		expect(defaultTypeFolder('Milestone')).toBe('docs/milestones');
		expect(defaultTypeFolder('Milestone', 'work')).toBe('work/milestones');
		expect(defaultSettings().typeFolders.milestone).toBe('docs/milestones');
	});
});

describe('the shipped released vocabulary', () => {
	it('is a value list, not a sentence', () => {
		// A vocabulary is DATA: it is matched against what a release note carries, so it
		// must never come from the catalog. Two people on different Obsidian languages
		// must not write status values the other's view reports as not-released.
		expect(DEFAULT_RELEASED_VALUES).toEqual(['Released']);
	});
});
