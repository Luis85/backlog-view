// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FoldHost, foldedPaths, scopeFlag, setAllFolds, setScopeFlag, toggleFold } from '../../src/view/scopeFolds';
import { MYWORK_FOLD } from '../../src/storage/foldKeys';
import { ScopeRow } from '../../src/domain/scopeRows';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault, mountLeaf } from '../helpers/vault';

installObsidianDom();

/**
 * The shared fold set `src/view/scopeFolds.ts` owns — the same three questions
 * `test/view/release/scopeTree.test.ts` already asks of the release's own copy, asked
 * here of a host that is not a release view at all, so the release tree keeping its own
 * tests green (unmodified) is what proves the extraction changed nothing about it.
 */

const PREFIX = MYWORK_FOLD;

function makeHost(vault: FakeVault, { identity = true }: { identity?: boolean } = {}): FoldHost {
	// `mountLeaf` with no base registers no leaf, which is exactly what makes
	// `resolveViewIdentity` answer null — the embedded-base case this module falls back
	// to a session-only set for.
	const viewEl = mountLeaf(vault, identity ? 'Plan.base' : undefined);
	return { app: vault.app, viewEl, config: { name: 'My work' }, render: () => {} };
}

describe('a fold set shared by scope', () => {
	it('folds a row under one scope without folding it under another', () => {
		const vault = new FakeVault();
		const host = makeHost(vault);

		toggleFold(host, PREFIX, 'People/Ada.md', 'Feature.md');

		expect([...foldedPaths(host, PREFIX, 'People/Ada.md')]).toEqual(['Feature.md']);
		expect([...foldedPaths(host, PREFIX, 'People/Bo.md')]).toEqual([]);
	});

	it('writes no key for a leaf when collapsing everything', () => {
		const vault = new FakeVault();
		const host = makeHost(vault);
		const rows: ScopeRow[] = [
			{ item: { file: { path: 'Feature.md' } }, depth: 0 },
			{ item: { file: { path: 'Task.md' } }, depth: 1 },
		].map((row) => row as unknown as ScopeRow);

		setAllFolds(host, PREFIX, 'People/Ada.md', rows, true);

		// `Task.md` is a leaf here — no disclosure to close, so no key is spent on it.
		expect([...foldedPaths(host, PREFIX, 'People/Ada.md')]).toEqual(['Feature.md']);
	});

	it('falls back to a session-only set with no view identity', () => {
		// An embedded base: folds are gone on reload, and the tree is one press from reopening.
		const vault = new FakeVault();
		const host = makeHost(vault, { identity: false });

		toggleFold(host, PREFIX, 'People/Ada.md', 'Feature.md');
		expect([...foldedPaths(host, PREFIX, 'People/Ada.md')]).toEqual(['Feature.md']);

		// A fresh host stands in for the remount a reload would be — `sessionFolds` is a
		// `WeakMap` keyed on the host instance, so nothing here carries over.
		const reopened = makeHost(vault, { identity: false });
		expect([...foldedPaths(reopened, PREFIX, 'People/Ada.md')]).toEqual([]);
	});
});

describe('a scope flag shared by scope', () => {
	it('is off until set, per host, writing nothing for the default', () => {
		const vault = new FakeVault();
		const host = makeHost(vault);

		expect(scopeFlag(host, 'myWorkHideDone')).toBe(false);
		setScopeFlag(host, 'myWorkHideDone', true);
		expect(scopeFlag(host, 'myWorkHideDone')).toBe(true);
		setScopeFlag(host, 'myWorkHideDone', false);
		expect(scopeFlag(host, 'myWorkHideDone')).toBe(false);
	});

	it('falls back to a session-only flag with no view identity', () => {
		const vault = new FakeVault();
		const host = makeHost(vault, { identity: false });

		setScopeFlag(host, 'myWorkHideDone', true);
		expect(scopeFlag(host, 'myWorkHideDone')).toBe(true);

		const reopened = makeHost(vault, { identity: false });
		expect(scopeFlag(reopened, 'myWorkHideDone')).toBe(false);
	});
});
