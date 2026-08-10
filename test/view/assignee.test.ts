// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu, Modal } from '../helpers/obsidian-mock';
import { ProductBacklogView } from '../../src/view/backlogView';
import { clickExpandAll, flush, makeView, rowByTitle, submitButton, useViewHarness } from '../helpers/view';

useViewHarness();

/** The one option this feature needs — a key, and nothing beside it. */
const configured = { assigneeProperty: 'note.assignee' };

/** Open the row menu and return the Set assignee submenu, or null when the entry is absent. */
function assigneeMenu(containerEl: HTMLElement, title: string): Menu | null {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	return Menu.lastShown?.item('Set assignee')?.submenu ?? null;
}

/** A backlog whose notes name people, which is where this menu's vocabulary comes from. */
function assignedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, assignee: 'Sam' } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 10, assignee: 'Alex' }, parentLink: 'Epic B' });
	return vault;
}

describe('Set assignee', () => {
	it('offers the names the results carry, alphabetically, and writes the one picked', async () => {
		const vault = assignedVault();
		const { containerEl } = makeView(vault, configured);

		const menu = assigneeMenu(containerEl, 'Epic A');
		if (!menu) throw new Error('Set assignee missing');
		// The observed vocabulary, then the way to add to it. Nothing is checked while
		// the note names nobody: absence is a value, and checking a name would report an
		// assignment nobody made.
		expect(menu.items.map((i) => i.titleText)).toEqual(['Alex', 'Sam', 'New assignee...']);
		expect(menu.items.some((i) => i.checked)).toBe(false);

		menu.item('Sam')?.click();
		await flush();

		expect(vault.fm('Epic A.md')['assignee']).toBe('Sam');
	});

	it('checks the name the item holds, and re-picking it writes nothing', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'sam' } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, assignee: 'Alex' } });
		const { containerEl } = makeView(vault, configured);

		const menu = assigneeMenu(containerEl, 'Epic A');
		// Case-insensitively: the note's own spelling is not a different person.
		expect(menu?.item('sam')?.checked).toBe(true);
		expect(menu?.item('Alex')?.checked).toBe(false);

		menu?.item('sam')?.click();
		await flush();

		// Untouched, spelling included — a re-pick must not spend the one undo slot, and
		// must not tidy a value the user wrote.
		expect(vault.fm('Epic A.md')['assignee']).toBe('sam');
	});

	it('offers a name only this note carries, so the current one always renders checked', () => {
		const vault = assignedVault();
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 30, assignee: 'Robin' } });
		const { containerEl } = makeView(vault, configured);

		// Robin is observed BECAUSE Epic C is a result — the vocabulary is the base's,
		// not the row's — so the interesting half is that the row's own value is in the
		// list whether or not anything else names it.
		expect(assigneeMenu(containerEl, 'Epic C')?.item('Robin')?.checked).toBe(true);
	});

	it('never offers a name only a context row carries', () => {
		// The rule the whole vocabulary module states once: an excluded note's value is
		// not this base's vocabulary. Offering it would make a name assignable to every
		// result because an ancestor nobody can act on happened to use it.
		const vault = assignedVault();
		vault.addFile('Retired.md', { frontmatter: { type: 'Epic', order: 40, assignee: 'Ghost' } });
		// A result hanging from it, or the excluded note is never loaded at all and this
		// would assert nothing — the row has to be ON SCREEN for its value to be the
		// thing being refused.
		vault.addFile('Feature R1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Retired' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig(configured);
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Retired.md') };
		view.onDataUpdated();
		clickExpandAll(containerEl);

		expect(view.model?.byPath.get('Retired.md')?.outsideFilter).toBe(true);
		expect(view.model?.observedAssignees).toEqual(['Alex', 'Sam']);
		expect(assigneeMenu(containerEl, 'Epic A')?.items.map((i) => i.titleText)).not.toContain('Ghost');
	});

	it('takes a name nobody carries yet, typed into the prompt', async () => {
		const vault = assignedVault();
		const { containerEl } = makeView(vault, configured);

		assigneeMenu(containerEl, 'Epic A')?.item('New assignee...')?.click();
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('assignee prompt not opened');
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('assignee prompt has no field');

		// Blank submits nothing: the prompt is the way to add a name, not a way to
		// write one nobody typed.
		submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		expect(vault.fm('Epic A.md')['assignee']).toBeUndefined();

		input.value = '  Robin  ';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// Trimmed on the way in: the padding is not part of the name, and an untrimmed
		// one would never match the same person picked from the list afterwards.
		expect(vault.fm('Epic A.md')['assignee']).toBe('Robin');
	});

	it('is offered with a key and nothing observed, which is why the chip needs no vocabulary', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, configured);

		// The whole reason this property is gated on the key alone: New assignee... is
		// always there, so the menu can never open onto nothing the way a risk menu with
		// its levels cleared would.
		expect(assigneeMenu(containerEl, 'Epic A')?.items.map((i) => i.titleText)).toEqual(['New assignee...']);
	});

	it('is absent when no assignee property is named', () => {
		const { containerEl } = makeView(assignedVault(), {});

		expect(assigneeMenu(containerEl, 'Epic A')).toBeNull();
	});

	it('clears the key only where the note carries one', async () => {
		const vault = assignedVault();
		const { containerEl } = makeView(vault, configured);

		// Presence, not value: Epic A names nobody and has no key, so there is nothing
		// to take away and no entry offering to.
		expect(assigneeMenu(containerEl, 'Epic A')?.item('Clear assignee')).toBeUndefined();

		assigneeMenu(containerEl, 'Epic B')?.item('Clear assignee')?.click();
		await flush();

		// The key goes rather than being blanked — unassigned is a state a note returns
		// to, and a blank would read as somebody called nothing.
		expect('assignee' in vault.fm('Epic B.md')).toBe(false);
	});
});

