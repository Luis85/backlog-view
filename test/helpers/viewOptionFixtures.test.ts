// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { folderForType } from '../../src/domain/itemTypes';
import { FILED_TYPES } from '../../src/domain/typeVocabulary';
import { settingsFrom } from './settings';
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
 * What it does NOT reach: a folder layer that is neither the home folder nor a
 * `typeFolder.*` box. `Resource` is exactly that today — `resourceFolder` is its own
 * option and `RESOURCE_TYPE` is deliberately outside `FILED_TYPES` — so a test that wants
 * inference for a resource note has to clear that key itself. The guarantee here is over
 * the filed work-item vocabulary and stops there.
 */
describe('the fixture that clears every type folder', () => {
	it('leaves no filed type with a folder of its own, whatever the vocabulary holds', () => {
		const settings = settingsFrom(noTypeFolders());
		expect(FILED_TYPES.length).toBeGreaterThan(0);
		for (const type of FILED_TYPES) {
			expect([type, folderForType(type, settings)]).toEqual([type, null]);
		}
		// The second layer: a type with no folder of its own falls through to the home
		// folder, so clearing only the boxes would still file everything under `docs`.
		expect(settings.homeFolder).toBe('');
	});

	it('lets a caller keep its own options', () => {
		expect(settingsFrom(noTypeFolders({ inferFolderHierarchy: true })).folderHierarchy).toBe(true);
	});
});
