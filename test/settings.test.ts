import { describe, expect, it } from 'vitest';
import {
	configProblems,
	DEFAULT_LEVELS,
	defaultSettings,
	getViewOptions,
	resolveSettings,
	stateMenuValues,
} from '../src/settings';

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

	it('parses the levels list, trimming blanks', () => {
		const settings = resolveSettings(fakeConfig({ levels: ' Theme , Initiative ,, Story ' }));
		expect(settings.levels).toEqual(['Theme', 'Initiative', 'Story']);
	});

	it('uses the default levels when the list is empty', () => {
		expect(resolveSettings(fakeConfig({ levels: ' , ' })).levels).toEqual(DEFAULT_LEVELS);
	});

	it('reads toggles and normalizes the folder', () => {
		const settings = resolveSettings(
			fakeConfig({
				autoAssignType: false,
				showProperties: false,
				showCounts: false,
				newItemFolder: '/Backlog/Items/',
			}),
		);
		expect(settings.autoType).toBe(false);
		expect(settings.showChips).toBe(false);
		expect(settings.showCounts).toBe(false);
		expect(settings.newItemFolder).toBe('Backlog/Items');
	});

	it('scopes the view to the hierarchy unless the toggle is turned off', () => {
		expect(resolveSettings(fakeConfig()).hierarchyOnly).toBe(true);
		expect(resolveSettings(fakeConfig({ hierarchyOnly: false })).hierarchyOnly).toBe(false);
	});
});

describe('getViewOptions', () => {
	it('declares every config key the view reads', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
		const keys = flat.map((o) => o.key);
		expect(keys).toEqual(
			expect.arrayContaining([
				'parentProperty',
				'orderProperty',
				'typeProperty',
				'levels',
				'hierarchyOnly',
				'inferFolderHierarchy',
				'autoAssignType',
				'stateProperty',
				'doneValues',
				'newItemFolder',
				'showProperties',
				'showCounts',
			]),
		);
	});

	it('leaves the focus level to the view toolbar', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
		expect(flat.some((o) => o.key === 'focusLevel')).toBe(false);
	});

	it('limits the property pickers to note properties', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
		const parent = flat.find((o) => o.key === 'parentProperty') as {
			filter: (prop: string) => boolean;
		};
		expect(parent.filter('note.parent')).toBe(true);
		expect(parent.filter('file.name')).toBe(false);
		expect(parent.filter('formula.x')).toBe(false);
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

	it('declares the new progress option keys', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
		expect(flat.map((o) => o.key)).toEqual(expect.arrayContaining(['stateValues', 'showCompleted']));
	});
});

describe('configProblems', () => {
	it('reports properties sharing a frontmatter key, tags included', () => {
		expect(configProblems(defaultSettings())).toEqual([]);
		const clash = configProblems({ ...defaultSettings(), stateKey: 'tags' });
		expect(clash).toHaveLength(1);
		expect(clash[0]).toContain('state and tags');
	});
});

describe('resolveSettings display options', () => {
	it('reads the tags property, defaulting to the frontmatter tags key', () => {
		expect(resolveSettings(fakeConfig()).tagsKey).toBe('tags');
		expect(resolveSettings(fakeConfig({ tagsProperty: 'note.labels' })).tagsKey).toBe('labels');
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

	it('declares the new display option keys', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
		expect(flat.map((o) => o.key)).toEqual(expect.arrayContaining(['tagsProperty', 'propertyColumnWidth']));
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