describe('the assignee chip', () => {
	/** Show the assignee property as a column, which is what draws a chip at all. */
	function chipView(vault: FakeVault) {
		const { containerEl, config, view } = makeView(vault, configured);
		config.order = ['note.assignee'];
		view.onDataUpdated();
		clickExpandAll(containerEl);
		return { containerEl, view };
	}

	function chip(containerEl: HTMLElement, title: string): HTMLElement | null {
		return rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-assignee-chip');
	}

	it('names who is on it, and invites a name where nobody is', () => {
		const { containerEl } = chipView(assignedVault());

		expect(chip(containerEl, 'Epic B')?.textContent).toBe('Sam');
		// Unset is an invitation rather than a placement to name, so it says what could
		// go there and wears the dashed border the other unset chips do.
		const unset = chip(containerEl, 'Epic A');
		expect(unset?.textContent).toBe('Assignee');
		expect(unset?.hasClass('pbl-assignee-unset')).toBe(true);
	});

	it('opens the same list the row menu offers', async () => {
		const vault = assignedVault();
		const { containerEl } = chipView(vault);

		chip(containerEl, 'Epic A')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Alex', 'Sam', 'New assignee...']);

		Menu.lastShown?.item('Alex')?.click();
		await flush();
		expect(vault.fm('Epic A.md')['assignee']).toBe('Alex');
	});

	it('renders a context row\'s name as a static chip, and offers nothing', () => {
		const vault = assignedVault();
		vault.addFile('Retired.md', { frontmatter: { type: 'Epic', order: 40, assignee: 'Ghost' } });
		vault.addFile('Feature R1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Retired' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		const config = new FakeViewConfig(configured);
		config.order = ['note.assignee'];
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Retired.md') };
		view.onDataUpdated();
		clickExpandAll(containerEl);

		const shown = chip(containerEl, 'Retired');
		expect(shown?.textContent).toBe('Ghost');
		expect(shown?.hasClass('pbl-state-static')).toBe(true);
		expect(shown?.tagName).toBe('DIV');
	});
});
