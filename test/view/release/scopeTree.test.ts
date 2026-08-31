// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { active, mountFoldScope, row, twisty } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';
import { foldedPaths, hideDoneOn, setAllFolds, setHideDone, toggleFold } from '../../../src/view/release/scopeTree';
import { ScopeRow } from '../../../src/domain/releases';
import { loadViewState, renamePathFolds, saveViewState } from '../../../src/storage/viewStateStore';
import { resolveViewIdentity } from '../../../src/storage/viewIdentity';

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
		const parent = row(view, 'Passwordless sign-in.md');
		expect(parent.querySelector('.pbl-twisty')).not.toBeNull();
		expect(parent.getAttribute('aria-expanded')).toBe('true');
		const leaf = row(view, 'Send the magic link.md');
		// The gutter is held so a level's titles share one x — but it announces nothing.
		expect(leaf.querySelector('.pbl-twisty-leaf')).not.toBeNull();
		expect(leaf.hasAttribute('aria-expanded')).toBe(false);
	});

	it('carries a folded row through a rename of its own note', () => {
		// `renamePathFolds` is what reaches these keys: `renamePathPrefs` walks PATH_PREFS
		// (`scope`, `release`) and no fold, and `ViewState.renamePath` migrates the BACKLOG
		// view's in-memory `collapsed`, which this view holds none of — it reads and writes
		// `folds.collapsed` through the store directly. Driven here the way `main.ts` drives
		// it, since the vault event reaches the plugin and not this view.
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		twisty(view, 'Passwordless sign-in.md').click();

		vault.renameFile('Passwordless sign-in.md', 'Magic links.md');
		renamePathFolds(view.app, 'Passwordless sign-in.md', 'Magic links.md');
		view.onDataUpdated();

		expect(row(view, 'Magic links.md').getAttribute('aria-expanded')).toBe('false');
	});

	it('carries a folded row through a rename of the RELEASE its fold is scoped to', () => {
		// The key's FIRST half, which the backlog view's own walk never asked about: this
		// scope's key is `RELEASE_FOLD + <release> + NUL + <member>`, so renaming the
		// release note strands every fold in it unless that half moves too. Read under the
		// release's NEW path, which is where the reader will ask.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		twisty(view, 'Passwordless sign-in.md').click();

		renamePathFolds(view.app, 'Releases/0.8.md', 'Releases/0.8.1.md');

		expect([...foldedPaths(view, 'Releases/0.8.1.md')]).toEqual(['Passwordless sign-in.md']);
		expect(foldedPaths(view, 'Releases/0.8.md').size).toBe(0);
	});

	it('carries a folder move above the release, which is the only event a folder reports', () => {
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		twisty(view, 'Passwordless sign-in.md').click();

		renamePathFolds(view.app, 'Releases', 'Archive/Releases');

		expect([...foldedPaths(view, 'Archive/Releases/0.8.md')]).toEqual(['Passwordless sign-in.md']);
	});

	it('folds the same ancestor independently in two releases', () => {
		// Two questions about one item — `TIMELINE_SCOPE`'s own reason. A bare-path key
		// gives them one bit, so folding an Epic in 0.8 would collapse it in 0.9 too.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		twisty(view, 'Sign-up flow.md').click();
		view.pick('Releases/0.9.md');
		expect(row(view, 'Sign-up flow.md').getAttribute('aria-expanded')).toBe('true');
		view.pick('Releases/0.8.md');
		expect(row(view, 'Sign-up flow.md').getAttribute('aria-expanded')).toBe('false');
	});

	it('folding hides the descendants and persists across a data update, and a second click reopens it', () => {
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		twisty(view, 'Passwordless sign-in.md').click();
		expect(row(view, 'Send the magic link.md', { optional: true })).toBeNull();
		expect(row(view, 'Passwordless sign-in.md').getAttribute('aria-expanded')).toBe('false');
		view.onDataUpdated();
		expect(row(view, 'Send the magic link.md', { optional: true })).toBeNull();
		// The other half of `toggleFold` — closing what a first click opened, folded here
		// with an existing fold already stored, is what covers `writeFolds` carrying every
		// OTHER release's key forward through a non-empty list rather than an empty one.
		twisty(view, 'Passwordless sign-in.md').click();
		expect(row(view, 'Send the magic link.md', { optional: true })).not.toBeNull();
		expect(row(view, 'Passwordless sign-in.md').getAttribute('aria-expanded')).toBe('true');
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
		// yet — the real fixture's own shape (`Passwordless sign-in.md` a parent, its two
		// children leaves), not an arbitrary one, so `depth` says exactly what a real
		// "collapse all" would fold.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const scopeRows: ScopeRow[] = [
			{ item: { file: { path: 'Passwordless sign-in.md' } }, depth: 0 },
			{ item: { file: { path: 'Send the magic link.md' } }, depth: 1 },
			{ item: { file: { path: 'Expire the link.md' } }, depth: 1 },
		].map((row) => row as unknown as ScopeRow);
		setAllFolds(view, 'Releases/0.8.md', scopeRows, true);
		// Only the PARENT gets a key. A leaf has no disclosure to close, so a fold key for
		// one is a fold nothing can ever act on — and `folds.collapsed` spends from one
		// shared, CAPPED budget (`MAX_FOLDS`, `storage/viewStateStore.ts`) across every
		// scope this saved view holds, so a key that buys nothing still costs a slot a
		// real fold elsewhere could have used.
		expect(foldedPaths(view, 'Releases/0.8.md')).toEqual(new Set(['Passwordless sign-in.md']));
		setAllFolds(view, 'Releases/0.8.md', scopeRows, false);
		expect(foldedPaths(view, 'Releases/0.8.md').size).toBe(0);
	});

	it('keeps a fold made while the budget is already full', () => {
		// Another view's scope (a card projection, `CARD_SCOPE`'s own prefix) has already
		// spent the whole `MAX_FOLDS` budget by the time this release folds a row — the
		// exact shape `readFolds` is meant to survive: the fold just made must not be the
		// one an eviction throws away.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
		if (id === null) throw new Error('mountFoldScope always mounts with an identity');
		const state = loadViewState(view.app, id);
		const collapsed = Array.from({ length: 12000 }, (_, i) => `\u0000card:old-${i}.md`);
		saveViewState(view.app, id, { ...state, folds: { ...state.folds, collapsed } });

		twisty(view, 'Passwordless sign-in.md').click();

		expect(foldedPaths(view, 'Releases/0.8.md')).toContain('Passwordless sign-in.md');
	});

	it('keeps a folded parent’s own rollup', () => {
		// The rollup is over the subtree, never over what is drawn: folding is a render
		// decision and must not change a number.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const before = row(view, 'Passwordless sign-in.md').querySelector('.pbl-progress-label')!.textContent;
		twisty(view, 'Passwordless sign-in.md').click();
		expect(row(view, 'Passwordless sign-in.md').querySelector('.pbl-progress-label')!.textContent).toBe(before);
	});

	it('a click on the row opens the note; a click on the disclosure does not', () => {
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		row(view, 'Expire the link.md').click();
		expect(vault.opened.map((o) => o.path)).toEqual(['Expire the link.md']);
		twisty(view, 'Passwordless sign-in.md').click();
		expect(vault.opened.map((o) => o.path)).toEqual(['Expire the link.md']);
	});

	/**
	 * `src/view/CLAUDE.md`'s own stated rule: a middle click never fires `click` at all —
	 * the browser sends `auxclick` instead — so a surface wiring only the primary gesture
	 * silently loses "open in a new tab", exactly the way a milestone's diamond did before
	 * `wireOpenGestures` paired the two (`render/board.ts`). The disclosure is excluded by
	 * hand, since unlike its `click` handler it wires no `auxclick` of its own to stop one
	 * at with `stopPropagation`.
	 */
	it('a middle click opens the note in a new tab; the disclosure is exempt', () => {
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		row(view, 'Expire the link.md').dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));
		expect(vault.opened).toEqual([{ path: 'Expire the link.md', mode: 'tab' }]);

		twisty(view, 'Passwordless sign-in.md').dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));
		expect(vault.opened).toEqual([{ path: 'Expire the link.md', mode: 'tab' }]);
	});

	it('a right click through auxclick opens nothing — only the middle button does', () => {
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		row(view, 'Expire the link.md').dispatchEvent(new MouseEvent('auxclick', { button: 2, bubbles: true }));
		expect(vault.opened).toEqual([]);
	});

	it('a context row carries no rollup or state chip, folded or not', () => {
		// The context-row rule: it renders, it parents, and that is all.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const el = row(view, 'Sign-up flow.md');
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

	it('keeps focus in the tree when a disclosure is clicked with the mouse', () => {
		// `Sign-up flow.md` deliberately — the SECOND root row, not the first
		// (`Passwordless sign-in.md`): the fallback the restore takes when no path is
		// named lands on index 0, so clicking any other disclosure is what a
		// first-disclosure regression would fail on and clicking the first would not.
		//
		// A real mouse press focuses the button before the click handler runs; jsdom does
		// not, so the test says so explicitly rather than pretending the click alone did it.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const twistyEl = twisty(view, 'Sign-up flow.md');
		twistyEl.focus();
		twistyEl.click();

		const treeEl = view.viewEl.querySelector<HTMLElement>('.pbl-tree')!;
		expect(document.activeElement).toBe(treeEl);
		// And on the row that was clicked, not on the first row in the tree — the
		// first-disclosure bug this restore replaces would also leave focus on the tree.
		expect(active(view)).toBe('Sign-up flow.md');
	});

	it('persists the hide-done toggle through the identity-backed store, not merely the session', () => {
		// `mountFoldScope`'s default mount carries a `.base` identity (unlike
		// `test/view/release/scopeToolbar.test.ts`'s own `mountRelease`, which never does),
		// so this is what exercises `hideDoneOn`/`setHideDone`'s IDENTITY branch rather than
		// the session-only fallback every other test of the toggle already covers.
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		expect(hideDoneOn(view)).toBe(false);
		setHideDone(view, true);
		expect(hideDoneOn(view)).toBe(true);
		setHideDone(view, false);
		expect(hideDoneOn(view)).toBe(false);
	});
});
