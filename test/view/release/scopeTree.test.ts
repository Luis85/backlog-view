// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountFoldScope, row, twisty } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';
import { foldedPaths, setAllFolds, toggleFold } from '../../../src/view/release/scopeTree';
import { ScopeRow } from '../../../src/domain/releases';

/**
 * The scope tree's own rows: the disclosure, the fold set and the two row figures the
 * design shows (`scopeTree.ts`). `test/view/releaseScopeRender.test.ts` covers the
 * header and the walk's own shape (depth, sibling position, badges); this file is what
 * changed once the tree could fold and a row could be clicked.
 */
describe('the scope tree', () => {
	useViewHarness();

	it('draws a disclosure on a row with children and a placeholder on a leaf', () => {
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const parent = row(view, 'Passwordless sign-in.md')!;
		expect(parent.querySelector('.pbl-twisty')).not.toBeNull();
		expect(parent.getAttribute('aria-expanded')).toBe('true');
		const leaf = row(view, 'Send the magic link.md')!;
		// The gutter is held so a level's titles share one x — but it announces nothing.
		expect(leaf.querySelector('.pbl-twisty-leaf')).not.toBeNull();
		expect(leaf.hasAttribute('aria-expanded')).toBe(false);
	});

	it('reopens a folded row whose note was RENAMED, and that is the accepted cost', () => {
		// Neither rename walk reaches these folds: `renamePathPrefs` walks PATH_PREFS
		// (`scope`, `release`) and no fold, and `ViewState.renamePath` migrates the
		// BACKLOG view's in-memory `collapsed`, which this view holds none of. Asserted so
		// the behaviour is stated rather than discovered — see `scopeTree.ts`'s own comment
		// for why a store-level fold walk is not worth duplicating `notePath`/`scopeOf`
		// into `storage/`.
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		twisty(view, 'Passwordless sign-in.md').click();
		vault.renameFile('Passwordless sign-in.md', 'Magic links.md');
		view.onDataUpdated();
		expect(row(view, 'Magic links.md')!.getAttribute('aria-expanded')).toBe('true');
	});

	it('folds the same ancestor independently in two releases', () => {
		// Two questions about one item — `TIMELINE_SCOPE`'s own reason. A bare-path key
		// gives them one bit, so folding an Epic in 0.8 would collapse it in 0.9 too.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		twisty(view, 'Sign-up flow.md').click();
		view.pick('Releases/0.9.md');
		expect(row(view, 'Sign-up flow.md')!.getAttribute('aria-expanded')).toBe('true');
		view.pick('Releases/0.8.md');
		expect(row(view, 'Sign-up flow.md')!.getAttribute('aria-expanded')).toBe('false');
	});

	it('folding hides the descendants and persists across a data update, and a second click reopens it', () => {
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		twisty(view, 'Passwordless sign-in.md').click();
		expect(row(view, 'Send the magic link.md', { optional: true })).toBeNull();
		expect(row(view, 'Passwordless sign-in.md')!.getAttribute('aria-expanded')).toBe('false');
		view.onDataUpdated();
		expect(row(view, 'Send the magic link.md', { optional: true })).toBeNull();
		// The other half of `toggleFold` — closing what a first click opened, folded here
		// with an existing fold already stored, is what covers `writeFolds` carrying every
		// OTHER release's key forward through a non-empty list rather than an empty one.
		twisty(view, 'Passwordless sign-in.md').click();
		expect(row(view, 'Send the magic link.md', { optional: true })).not.toBeNull();
		expect(row(view, 'Passwordless sign-in.md')!.getAttribute('aria-expanded')).toBe('true');
	});

	it('toggleFold flips one path in one release’s own set', () => {
		// The disclosure's own click handler calls this directly — driven here through the
		// same function the click reaches, rather than only through the button, so a caller
		// outside the click (a future keyboard shortcut, Task 5's own bulk control) has one
		// function to reach for rather than a DOM click nothing else in this plugin fakes.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		expect(foldedPaths(view, 'Releases/0.8.md').has('Passwordless sign-in.md')).toBe(false);
		toggleFold(view, 'Releases/0.8.md', 'Passwordless sign-in.md');
		expect(foldedPaths(view, 'Releases/0.8.md').has('Passwordless sign-in.md')).toBe(true);
		toggleFold(view, 'Releases/0.8.md', 'Passwordless sign-in.md');
		expect(foldedPaths(view, 'Releases/0.8.md').has('Passwordless sign-in.md')).toBe(false);
	});

	it('setAllFolds folds or unfolds every row THIS scope drew, scoped to its release', () => {
		// Task 5's own control, exercised directly here since nothing on screen calls it
		// yet — `drawScopeTree`'s own rows, not a hand-built fixture, so the paths are
		// exactly what a real "collapse all" would fold.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const scopeRows: ScopeRow[] = ['Passwordless sign-in.md', 'Send the magic link.md', 'Expire the link.md'].map(
			(path) => ({ item: { file: { path } } }) as unknown as ScopeRow,
		);
		setAllFolds(view, 'Releases/0.8.md', scopeRows, true);
		expect(foldedPaths(view, 'Releases/0.8.md')).toEqual(
			new Set(['Passwordless sign-in.md', 'Send the magic link.md', 'Expire the link.md']),
		);
		setAllFolds(view, 'Releases/0.8.md', scopeRows, false);
		expect(foldedPaths(view, 'Releases/0.8.md').size).toBe(0);
	});

	it('keeps a folded parent’s own rollup', () => {
		// The rollup is over the subtree, never over what is drawn: folding is a render
		// decision and must not change a number.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const before = row(view, 'Passwordless sign-in.md')!.querySelector('.pbl-progress-label')!.textContent;
		twisty(view, 'Passwordless sign-in.md').click();
		expect(row(view, 'Passwordless sign-in.md')!.querySelector('.pbl-progress-label')!.textContent).toBe(before);
	});

	it('a click on the row opens the note; a click on the disclosure does not', () => {
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		row(view, 'Expire the link.md')!.click();
		expect(vault.opened.map((o) => o.path)).toEqual(['Expire the link.md']);
		twisty(view, 'Passwordless sign-in.md').click();
		expect(vault.opened.map((o) => o.path)).toEqual(['Expire the link.md']);
	});

	it('a context row carries no rollup or state chip, folded or not', () => {
		// The context-row rule: it renders, it parents, and that is all.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const el = row(view, 'Sign-up flow.md')!;
		expect(el.querySelector('.pbl-progress')).toBeNull();
		expect(el.querySelector('.pbl-state-chip')).toBeNull();
	});

	it('forgets nothing when the base is embedded — the pick’s own asymmetry', () => {
		// No view identity, so folds are session-only rather than absent: they survive a
		// data update in the session and are gone on remount, exactly as `pickedPath` is.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md', embedded: true });
		twisty(view, 'Passwordless sign-in.md').click();
		view.onDataUpdated();
		expect(row(view, 'Send the magic link.md', { optional: true })).toBeNull();
	});
});
