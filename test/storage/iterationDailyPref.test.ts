// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadViewState, saveViewState } from '../../src/storage/viewStateStore';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';

installObsidianDom();

const STORE_KEY = 'product-backlog:view-state';
const id = { base: 'Backlog.base', view: 'Backlog' };
const folds = { collapsed: [], expanded: [], lanes: [], collapsedColumns: [], expandedColumns: [] };

let vault: FakeVault;

beforeEach(() => {
	vault = new FakeVault();
	vault.addFile('Backlog.base');
});

/** The iteration board's Daily pick and the horizon board's Present pick: one shape, two keys. */
describe.each(['iterationDaily', 'horizonPresent'] as const)('the %s pick', (pref) => {
	it('stores only true, and false needs no entry at all', () => {
		saveViewState(vault.app, id, { folds, prefs: { [pref]: false } });
		expect(vault.localStorage.get(STORE_KEY) ?? {}).not.toHaveProperty('Backlog.base#Backlog');
		saveViewState(vault.app, id, { folds, prefs: { [pref]: true } });
		expect(loadViewState(vault.app, id).prefs[pref]).toBe(true);
	});

	/** User-writable data: only the value this module writes is the value it reads back. */
	it('reads anything but a stored true as the default', () => {
		for (const junk of ['daily', 1, {}, [], null, false]) {
			vault.localStorage.set(STORE_KEY, {
				'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: { [pref]: junk } },
			});
			expect(loadViewState(vault.app, id).prefs[pref]).toBeUndefined();
		}
	});
});
