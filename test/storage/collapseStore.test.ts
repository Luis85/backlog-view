// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadCollapseState, rekeyBase, saveCollapseState } from '../../src/storage/collapseStore';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';

installObsidianDom();

const STORE_KEY = 'product-backlog:collapse';

function stored(vault: FakeVault): Record<string, { base: string; collapsed: string[]; expanded: string[] }> {
	return (vault.localStorage.get(STORE_KEY) ?? {}) as Record<
		string,
		{ base: string; collapsed: string[]; expanded: string[] }
	>;
}

let vault: FakeVault;

beforeEach(() => {
	vault = new FakeVault();
});

describe('rekeyBase', () => {
	it('moves an entry to the renamed base, keeping its rows', () => {
		vault.addFile('Old.base');
		vault.addFile('Epic.md');
		saveCollapseState(
			vault.app,
			{ base: 'Old.base', view: 'Backlog' },
			{ collapsed: new Set(['Epic.md']), expanded: new Set() },
		);

		vault.files.delete('Old.base');
		vault.addFile('Archive/New.base');
		rekeyBase(vault.app, 'Old.base', 'Archive/New.base');

		// Found under the new path, with the state that was there before.
		const restored = loadCollapseState(vault.app, { base: 'Archive/New.base', view: 'Backlog' });
		expect([...restored.collapsed]).toEqual(['Epic.md']);
		expect(Object.keys(stored(vault))).toHaveLength(1);
		expect(Object.values(stored(vault))[0].base).toBe('Archive/New.base');
	});

	it('carries a view name that contains the key separator', () => {
		vault.addFile('Old.base');
		vault.addFile('Epic.md');
		saveCollapseState(
			vault.app,
			{ base: 'Old.base', view: 'Sprint #3' },
			{ collapsed: new Set(['Epic.md']), expanded: new Set() },
		);

		vault.files.delete('Old.base');
		vault.addFile('New.base');
		rekeyBase(vault.app, 'Old.base', 'New.base');

		// The view name is recovered from the key, which only works because both
		// halves are encoded — the literal '#' is always the separator.
		const restored = loadCollapseState(vault.app, { base: 'New.base', view: 'Sprint #3' });
		expect([...restored.collapsed]).toEqual(['Epic.md']);
	});

	it('moves every view of the renamed base and leaves other bases alone', () => {
		for (const path of ['Old.base', 'Other.base']) vault.addFile(path);
		vault.addFile('Epic.md');
		const snap = { collapsed: new Set(['Epic.md']), expanded: new Set<string>() };
		saveCollapseState(vault.app, { base: 'Old.base', view: 'Planning' }, snap);
		saveCollapseState(vault.app, { base: 'Old.base', view: 'Triage' }, snap);
		saveCollapseState(vault.app, { base: 'Other.base', view: 'Planning' }, snap);

		vault.files.delete('Old.base');
		vault.addFile('New.base');
		rekeyBase(vault.app, 'Old.base', 'New.base');

		const bases = Object.values(stored(vault)).map((e) => e.base).sort();
		expect(bases).toEqual(['New.base', 'New.base', 'Other.base']);
		expect(loadCollapseState(vault.app, { base: 'New.base', view: 'Triage' }).collapsed.size).toBe(1);
	});

	it('does nothing when no entry names the old path', () => {
		vault.addFile('Other.base');
		vault.addFile('Epic.md');
		saveCollapseState(
			vault.app,
			{ base: 'Other.base', view: 'Backlog' },
			{ collapsed: new Set(['Epic.md']), expanded: new Set() },
		);
		const before = JSON.stringify(stored(vault));

		rekeyBase(vault.app, 'Never.base', 'Whatever.base');
		expect(JSON.stringify(stored(vault))).toBe(before);
	});
});
