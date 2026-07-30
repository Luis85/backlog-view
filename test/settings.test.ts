import { describe, expect, it } from 'vitest';
import { DEFAULT_LEVELS, defaultSettings, getViewOptions, levelForDepth, resolveSettings } from '../src/settings';

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

describe('levelForDepth', () => {
	const levels = ['Epic', 'Feature', 'PBI', 'Task'];

	it('maps depths to levels and clamps at both ends', () => {
		expect(levelForDepth(levels, 0)).toBe('Epic');
		expect(levelForDepth(levels, 3)).toBe('Task');
		expect(levelForDepth(levels, 9)).toBe('Task');
		expect(levelForDepth(levels, -1)).toBe('Epic');
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
