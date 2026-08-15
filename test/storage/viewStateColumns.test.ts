// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	loadViewState,
	MAX_PROP_COLUMN_WIDTH,
	MIN_PROP_COLUMN_WIDTH,
	rekeyBase,
	saveViewState,
	ViewFolds,
	ViewPrefs,
} from '../../src/storage/viewStateStore';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';

/**
 * The two stored values a COLUMN owns — its width, a pref, and its fold, a pair of fold
 * lists. Their own file rather than more of `viewStateStore.test.ts`, which is at the
 * `test/**` line budget: split by subject before a file becomes the place tests hide.
 */
installObsidianDom();

const STORE_KEY = 'product-backlog:view-state';

const id = { base: 'Backlog.base', view: 'Backlog' };

function emptyFolds(): ViewFolds {
	return { collapsed: [], expanded: [], lanes: [], collapsedColumns: [], expandedColumns: [] };
}

const none = { folds: emptyFolds(), prefs: {} };

let vault: FakeVault;

function stored(): Record<string, { base: string; folds: ViewFolds; prefs: ViewPrefs }> {
	return (vault.localStorage.get(STORE_KEY) ?? {}) as Record<
		string,
		{ base: string; folds: ViewFolds; prefs: ViewPrefs }
	>;
}

/** A stored entry written by hand, the way another version of the plugin might have. */
function entry(fields: Record<string, unknown>): void {
	vault.localStorage.set(STORE_KEY, {
		'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: {}, ...fields },
	});
}

beforeEach(() => {
	vault = new FakeVault();
	vault.addFile('Backlog.base');
});

describe('the persisted property-column widths', () => {
	it('round-trips a width per property', () => {
		saveViewState(vault.app, id, { ...none, prefs: { colWidths: { 'note.owner': 200, 'note.points': 90 } } });
		expect(loadViewState(vault.app, id).prefs.colWidths).toEqual({ 'note.owner': 200, 'note.points': 90 });
	});

	it('needs no entry for a view whose columns are all at the default', () => {
		saveViewState(vault.app, id, { ...none, prefs: { colWidths: {} } });
		expect(loadViewState(vault.app, id).prefs.colWidths).toBeUndefined();
		expect(stored()['Backlog.base#Backlog']).toBeUndefined();
	});

	it('drops one unusable width without taking the map with it', () => {
		// A bad entry is one column's pick, not every column's: one hand-edited number
		// must not reset the widths beside it. Every other reader in the table refuses
		// its value whole, and that difference is the reason this one exists.
		entry({
			prefs: {
				colWidths: { 'note.owner': 200, 'note.points': MAX_PROP_COLUMN_WIDTH + 1, 'note.risk': '90', 'note.due': NaN },
			},
		});
		expect(loadViewState(vault.app, id).prefs.colWidths).toEqual({ 'note.owner': 200 });
	});

	it('accepts a width exactly at each bound, and nothing beyond them', () => {
		entry({ prefs: { colWidths: { min: MIN_PROP_COLUMN_WIDTH, max: MAX_PROP_COLUMN_WIDTH, under: MIN_PROP_COLUMN_WIDTH - 1 } } });
		expect(loadViewState(vault.app, id).prefs.colWidths).toEqual({
			min: MIN_PROP_COLUMN_WIDTH,
			max: MAX_PROP_COLUMN_WIDTH,
		});
	});

	it('reads a map that is not one, and a key inherited off Object, as no widths at all', () => {
		for (const junk of [null, 200, 'wide', ['note.owner', 200]]) {
			entry({ prefs: { colWidths: junk } });
			expect(loadViewState(vault.app, id).prefs.colWidths).toBeUndefined();
		}
		// A property may legally be called `constructor`, and a stored entry may claim one:
		// it has to read back as a plain width rather than as whatever `Object` inherits.
		entry({ prefs: { colWidths: { constructor: 200 } } });
		expect(loadViewState(vault.app, id).prefs.colWidths?.constructor).toBe(200);
		// `__proto__` is the same hazard with teeth: on an object literal it would rewrite
		// the prototype instead of storing a width. A computed key is how the fixture puts
		// it there as an own property, which is what a parsed JSON entry holds.
		entry({ prefs: { colWidths: { ['__proto__']: 200 } } });
		const widths = loadViewState(vault.app, id).prefs.colWidths;
		expect(widths?.['__proto__']).toBe(200);
		expect(Object.getPrototypeOf(widths)).toBeNull();
	});

	it('is reached by neither the prune nor the rename, since its keys name no file', () => {
		// The reason this is a pref and not a fold: a key here is a Bases property id, so a
		// property hidden for an afternoon comes back the width its reader left it.
		vault.addFile('Old.base');
		saveViewState(vault.app, { base: 'Old.base', view: 'Backlog' }, { ...none, prefs: { colWidths: { 'note.owner': 200 } } });
		vault.files.delete('Old.base');
		vault.addFile('New.base');
		rekeyBase(vault.app, 'Old.base', 'New.base');

		expect(loadViewState(vault.app, { base: 'New.base', view: 'Backlog' }).prefs.colWidths).toEqual({
			'note.owner': 200,
		});
	});
});

