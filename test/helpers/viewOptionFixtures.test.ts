// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { folderForType } from '../../src/domain/itemTypes';
import { getViewOptions } from '../../src/domain/viewOptions';
import { FOLDER_OPTION_TYPES } from '../../src/domain/typeVocabulary';
import { settingsFrom } from './settings';
import { FakeViewConfig } from './vault';
import { noTypeFolders } from './view';

/**
 * `noTypeFolders()` says every configured folder is cleared. This is what says so.
 *
 * The two hand-written copies it replaced recited six type names, and the vocabulary held
 * fourteen by 2026-09-02 — so eight types kept their SHIPPED folder inside a fixture whose
 * comment promised inference. That is the failure mode
 * [[Read the vocabulary instead of reciting it]] is named for: a list agrees with whatever
 * it was told once, and says nothing when the thing it recites grows.
 *
 * **The check is on the forbidden thing, not on a list of places.** What it forbids is a
 * type whose folder still resolves to something after this fixture ran, and it asks
 * `folderForType` — the function every creation path asks — rather than comparing the
 * options record to itself. Re-recite any subset of the vocabulary in the helper and the
 * types left out go red here, on a suite nobody edited.
 *
 * It is asked of `FOLDER_OPTION_TYPES`, the binding `viewOptions.ts` declares the boxes
 * from and `settingsResolve.ts` reads them back through — not of `FILED_TYPES`, which is
 * one type short of it. Review caught this test reciting that shorter list on PR #254:
 * `Absence` has a `typeFolder.absence` box like any other note the plugin files, and it
 * passed here only because its shipped default happens to be empty. A default given to it
 * later would have left inference tests holding that folder with this guard still green —
 * a subset asserted as the whole, which is the very defect this file was written for.
 *
 * What it does NOT reach: a folder layer that is neither the home folder nor a
 * `typeFolder.*` box. `Resource` is exactly that today — `resourceFolder` is its own
 * option and `RESOURCE_TYPE` is deliberately outside every vocabulary list — so a test
 * that wants inference for a resource note has to clear that key itself. The guarantee
 * here is over the type-folder options and stops there.
 */
describe('the fixture that clears every type folder', () => {
	it('leaves no filed type with a folder of its own, whatever the vocabulary holds', () => {
		const settings = settingsFrom(noTypeFolders());
		expect(FOLDER_OPTION_TYPES.length).toBeGreaterThan(0);
		for (const type of FOLDER_OPTION_TYPES) {
			expect([type, folderForType(type, settings)]).toEqual([type, null]);
		}
		// The second layer: a type with no folder of its own falls through to the home
		// folder, so clearing only the boxes would still file everything under `docs`.
		expect(settings.homeFolder).toBe('');
	});

	it('clears exactly the type-folder boxes the schema declares', () => {
		// The assertion above can only see a folder that RESOLVES to something, so it is
		// hostage to the shipped defaults: `Absence`'s is empty, so reciting a list without
		// it passed there. This one is not — it compares the keys the fixture writes against
		// the keys the real schema generates, so a subset fails whatever the defaults say.
		// Both directions: a key the fixture misses leaves a folder configured, and a key it
		// invents sets an option no box declares (`typeFolder.release` was resolved for a
		// dropped row once already, and printed a folder in the generated README).
		const declared = getViewOptions(new FakeViewConfig({}))
			.flatMap((entry) => {
				const group = entry as { items?: { key?: string }[]; key?: string };
				return Array.isArray(group.items) ? group.items.map((item) => item.key ?? '') : [group.key ?? ''];
			})
			.filter((key) => key.startsWith('typeFolder.'));
		const cleared = Object.keys(noTypeFolders()).filter((key) => key.startsWith('typeFolder.'));

		expect(declared.length).toBeGreaterThan(0);
		expect(cleared.sort()).toEqual([...declared].sort());
	});

	it('lets a caller keep its own options', () => {
		expect(settingsFrom(noTypeFolders({ inferFolderHierarchy: true })).folderHierarchy).toBe(true);
	});
});
