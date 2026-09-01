// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	loadViewState,
	pruneDeletedFolds,
	renamePathFolds,
	saveViewState,
	ViewFolds,
} from '../../src/storage/viewStateStore';
import { MYWORK_FOLD } from '../../src/storage/foldKeys';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';

installObsidianDom();

const STORE_KEY = 'product-backlog:view-state';

/**
 * A FOLD key's whole lifecycle in the STORE — the walks that run over every stored entry
 * rather than over one loaded view's in-memory copy, which is `test/view/viewStatePersistence.test.ts`.
 * Split out of `viewStateStore.test.ts` (the 450-line test budget) as its own subject: the
 * rename and the prune are one key shape asked two questions, and the entry's own defensive
 * read, its preferences and its budget are a different subject entirely.
 *
 * Asserted on the stored VALUE throughout, for the rename walk's own reason: a fold key
 * left behind and a fold key deleted look identical on screen (the row simply reopens), so
 * only the key at its new spelling tells a migration from a loss.
 */

function emptyFolds(): ViewFolds {
	return { collapsed: [], expanded: [], lanes: [], collapsedColumns: [], expandedColumns: [] };
}

let vault: FakeVault;

beforeEach(() => {
	vault = new FakeVault();
	vault.addFile('Plan.base');
});

/** The RENAME half: `renamePathFolds`, the fold counterpart of `renamePathPrefs`. */
describe('a fold key a saved view remembers', () => {
	const FOLD_ID = { base: 'Plan.base', view: 'Releases' };

	function saveFolds(collapsed: string[], expanded: string[] = []): void {
		saveViewState(vault.app, FOLD_ID, { folds: { ...emptyFolds(), collapsed, expanded }, prefs: {} });
	}

	it('renames every key shape a stored entry can hold, in both lists', () => {
		saveFolds(
			[
				'a.md',
				'\u0000card:a.md',
				'\u0000timeline:a.md',
				'\u0000release:Releases/0.8.md\u0000a.md',
				`${MYWORK_FOLD}People/Ada.md\u0000a.md`,
			],
			['a.md'],
		);

		renamePathFolds(vault.app, 'a.md', 'b.md');

		const folds = loadViewState(vault.app, FOLD_ID).folds;
		expect(folds.collapsed).toEqual([
			'b.md',
			'\u0000card:b.md',
			'\u0000timeline:b.md',
			'\u0000release:Releases/0.8.md\u0000b.md',
			`${MYWORK_FOLD}People/Ada.md\u0000b.md`,
		]);
		expect(folds.expanded).toEqual(['b.md']);
	});

	it('moves a release fold when the RELEASE itself is renamed, not only its member', () => {
		// The half `ViewState.renamePath`'s old expression never asked about: a release-fold
		// key carries TWO paths, and renaming the release note stranded every fold in its
		// scope under a prefix no reader would ask for again.
		saveFolds(['\u0000release:Releases/0.8.md\u0000a.md']);

		renamePathFolds(vault.app, 'Releases/0.8.md', 'Releases/0.8.1.md');

		expect(loadViewState(vault.app, FOLD_ID).folds.collapsed).toEqual(['\u0000release:Releases/0.8.1.md\u0000a.md']);
	});

	it('moves a mywork fold when the PERSON is renamed, not only the member', () => {
		// `MYWORK_FOLD`'s own reason for taking a prefix PARAMETER (`storage/foldKeys.ts`):
		// one branch answers this for every scoped prefix, so a third can never drift
		// from the two it was copied from.
		saveFolds([`${MYWORK_FOLD}People/Ada.md\u0000a.md`]);

		renamePathFolds(vault.app, 'People/Ada.md', 'People/Ada Lovelace.md');

		expect(loadViewState(vault.app, FOLD_ID).folds.collapsed).toEqual([
			`${MYWORK_FOLD}People/Ada Lovelace.md\u0000a.md`,
		]);
	});

	it('carries a folder move above either path, which is the only event a folder reports', () => {
		saveFolds(['\u0000release:Releases/0.8.md\u0000Backlog/a.md']);

		renamePathFolds(vault.app, 'Backlog', 'Work');
		renamePathFolds(vault.app, 'Releases', 'Archive/Releases');

		expect(loadViewState(vault.app, FOLD_ID).folds.collapsed).toEqual([
			'\u0000release:Archive/Releases/0.8.md\u0000Work/a.md',
		]);
	});

	it('leaves a key no rename names exactly as it was', () => {
		saveFolds(['a.md', '\u0000release:Releases/0.8.md\u0000a.md']);

		// A path that merely shares a name prefix, and a rename of something else entirely.
		renamePathFolds(vault.app, 'a.md.old', 'z.md');
		renamePathFolds(vault.app, 'Epic.md', 'Story.md');

		expect(loadViewState(vault.app, FOLD_ID).folds.collapsed).toEqual(['a.md', '\u0000release:Releases/0.8.md\u0000a.md']);
	});

	it('is stored once when a rename lands it on a spelling the list already holds', () => {
		// Only reachable through a STALE key — Obsidian refuses a rename onto an existing
		// note — but the duplicate is real state: every reader turns these lists into a
		// `Set`, so it is invisible on screen and still spends a MAX_FOLDS slot.
		saveFolds(['a.md', 'b.md']);

		renamePathFolds(vault.app, 'a.md', 'b.md');

		expect(loadViewState(vault.app, FOLD_ID).folds.collapsed).toEqual(['b.md']);
	});
});

