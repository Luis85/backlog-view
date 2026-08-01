import { describe, expect, it } from 'vitest';
import { getViewOptions } from '../../src/domain/viewOptions';

/** Stand-in for BasesViewConfig backed by a plain object. */
function fakeConfig(values: Record<string, unknown> = {}) {
	return { get: (key: string) => values[key], getAsPropertyId: () => null } as never;
}

/**
 * The schema is persisted user data: every `key` here is written into a `.base`
 * file and read back by `resolveSettings`, so these tests are a rename alarm as
 * much as a coverage exercise.
 */
describe('getViewOptions', () => {
	it('declares every config key the view reads', () => {
		const flat = getViewOptions(fakeConfig()).flatMap((o) => ('items' in o ? o.items : [o]));
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

				'showProperties',
				'showCounts',
			]),
		);
	});

	it('leaves the focus level to the view toolbar', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
		expect(flat.some((o) => o.key === 'focusLevel')).toBe(false);
	});

	it('declares a folder option per configured type, not one mapping to typo', () => {
		// The option list is built from the view's own config, so a vault with a
		// different vocabulary gets a picker per name it actually uses.
		const flat = getViewOptions(fakeConfig({ levels: 'Theme, Story', extraTypes: 'Spike' })).flatMap((o) =>
			'items' in o ? o.items : [o],
		);
		const keys = flat.map((o) => o.key);
		expect(keys).toEqual(expect.arrayContaining(['typeFolder.theme', 'typeFolder.story', 'typeFolder.spike']));
		expect(keys).not.toContain('typeFolder.epic');
	});

	it('declares the progress and display option keys', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
		expect(flat.map((o) => o.key)).toEqual(
			expect.arrayContaining(['stateValues', 'showCompleted', 'tagsProperty', 'propertyColumnWidth']),
		);
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
