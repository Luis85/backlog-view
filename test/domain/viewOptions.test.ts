import { describe, expect, it } from 'vitest';
import { getViewOptions } from '../../src/domain/viewOptions';


/**
 * The schema is persisted user data: every `key` here is written into a `.base`
 * file and read back by `resolveSettings`, so these tests are a rename alarm as
 * much as a coverage exercise.
 */
describe('getViewOptions', () => {
	it('declares every config key the view reads', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
		const keys = flat.map((o) => o.key);
		expect(keys).toEqual(
			expect.arrayContaining([
				'parentProperty',
				'orderProperty',
				'typeProperty',
				'hierarchyOnly',
				'inferFolderHierarchy',
				'autoAssignType',
				'stateProperty',
				'doneValues',
				'homeFolder',
				'showProperties',
				'showCounts',
			]),
		);
	});

	it('leaves the focus level to the view toolbar', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
		expect(flat.some((o) => o.key === 'focusLevel')).toBe(false);
	});

	it('declares a folder option per type, not one mapping to typo', () => {
		const flat = getViewOptions().flatMap((o) => ('items' in o ? o.items : [o]));
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
