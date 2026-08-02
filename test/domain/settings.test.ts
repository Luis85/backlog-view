import { describe, expect, it } from 'vitest';
import {
	axisKeyFor,
	configProblems,
	defaultSettings,
	horizonMenuValues,
	resolveSettings,
	stateMenuValues,
} from '../../src/domain/settings';

/** Stand-in for BasesViewConfig backed by a plain object. */
function fakeConfig(values: Record<string, unknown> = {}) {
	return {
		get: (key: string) => values[key],
		getAsPropertyId: (key: string) => {
			const v = values[key];
			return typeof v === 'string' && v.includes('.') ? v : null;
		},
	} as never;
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
				autoAssignType: true,
				showProperties: false,
				showCounts: false,
				homeFolder: '/Backlog/Items/',
			}),
		);
		expect(settings.autoType).toBe(true);
		expect(settings.showChips).toBe(false);
		expect(settings.showCounts).toBe(false);
		expect(settings.homeFolder).toBe('Backlog/Items');
	});

	it('leaves re-typing on move switched off unless it is asked for', () => {
		// A move is a move, not a re-classification. The option is for people who want
		// the ladder enforced on every drag, and it waits to be asked.
		expect(defaultSettings().autoType).toBe(false);
		expect(resolveSettings(fakeConfig()).autoType).toBe(false);
	});

	it('scopes the view to the hierarchy unless the toggle is turned off', () => {
		expect(resolveSettings(fakeConfig()).hierarchyOnly).toBe(true);
		expect(resolveSettings(fakeConfig({ hierarchyOnly: false })).hierarchyOnly).toBe(false);
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

	it('reads the completed-items toggle, defaulting to shown', () => {
		expect(resolveSettings(fakeConfig()).showCompleted).toBe(true);
		expect(resolveSettings(fakeConfig({ showCompleted: false })).showCompleted).toBe(false);
	});
});

describe('configProblems', () => {
	it('reports properties sharing a frontmatter key', () => {
		expect(configProblems(defaultSettings())).toEqual([]);
		const clash = configProblems({ ...defaultSettings(), orderKey: 'parent' });
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
		const clash = configProblems({ ...defaultSettings(), horizonKey: 'parent' });
		expect(clash).toHaveLength(1);
		expect(clash[0]).toContain('parent and horizon');
	});

	it('refuses axis keys colliding with each other — start and target cannot share', () => {
		// One key cannot store a span, and a horizon sharing either is two semantics
		// on one field.
		const span = configProblems({ ...defaultSettings(), startKey: 'when', targetKey: 'when' });
		expect(span).toHaveLength(1);
		expect(span[0]).toContain('start and target');

		const mixed = configProblems({ ...defaultSettings(), horizonKey: 'plan', startKey: 'plan' });
		expect(mixed[0]).toContain('horizon and start');
	});

	it('refuses an axis key aimed at the tags key — a fresh mistake, not a legacy view', () => {
		const settings = resolveSettings(fakeConfig({ horizonProperty: 'note.tags' }));
		expect(settings.tagsKey).toBe('tags');
		const clash = configProblems(settings);
		expect(clash).toHaveLength(1);
		expect(clash[0]).toContain('horizon and tags');
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

	it('clamps the property column width and ignores unusable values', () => {
		const width = (v: unknown) => resolveSettings(fakeConfig({ propertyColumnWidth: v })).propColumnWidth;
		expect(width(180)).toBe(180);
		// A hand-edited .base file can hold anything — never collapse the columns
		expect(width(10)).toBe(80);
		expect(width(9999)).toBe(280);
		expect(width('160')).toBe(160);
		expect(width('wide')).toBe(defaultSettings().propColumnWidth);
	});
});

describe('stateMenuValues', () => {
	it('prefers the configured states verbatim', () => {
		const settings = { ...defaultSettings(), states: ['New', 'Active', 'Done'] };
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
	const withHorizons = (values: string[]) => ({ ...defaultSettings(), horizonKey: 'horizon', horizonValues: values });

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

describe('axisKeyFor', () => {
	it('maps each field to the property it is stored under', () => {
		const settings = { ...defaultSettings(), horizonKey: 'horizon', startKey: 'start', targetKey: 'due' };
		expect(axisKeyFor(settings, 'horizon')).toBe('horizon');
		expect(axisKeyFor(settings, 'start')).toBe('start');
		expect(axisKeyFor(settings, 'target')).toBe('due');
		// Unconfigured is '', which every caller reads as "no key to write".
		expect(axisKeyFor(defaultSettings(), 'horizon')).toBe('');
	});
});
