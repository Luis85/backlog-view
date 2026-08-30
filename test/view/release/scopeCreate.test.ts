// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Menu, Modal, Notice } from '../../helpers/obsidian-mock';
import { en } from '../../../src/i18n/en';
import { makeReleaseView, mountFoldScope, refreshRelease, RELEASE_CONFIG, row, select } from '../../helpers/release';
import { flush, submitPrompt, useViewHarness } from '../../helpers/view';
import { FakeVault } from '../../helpers/vault';

/**
 * The scope tree's row menu and the one note it creates (`src/view/release/scopeCreate.ts`).
 *
 * The claim under it is the release view's own, narrowed once more: this screen creates a
 * note and never edits one. `test/view/releaseNeverEdits.test.ts` is where that is asserted
 * at the forbidden CALLS; what this file asserts is the vault after the real gesture, which
 * is the join those spies cannot see — a well-formed create that wrote the wrong properties
 * would leave every spy there green.
 */
describe('creating a child from a release scope row', () => {
	useViewHarness();

	/** Right-click a row and hand back the menu it opened, or fail naming the row. */
	function openMenu(view: { viewEl: HTMLElement }, path: string): Menu {
		Menu.lastShown = null;
		const rowEl = row(view as never, path)!;
		rowEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		if (!Menu.lastShown) throw new Error(`no menu opened on ${path}`);
		return Menu.lastShown;
	}

	const titles = (menu: Menu): string[] => menu.items.map((item) => item.titleText);

	/** The open prompt's detail line \u2014 where the folder the note will land in is
	 *  named, which is the only place the reader sees it before the note exists. */
	function promptDetail(): string {
		const el = Modal.lastOpened?.contentEl.querySelector('.pbl-modal-detail');
		if (!el) throw new Error('prompt has no detail line');
		return el.textContent ?? '';
	}

	/** Everything the run put in the vault that was not there before. */
	function created(vault: FakeVault, before: Set<string>): { path: string; fm: Record<string, unknown> }[] {
		return [...vault.files.keys()]
			.filter((path) => !before.has(path))
			.map((path) => ({ path, fm: vault.frontmatter.get(path) ?? {} }));
	}

	/**
	 * A vault whose two subtrees are ranked the OLD way — one sequence per sibling group —
	 * so `Ledger`'s children end at 2 exactly as `Sign-in`'s do, and a rank read off the
	 * parent's own children alone answers the same number for both. `Reconcile` already
	 * holds that number, which is what makes the collision a fact of this fixture rather
	 * than a hypothetical.
	 */
	function collidingVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0', order: 10 } });
		vault.addFile('Sign-in.md', { frontmatter: { type: 'Epic', order: 20, release: '[[R]]' } });
		vault.addFile('Magic link.md', { frontmatter: { type: 'Task', order: 1, release: '[[R]]' }, parentLink: 'Sign-in' });
		vault.addFile('Expiry.md', { frontmatter: { type: 'Task', order: 2, release: '[[R]]' }, parentLink: 'Sign-in' });
		vault.addFile('Ledger.md', { frontmatter: { type: 'Epic', order: 30, release: '[[R]]' } });
		// The number a sibling-scoped rank would hand the next child of `Sign-in`.
		vault.addFile('Reconcile.md', { frontmatter: { type: 'Task', order: 1002, release: '[[R]]' }, parentLink: 'Ledger' });
		return vault;
	}

	it('never ranks a new member onto a number another subtree already holds', async () => {
		const vault = collidingVault();
		const { view } = makeReleaseView(vault, RELEASE_CONFIG);
		view.pick('R.md');
		const before = new Set(vault.files.keys());

		const menu = openMenu(view, 'Sign-in.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		submitPrompt({ title: 'Passkeys' });
		await flush();

		// Either a free rank or no note at all — never `Reconcile`'s 1002, which is what a
		// rank read off the parent's own children answers here. A duplicate is what drops a
		// focused view back to tree order and makes every later placement at that site
		// refuse, and this screen has no ✨ to undo it with.
		const taken = [...before].map((path) => vault.fm(path)['order']);
		for (const note of created(vault, before)) expect(taken).not.toContain(note.fm.order);
	});

	it('offers one New entry per type the row may hold, and nothing that edits the row', () => {
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		// An `Epic` on the plan's ladder: its child rung is `Feature`, plus the extra types
		// that hang from one. Whatever `childTypeChoices` answers, EVERY entry is a create —
		// the whole of what this screen may do to a note that already exists is nothing.
		const menu = openMenu(view, 'Passwordless sign-in.md');
		expect(menu.items.length).toBeGreaterThan(0);
		expect(titles(menu).every((title) => title.startsWith('New '))).toBe(true);
	});

	it('creates the child under the row, in this release, with a rank past its siblings', async () => {
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const before = new Set(vault.files.keys());

		const menu = openMenu(view, 'Passwordless sign-in.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		submitPrompt({ title: 'Passkey sign-in' });
		await flush();

		const notes = created(vault, before);
		expect(notes.length).toBe(1);
		// The parent link, the type and the rank are the ordinary creation; `release` is what
		// this surface adds, and without it the row the gesture was made from would draw no
		// new child at all — membership never cascades from a parent.
		expect(notes[0].fm.type).toBe('Feature');
		expect(notes[0].fm.parent).toBe('[[Passwordless sign-in]]');
		// The link is the SHORTEST unambiguous one Obsidian would write, which is what
		// `wikilinkTo` produces — a path here would be asserting the fixture rather than the
		// write.
		expect(notes[0].fm.release).toBe('[[0.8]]');
		// `Send the magic link` and `Expire the link` are ranked 1 and 2 and the next row in
		// the ranked POPULATION is `Releases/0.8` at 10, so the new child lands between the
		// two — past both siblings, and not on top of the release note either. A rank read
		// off the siblings alone would have answered 1002 and jumped the whole population.
		expect(notes[0].fm.order).toBe(6);

		// The claim the membership seed exists FOR: the note the gesture made is a member of
		// the open release, so the next pass draws it under the row it was created from.
		refreshRelease(view, vault);
		expect(row(view, notes[0].path, { optional: true })).not.toBeNull();
	});

	it('creates under a CONTEXT row too, which is the one write a non-member may take', async () => {
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const before = new Set(vault.files.keys());

		// `Sign-up flow` is drawn only to place the member beneath it. The rule is the backlog
		// menu's: `New <child>` writes a DIFFERENT note, so it is fair game on a row every
		// editing action is withheld from — and the note it writes joins THIS release.
		const menu = openMenu(view, 'Sign-up flow.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		submitPrompt({ title: 'Social sign-up' });
		await flush();

		const notes = created(vault, before);
		expect(notes.length).toBe(1);
		expect(notes[0].fm.parent).toBe('[[Sign-up flow]]');
		expect(notes[0].fm.release).toBe('[[0.8]]');
		// The row itself is untouched: creating a child is not editing the parent.
		expect(vault.writeLog.length).toBe(0);
	});

	it('opens the same menu from the keyboard, on the row the roving selection marks', () => {
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		select(view, 'Send the magic link.md');
		Menu.lastShown = null;

		const treeEl = view.viewEl.querySelector<HTMLElement>('.pbl-tree')!;
		treeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));

		// A `Task` is the bottom rung of the plan's ladder, so it offers no rung below — but
		// the extra types still hang from it, which is what makes this a menu rather than
		// nothing. What is asserted is that the KEYBOARD reached the same builder: without
		// this listener the menu is a pointer-only affordance on a `tabindex="-1"` tree.
		expect(Menu.lastShown).not.toBeNull();
	});

	it('draws no menu on a row that can hold nothing, rather than an empty one', () => {
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		Menu.lastShown = null;
		// The release note itself is a marker and holds no child. It is not a scope ROW, so
		// the gesture that reaches nothing here is a right-click on the tree's own padding —
		// which must leave the pane's own menu alone rather than opening an empty one.
		const treeEl = view.viewEl.querySelector<HTMLElement>('.pbl-tree')!;
		const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
		treeEl.dispatchEvent(evt);
		expect(Menu.lastShown).toBeNull();
		expect(evt.defaultPrevented).toBe(false);
	});

	it('refuses before the prompt when the view options collide', async () => {
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		// Two roles on one key is what `configProblems` reports, and creation writes
		// frontmatter like every other write path — so it is refused at the press rather than
		// after the user has typed a title.
		view.config.set('orderProperty', 'note.type');
		view.onDataUpdated();
		const before = new Set(vault.files.keys());
		Notice.messages.length = 0;

		const menu = openMenu(view, 'Passwordless sign-in.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		await flush();

		expect(Notice.messages.length).toBe(1);
		expect(created(vault, before)).toEqual([]);
	});

	it('files the child by its TYPE, falling back to the parent row\u2019s own folder', async () => {
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const before = new Set(vault.files.keys());

		// Every shipped type has a default folder, so the ordinary answer is the type's own —
		// a `Feature` files itself under the requirements folder from this screen exactly as
		// it does from the backlog's own `New <child>`.
		let menu = openMenu(view, 'Passwordless sign-in.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		submitPrompt({ title: 'Typed' });
		await flush();
		expect(created(vault, before)[0].path).toBe('docs/requirements/Typed.md');

		// Cleared by hand, the fallback is the row's OWN folder rather than the vault root:
		// the work goes where the work it hangs from lives.
		// Ranked like every other note in the fixture: an unranked PARENT is an anchor the
		// placement refuses against, so a blank here would test the refusal rather than the
		// folder this test is about.
		vault.addFile('Filed/Owned.md', { frontmatter: { type: 'Epic', order: 50, release: '[[Releases/0.8]]' } });
		refreshRelease(view, vault);
		view.config.set('typeFolder.feature', '');
		view.onDataUpdated();
		const beforeSecond = new Set(vault.files.keys());

		menu = openMenu(view, 'Filed/Owned.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		expect(promptDetail()).toBe('Under "Owned" \u00b7 in folder "Filed"');
		submitPrompt({ title: 'Beside its parent' });
		await flush();
		expect(created(vault, beforeSecond)[0].path).toBe('Filed/Beside its parent.md');

		// And the row at the vault ROOT, which is the layout this plugin ships as its
		// default \u2014 a flat folder of notes, so the fallback's own fallback is the
		// commonest case rather than an edge. Obsidian spells a root file's parent `/`, and
		// a folder of `/` handed to the creator would file the note in a folder LITERALLY
		// named that; the empty string is the root, and the detail line has to say so rather
		// than naming a folder the reader would not recognise.
		const beforeThird = new Set(vault.files.keys());
		menu = openMenu(view, 'Passwordless sign-in.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		expect(promptDetail()).toBe('Under "Passwordless sign-in" \u00b7 in the vault root');
		submitPrompt({ title: 'At the root' });
		await flush();
		expect(created(vault, beforeThird)[0].path).toBe('At the root.md');
	});

	it('reports a creation that failed, and leaves the fold alone', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		(vault.app.vault as { create: unknown }).create = async () => {
			throw new Error('disk full');
		};
		Notice.messages.length = 0;

		const menu = openMenu(view, 'Passwordless sign-in.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		submitPrompt({ title: 'Doomed' });
		await flush();

		expect(Notice.messages).toEqual([en['create.failed']]);
	});

	it('refuses when the release stopped being one while the title was being typed', async () => {
		const { view, vault } = mountFoldScope({ pick: 'Releases/0.8.md' });
		const before = new Set(vault.files.keys());

		const menu = openMenu(view, 'Passwordless sign-in.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		// The prompt is open — the longest window this plugin has, since it lasts as long as
		// the reader takes to type — and another pane retypes the release. Authorization at
		// plan time is not authorization at write time, which is the finding PR #201 made
		// against the EDIT path and PR #214 made against this one.
		vault.addFile('Releases/0.8.md', { frontmatter: { type: 'Epic' } });
		Notice.messages.length = 0;
		submitPrompt({ title: 'Too late' });
		await flush();

		expect(created(vault, before)).toEqual([]);
		expect(Notice.messages).toEqual([en['release.scope.staleRelease']]);
	});

	it('offers no create on a test-catalog context row, whose children could not be members', () => {
		// Reachable, and this is the fixture that shows it: `ladderFor` chains off the parent
		// for a `Task` and a typeless note ALONE, so an `Epic` parented under a `Test suite`
		// stays on the plan's ladder and can be a release member — which draws its catalog
		// ancestor above it as a context row. `childTypeChoices` then offers that row its own
		// catalog child, and `mayHoldField(type, 'release')` refuses every one of them, so the
		// note would be created carrying a release link its own reader reports as unresolved
		// and vanish from the screen it was made on. Found by review (Codex, PR #214).
		const vault = new FakeVault();
		vault.addFile('Releases/0.8.md', { frontmatter: { type: 'Release', version: '0.8.0' } });
		vault.addFile('Suite.md', { frontmatter: { type: 'Test suite' } });
		vault.addFile('Epic under suite.md', {
			frontmatter: { type: 'Epic', release: '[[Releases/0.8]]' },
			parentLink: 'Suite',
		});
		const { view } = makeReleaseView(vault, RELEASE_CONFIG, { base: 'Releases.base' });
		view.pick('Releases/0.8.md');

		// The context row IS drawn — the guard has to be about what it offers, not about
		// whether the row is there.
		const suiteEl = row(view, 'Suite.md')!;
		Menu.lastShown = null;
		suiteEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		expect(Menu.lastShown).toBeNull();

		// The member below it still offers its own, so this withholds one row rather than
		// the feature.
		expect(titles(openMenu(view, 'Epic under suite.md'))).toContain('New Feature');

		// And the KEYBOARD leaves the chord alone there for the same reason the pointer
		// leaves the right-click alone: a reader on a row with no menu of ours must still
		// reach the pane's own, so the event is consumed only once there is one to show.
		select(view, 'Suite.md');
		Menu.lastShown = null;
		const chord = new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true });
		view.viewEl.querySelector<HTMLElement>('.pbl-tree')!.dispatchEvent(chord);
		expect(Menu.lastShown).toBeNull();
		expect(chord.defaultPrevented).toBe(false);
	});

	it('opens nothing from the keyboard before the tree has an active row', () => {
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		Menu.lastShown = null;
		// Nothing has moved the roving selection yet, so there is no row the menu would be
		// about — and a menu anchored to the first row would be about a row the reader did
		// not choose.
		const treeEl = view.viewEl.querySelector<HTMLElement>('.pbl-tree')!;
		treeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
		expect(Menu.lastShown).toBeNull();

		// And a plain F10 is not the chord: it belongs to the pane, not to this listener.
		// The tree is re-queried because `select` re-renders and detaches the one above —
		// dispatching at the stale element would assert nothing.
		select(view, 'Send the magic link.md');
		view.viewEl
			.querySelector<HTMLElement>('.pbl-tree')!
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', bubbles: true, cancelable: true }));
		expect(Menu.lastShown).toBeNull();
	});

	it('unfolds the parent it created under, so the new child is not written out of sight', async () => {
		const { view } = mountFoldScope({ pick: 'Releases/0.8.md' });
		row(view, 'Passwordless sign-in.md')!.querySelector<HTMLElement>('.pbl-twisty')!.click();
		expect(row(view, 'Passwordless sign-in.md')!.getAttribute('aria-expanded')).toBe('false');

		const menu = openMenu(view, 'Passwordless sign-in.md');
		menu.items.find((item) => item.titleText === 'New Feature')!.click();
		submitPrompt({ title: 'Passkey sign-in' });
		await flush();

		expect(row(view, 'Passwordless sign-in.md')!.getAttribute('aria-expanded')).toBe('true');
	});
});