/**
 * The DELETE half of the same lifecycle. Driven by the event rather than by asking the
 * index inside a save, which is why nothing here needs `pruneMissingBases`' index-trust
 * guard: Obsidian is reporting a removal it performed, not answering a question it may be
 * unable to answer.
 */
describe('a fold key whose note is deleted', () => {
	const FOLD_ID = { base: 'Plan.base', view: 'Releases' };
	const RELEASE_KEY = '\u0000release:Releases/0.8.md\u0000Backlog/a.md';

	function saveFolds(collapsed: string[], expanded: string[] = []): void {
		saveViewState(vault.app, FOLD_ID, { folds: { ...emptyFolds(), collapsed, expanded }, prefs: {} });
	}

	function collapsedAfter(deleted: string, keys: string[], expanded: string[] = []): string[] {
		saveFolds(keys, expanded);
		pruneDeletedFolds(vault.app, deleted);
		return loadViewState(vault.app, FOLD_ID).folds.collapsed;
	}

	it('goes, in every key shape and in both lists, when the note it names does', () => {
		saveFolds(['a.md', '\u0000card:a.md', '\u0000timeline:a.md', '\u0000release:R.md\u0000a.md', 'keep.md'], ['a.md']);

		pruneDeletedFolds(vault.app, 'a.md');

		const folds = loadViewState(vault.app, FOLD_ID).folds;
		expect(folds.collapsed).toEqual(['keep.md']);
		expect(folds.expanded).toEqual([]);
	});

	it('goes with its RELEASE as well as with its member, since either kills the screen', () => {
		expect(collapsedAfter('Releases/0.8.md', [RELEASE_KEY, 'Backlog/a.md'])).toEqual(['Backlog/a.md']);
		expect(collapsedAfter('Backlog/a.md', [RELEASE_KEY])).toEqual([]);
	});

	it('goes with a FOLDER above either path, which is the only event a folder reports', () => {
		expect(collapsedAfter('Backlog', [RELEASE_KEY])).toEqual([]);
		expect(collapsedAfter('Releases', [RELEASE_KEY])).toEqual([]);
	});

	it('survives, with nothing written at all, when the delete names no fold', () => {
		// Seeded raw, with an entry `readMap` would refuse: it is the instrument for "no
		// write happened", since a write rebuilds the map from that same defensive read and
		// the junk would not survive it.
		vault.localStorage.set(STORE_KEY, {
			'Plan.base#Releases': {
				base: 'Plan.base',
				folds: { collapsed: ['a.md', RELEASE_KEY], expanded: [], lanes: [] },
				prefs: {},
			},
			'not an entry': 'nonsense',
		});

		// A path that merely shares a name prefix with a folded one, and a note nothing folded.
		pruneDeletedFolds(vault.app, 'a.md.old');
		pruneDeletedFolds(vault.app, 'Releases/0.9.md');

		expect(loadViewState(vault.app, FOLD_ID).folds.collapsed).toEqual(['a.md', RELEASE_KEY]);
		expect((vault.localStorage.get(STORE_KEY) as Record<string, unknown>)['not an entry']).toBe('nonsense');
	});
});
