import { describe, expect, it } from 'vitest';
import { DEFAULT_LEVELS, defaultSettings, getViewOptions, resolveSettings } from '../src/settings';

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
				'focusLevel',
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

	it('builds the focus dropdown from the configured levels', () => {
		const flat = getViewOptions(fakeConfig({ levels: 'Theme, Story' })).flatMap((o) =>
			'items' in o ? o.items : [o],
		);
		const focus = flat.find((o) => o.key === 'focusLevel') as { options: Record<string, string> };
		expect(Object.keys(focus.options)).toEqual(['', 'Theme', 'Story']);
	});

	it('falls back to the default levels when the config is unreadable', () => {
		const broken = {
			get: () => {
				throw new Error('no config');
			},
			getAsPropertyId: () => {
				throw new Error('no config');
			},
		} as never;
		const flat = getViewOptions(broken).flatMap((o) => ('items' in o ? o.items : [o]));
		const focus = flat.find((o) => o.key === 'focusLevel') as { options: Record<string, string> };
		expect(Object.keys(focus.options)).toEqual(['', ...DEFAULT_LEVELS]);
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
});