describe('folded columns and buckets', () => {
	// Opaque to this module: `columnKey` in `view/viewState.ts` mints the real ones and
	// this side never parses them, so the tests read as strings rather than as its format.
	const DONE = 'board-done';
	const NEXT = 'horizons-next';

	it('defaults to nothing folded, and needs no entry at all', () => {
		saveViewState(vault.app, id, none);
		expect(stored()['Backlog.base#Backlog']).toBeUndefined();

		const snapshot = loadViewState(vault.app, id);
		expect(snapshot.folds.collapsedColumns).toEqual([]);
		expect(snapshot.folds.expandedColumns).toEqual([]);
	});

	it('round-trips a fold on its own, with nothing else in the entry to keep it alive', () => {
		// A view whose ONLY change is one folded column still has state worth an entry —
		// the question the density test asks, of the field added after it.
		saveViewState(vault.app, id, { ...none, folds: { ...emptyFolds(), collapsedColumns: [DONE] } });
		expect(loadViewState(vault.app, id).folds.collapsedColumns).toEqual([DONE]);
	});

	it('keeps the two lists apart, so an open against a default is not read as a fold', () => {
		saveViewState(vault.app, id, {
			...none,
			folds: { ...emptyFolds(), collapsedColumns: [NEXT], expandedColumns: [DONE] },
		});
		const snapshot = loadViewState(vault.app, id);
		expect(snapshot.folds.collapsedColumns).toEqual([NEXT]);
		expect(snapshot.folds.expandedColumns).toEqual([DONE]);
	});

	it('drops a stored list that is not an array of strings', () => {
		entry({ folds: { collapsedColumns: DONE, expandedColumns: [7, NEXT] } });
		const snapshot = loadViewState(vault.app, id);
		expect(snapshot.folds.collapsedColumns).toEqual([]);
		// The list survives minus the entry that is not a string — `texts`' own rule,
		// borrowed whole because a column key is a string in a list like any other.
		expect(snapshot.folds.expandedColumns).toEqual([NEXT]);
	});

	it('keeps a folded column through a base rename, since it names no file to prune', () => {
		// The reason these are lists of their own rather than keys in the collapse SET: the
		// flush drops any key the vault has no file for, and a state value never has one.
		vault.addFile('Old.base');
		saveViewState(
			vault.app,
			{ base: 'Old.base', view: 'Backlog' },
			{ ...none, folds: { ...emptyFolds(), collapsedColumns: [DONE] } },
		);
		vault.files.delete('Old.base');
		vault.addFile('New.base');
		rekeyBase(vault.app, 'Old.base', 'New.base');

		expect(loadViewState(vault.app, { base: 'New.base', view: 'Backlog' }).folds.collapsedColumns).toEqual([DONE]);
	});
});
