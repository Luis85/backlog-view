// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadViewState, saveViewState, ViewFolds } from '../../src/storage/viewStateStore';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';

installObsidianDom();

const STORE_KEY = 'product-backlog:view-state';
const ID = { base: 'Plan.base', view: 'Backlog' };
const OTHER = { base: 'Other.base', view: 'Backlog' };

function none(): ViewFolds {
	return { collapsed: [], expanded: [], lanes: [], collapsedColumns: [], expandedColumns: [] };
}

function folded(): ViewFolds {
	return { ...none(), collapsed: ['Epic.md'] };
}

function stored(vault: FakeVault): Record<string, { v?: unknown; base: string }> {
	return (vault.localStorage.get(STORE_KEY) ?? {}) as Record<string, { v?: unknown; base: string }>;
}

let vault: FakeVault;

beforeEach(() => {
	vault = new FakeVault();
	for (const path of ['Plan.base', 'Other.base', 'Epic.md']) vault.addFile(path);
});

/**
 * The shape has changed once already, and the change cost every reader their working
 * position because nothing on the entry said which shape it was. A stamp is what makes
 * the NEXT change a migration rather than a second reset.
 */
describe('the entry version', () => {
	it('stamps every entry it writes', () => {
		saveViewState(vault.app, ID, { folds: folded(), prefs: {} });

		expect(Object.values(stored(vault))[0].v).toBe(1);
	});

	it('reads an unstamped entry as this shape, so nothing already written resets', () => {
		// Every entry in the wild today is unstamped: the stamp arrives after the shape it
		// describes. Treating absence as "not mine" would reset the very readers this
		// exists to protect.
		vault.localStorage.set(STORE_KEY, {
			'Plan.base#Backlog': { base: 'Plan.base', folds: {}, prefs: { zoom: 'month' } },
		});

		expect(loadViewState(vault.app, ID).prefs.zoom).toBe('month');
	});

	it('drops an entry stamped by a version this one does not know', () => {
		// A newer plugin version's entry is not read defensively — it is not read at all.
		// Guessing at a shape this version has never seen is how a value lands somewhere
		// it means something else.
		vault.localStorage.set(STORE_KEY, {
			'Plan.base#Backlog': { v: 2, base: 'Plan.base', folds: {}, prefs: { zoom: 'month' } },
		});

		expect(loadViewState(vault.app, ID)).toEqual({ folds: none(), prefs: {} });
	});

	it('drops an entry whose stamp is not a version at all', () => {
		vault.localStorage.set(STORE_KEY, {
			'Plan.base#Backlog': { v: 'one', base: 'Plan.base', folds: {}, prefs: { zoom: 'month' } },
		});

		expect(loadViewState(vault.app, ID)).toEqual({ folds: none(), prefs: {} });
	});
});

describe('pruning another view', () => {
	it('still drops an entry whose base file is gone', () => {
		saveViewState(vault.app, OTHER, { folds: folded(), prefs: {} });
		vault.files.delete('Other.base');

		saveViewState(vault.app, ID, { folds: folded(), prefs: {} });

		expect(Object.keys(stored(vault))).toEqual(['Plan.base#Backlog']);
	});

	it('prunes nothing when the vault cannot see the base being written', () => {
		// The prune deletes every OTHER view's entry on one question asked of the vault
		// index, and an index that cannot find the base THIS view is drawing is not
		// answering that question about anybody else. Without the guard, one save while
		// the index is unavailable forgets every other base in the vault — the one loss
		// here that reopening a view cannot undo.
		saveViewState(vault.app, OTHER, { folds: folded(), prefs: {} });
		for (const path of ['Plan.base', 'Other.base']) vault.files.delete(path);

		saveViewState(vault.app, ID, { folds: folded(), prefs: {} });

		expect(Object.keys(stored(vault)).sort()).toEqual(['Other.base#Backlog', 'Plan.base#Backlog']);
	});

	it('prunes nothing when the view being written is at its defaults', () => {
		// The entry is deleted for having no content, so the base being written is not in
		// the map to ask about — the guard has to read it from the identity, not from the
		// entry it may just have removed.
		saveViewState(vault.app, OTHER, { folds: folded(), prefs: {} });
		vault.files.delete('Plan.base');

		saveViewState(vault.app, ID, { folds: none(), prefs: {} });

		expect(Object.keys(stored(vault))).toEqual(['Other.base#Backlog']);
	});
});
