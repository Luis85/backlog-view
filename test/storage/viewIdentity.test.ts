// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { movedPath, viewNameOf, viewStateKey } from '../../src/storage/viewIdentity';
import { loadViewState, rekeyBase, saveViewState, ViewFolds } from '../../src/storage/viewStateStore';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';

installObsidianDom();

describe('viewStateKey', () => {
	it('encodes both halves, so no pair of base and view can collide with another', () => {
		// 'A#B' + 'C' and 'A' + 'B#C' are different views and must not share a key.
		expect(viewStateKey({ base: 'A#B', view: 'C' })).not.toBe(viewStateKey({ base: 'A', view: 'B#C' }));
	});

	it('round-trips a view name through viewNameOf, separator and all', () => {
		expect(viewNameOf(viewStateKey({ base: 'Docs/Plan.base', view: 'Sprint #3' }))).toBe('Sprint #3');
	});

	it('refuses a key it did not write rather than guessing a name', () => {
		expect(viewNameOf('one#two#three')).toBeNull();
		expect(viewNameOf('%E0%A4%A#Backlog')).toBeNull();
	});
});

describe('movedPath', () => {
	it('moves the renamed thing itself', () => {
		expect(movedPath('Old.base', 'Old.base', 'New.base')).toBe('New.base');
	});

	it('carries everything under a renamed folder', () => {
		expect(movedPath('Plans/Q3/Old.base', 'Plans', 'Archive')).toBe('Archive/Q3/Old.base');
	});

	it('leaves a path that merely shares a name prefix alone', () => {
		expect(movedPath('Plans2/Old.base', 'Plans', 'Archive')).toBeNull();
	});
});

/**
 * `rekeyBase` lives in the store, and its cases live here: every one of them is about
 * the KEY — a base path moving, a view name recovered from it, a prefix that only looks
 * like the renamed folder. What the entry holds is the store's own test file.
 */
describe('rekeyBase', () => {
	let vault: FakeVault;

	beforeEach(() => {
		vault = new FakeVault();
		vault.addFile('Epic.md');
	});

	function folds(): ViewFolds {
		return { collapsed: ['Epic.md'], expanded: [], lanes: [] };
	}

	function save(base: string, view: string): void {
		saveViewState(vault.app, { base, view }, { folds: folds(), prefs: {} });
	}

	function stored(): Record<string, { base: string }> {
		return (vault.localStorage.get('product-backlog:view-state') ?? {}) as Record<string, { base: string }>;
	}

	it('moves an entry to the renamed base, keeping its rows', () => {
		vault.addFile('Old.base');
		save('Old.base', 'Backlog');

		vault.files.delete('Old.base');
		vault.addFile('Archive/New.base');
		rekeyBase(vault.app, 'Old.base', 'Archive/New.base');

		// Found under the new path, with the state that was there before.
		const restored = loadViewState(vault.app, { base: 'Archive/New.base', view: 'Backlog' });
		expect(restored.folds.collapsed).toEqual(['Epic.md']);
		expect(Object.keys(stored())).toHaveLength(1);
		expect(Object.values(stored())[0].base).toBe('Archive/New.base');
	});

	it('carries a view name that contains the key separator', () => {
		vault.addFile('Old.base');
		save('Old.base', 'Sprint #3');

		vault.files.delete('Old.base');
		vault.addFile('New.base');
		rekeyBase(vault.app, 'Old.base', 'New.base');

		// The view name is recovered from the key, which only works because both
		// halves are encoded — the literal '#' is always the separator.
		const restored = loadViewState(vault.app, { base: 'New.base', view: 'Sprint #3' });
		expect(restored.folds.collapsed).toEqual(['Epic.md']);
	});

	it('moves every view of the renamed base and leaves other bases alone', () => {
		for (const path of ['Old.base', 'Other.base']) vault.addFile(path);
		save('Old.base', 'Planning');
		save('Old.base', 'Triage');
		save('Other.base', 'Planning');

		vault.files.delete('Old.base');
		vault.addFile('New.base');
		rekeyBase(vault.app, 'Old.base', 'New.base');

		const bases = Object.values(stored()).map((e) => e.base).sort();
		expect(bases).toEqual(['New.base', 'New.base', 'Other.base']);
		expect(loadViewState(vault.app, { base: 'New.base', view: 'Triage' }).folds.collapsed).toEqual(['Epic.md']);
	});

	it('does nothing when no entry names the old path', () => {
		vault.addFile('Other.base');
		save('Other.base', 'Backlog');
		const before = JSON.stringify(stored());

		rekeyBase(vault.app, 'Never.base', 'Whatever.base');
		expect(JSON.stringify(stored())).toBe(before);
	});
});

describe('rekeyBase across a folder move', () => {
	let vault: FakeVault;

	beforeEach(() => {
		vault = new FakeVault();
		vault.addFile('Epic.md');
	});

	function save(base: string): void {
		saveViewState(
			vault.app,
			{ base, view: 'Backlog' },
			{ folds: { collapsed: ['Epic.md'], expanded: [], lanes: [] }, prefs: {} },
		);
	}

	function stored(): Record<string, { base: string }> {
		return (vault.localStorage.get('product-backlog:view-state') ?? {}) as Record<string, { base: string }>;
	}

	it('carries a base that lived inside the renamed folder', () => {
		vault.addFile('Work/Backlog.base');
		save('Work/Backlog.base');

		// Obsidian reports the folder, not the base inside it.
		vault.files.delete('Work/Backlog.base');
		vault.addFile('Archive/Work/Backlog.base');
		rekeyBase(vault.app, 'Work', 'Archive/Work');

		const restored = loadViewState(vault.app, { base: 'Archive/Work/Backlog.base', view: 'Backlog' });
		expect(restored.folds.collapsed).toEqual(['Epic.md']);
	});

	it('is idempotent, so a second event for the same move changes nothing', () => {
		vault.addFile('Work/Backlog.base');
		save('Work/Backlog.base');
		vault.files.delete('Work/Backlog.base');
		vault.addFile('Archive/Work/Backlog.base');

		// Whether Obsidian reports a folder move once or once per descendant, the
		// second pass must find nothing left to move.
		rekeyBase(vault.app, 'Work', 'Archive/Work');
		const after = JSON.stringify(stored());
		rekeyBase(vault.app, 'Work/Backlog.base', 'Archive/Work/Backlog.base');
		expect(JSON.stringify(stored())).toBe(after);
	});

	it('leaves a base that merely shares a name prefix alone', () => {
		for (const path of ['Work/A.base', 'Workshop/B.base']) vault.addFile(path);
		save('Work/A.base');
		save('Workshop/B.base');

		rekeyBase(vault.app, 'Work', 'Archive');

		const bases = Object.values(stored()).map((e) => e.base).sort();
		expect(bases).toEqual(['Archive/A.base', 'Workshop/B.base']);
	});
});
