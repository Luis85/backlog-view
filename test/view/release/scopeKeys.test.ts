// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { active, makeReleaseView, press, RELEASE_CONFIG, refreshRelease, row, select, twisty } from '../../helpers/release';
import { useViewHarness } from '../../helpers/view';
import { FakeVault } from '../../helpers/vault';

/**
 * The scope tree's keyboard (`scopeKeys.ts`, Task 4): one tab stop on `.pbl-tree`, a
 * roving `aria-activedescendant`, and the four arrow behaviours — down/up between
 * VISIBLE rows, right steps in (or unfolds a closed row), left steps out (or folds an
 * open row) — plus Enter/Space to open. `scopeTree.test.ts` covers the disclosure and
 * the fold set the keyboard drives; this file is the keyboard itself.
 *
 * `keysVault()` is its own fixture rather than `foldVault()`'s (`scopeTree.test.ts`'s
 * own): the walk needs a parent with a PRECEDING sibling before the row under test, so
 * "step out to the nearest shallower row" has something other than its own direct parent
 * to disprove finding — a shape none of the other release fixtures needed.
 */
function keysVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Releases/0.8.md', { frontmatter: { type: 'Release', version: '0.8.0' } });
	// The context ancestor — not itself a member — with three member Features under it,
	// in ORDER: a leading one with no children (so the walk has a row to skip over on the
	// way to Passwordless sign-in), the one under test, and the sibling that follows its
	// whole subtree.
	vault.addFile('Sign-up flow.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('Account setup.md', {
		frontmatter: { type: 'Feature', order: 1, release: '[[Releases/0.8]]' },
		parentLink: 'Sign-up flow',
	});
	vault.addFile('Passwordless sign-in.md', {
		frontmatter: { type: 'Feature', order: 2, release: '[[Releases/0.8]]' },
		parentLink: 'Sign-up flow',
	});
	vault.addFile('Send the magic link.md', {
		frontmatter: { type: 'Task', order: 1, release: '[[Releases/0.8]]' },
		parentLink: 'Passwordless sign-in',
	});
	vault.addFile('Verify the code.md', {
		frontmatter: { type: 'Task', order: 2, release: '[[Releases/0.8]]' },
		parentLink: 'Passwordless sign-in',
	});
	vault.addFile('Expire the link.md', {
		frontmatter: { type: 'Task', order: 3, release: '[[Releases/0.8]]' },
		parentLink: 'Passwordless sign-in',
	});
	vault.addFile('Session handling.md', {
		frontmatter: { type: 'Feature', order: 3, release: '[[Releases/0.8]]' },
		parentLink: 'Sign-up flow',
	});
	return vault;
}

function mountKeys(): ReturnType<typeof makeReleaseView> & { vault: FakeVault } {
	const vault = keysVault();
	const harness = makeReleaseView(vault, RELEASE_CONFIG);
	harness.view.pick('Releases/0.8.md');
	return { ...harness, vault };
}

describe('the scope tree’s keyboard', () => {
	useViewHarness();

	it('takes ONE tab stop, and the rows take none', () => {
		// A composite widget is one stop with a roving active descendant — `src/view/CLAUDE.md`.
		const { view } = mountKeys();
		const tree = view.viewEl.querySelector('.pbl-tree')!;
		expect(tree.getAttribute('tabindex')).toBe('0');
		expect(view.viewEl.querySelectorAll('.pbl-row[tabindex="0"]')).toHaveLength(0);
	});

	it('ArrowDown and ArrowUp move between VISIBLE rows only', () => {
		const { view } = mountKeys();
		press(view, 'ArrowDown');
		press(view, 'ArrowDown');
		expect(active(view)).toBe('Passwordless sign-in.md');
		twisty(view, 'Passwordless sign-in.md').click();
		press(view, 'ArrowDown');
		// The three Tasks are folded away, so the next visible row is the next Feature.
		expect(active(view)).toBe('Session handling.md');

		press(view, 'ArrowUp');
		expect(active(view)).toBe('Passwordless sign-in.md');
	});

	it('ArrowLeft folds an open row and steps out of a closed one', () => {
		const { view } = mountKeys();
		select(view, 'Passwordless sign-in.md');
		press(view, 'ArrowLeft');
		expect(row(view, 'Passwordless sign-in.md').getAttribute('aria-expanded')).toBe('false');
		press(view, 'ArrowLeft');
		expect(active(view)).toBe('Sign-up flow.md');
	});

	it('ArrowRight unfolds a closed row and steps in from an open one', () => {
		const { view } = mountKeys();
		select(view, 'Passwordless sign-in.md');
		press(view, 'ArrowLeft');
		press(view, 'ArrowRight');
		expect(row(view, 'Passwordless sign-in.md').getAttribute('aria-expanded')).toBe('true');
		press(view, 'ArrowRight');
		expect(active(view)).toBe('Send the magic link.md');
	});

	it('Enter opens the active row’s note', () => {
		const { view, vault } = mountKeys();
		select(view, 'Expire the link.md');
		press(view, 'Enter');
		expect(vault.opened.map((o) => o.path)).toEqual(['Expire the link.md']);
	});

	/**
	 * Not "moves to the next row": a leaf has nothing to step into, and moving would make
	 * Right mean two different things depending on where it landed. Watched failing per
	 * the repository's own rule for an asserted invariant — see the task report for what
	 * printed with the `else return;` branch changed to `moveTo(active + 1)`.
	 */
	it('ArrowRight on a leaf does nothing at all', () => {
		const { view } = mountKeys();
		select(view, 'Send the magic link.md');
		press(view, 'ArrowRight');
		expect(active(view)).toBe('Send the magic link.md');
	});

	it('keeps the tree focused across the redraw an unfold triggers, and the next arrow continues from there', () => {
		// `toggleFold` empties `viewEl` and rebuilds the controller from scratch — without
		// the restore's own focus carry, this drops focus to the body and stalls the
		// keyboard one press into the tree (`scopeKeys.ts`'s own comment on why).
		const { view } = mountKeys();
		select(view, 'Passwordless sign-in.md');
		view.viewEl.querySelector<HTMLElement>('.pbl-tree')!.focus();
		press(view, 'ArrowLeft');
		press(view, 'ArrowRight');
		expect(document.activeElement).toBe(view.viewEl.querySelector('.pbl-tree'));
		press(view, 'ArrowDown');
		expect(active(view)).toBe('Send the magic link.md');
	});

	it('Home and End jump to the first and last visible rows', () => {
		const { view } = mountKeys();
		press(view, 'End');
		expect(active(view)).toBe('Session handling.md');
		press(view, 'Home');
		expect(active(view)).toBe('Sign-up flow.md');
	});

	it('an unhandled key changes nothing and is not swallowed', () => {
		const { view } = mountKeys();
		select(view, 'Passwordless sign-in.md');
		const evt = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
		view.viewEl.querySelector<HTMLElement>('.pbl-tree')!.dispatchEvent(evt);
		// Unhandled keys reach the pane — `scopeKeys.ts`'s own comment on why there is no
		// `preventDefault` on this path.
		expect(evt.defaultPrevented).toBe(false);
		expect(active(view)).toBe('Passwordless sign-in.md');
	});

	it('ArrowUp at the first row does nothing — the walk holds the edge rather than wrapping', () => {
		const { view } = mountKeys();
		select(view, 'Sign-up flow.md');
		press(view, 'ArrowUp');
		expect(active(view)).toBe('Sign-up flow.md');
	});

	it('ArrowLeft on the topmost closed row does nothing further — there is no shallower row to step out to', () => {
		const { view } = mountKeys();
		select(view, 'Sign-up flow.md');
		press(view, 'ArrowLeft');
		expect(row(view, 'Sign-up flow.md').getAttribute('aria-expanded')).toBe('false');
		press(view, 'ArrowLeft');
		expect(active(view)).toBe('Sign-up flow.md');
	});

	it('a refresh that drops the active row focuses a surviving row, not the body', () => {
		const { view, vault } = mountKeys();
		select(view, 'Session handling.md');
		view.viewEl.querySelector<HTMLElement>('.pbl-tree')!.focus();

		vault.files.delete('Session handling.md');
		refreshRelease(view, vault);

		expect(document.activeElement).toBe(view.viewEl.querySelector('.pbl-tree'));
		expect(active(view)).not.toBeNull();
	});
});
