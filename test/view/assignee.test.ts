// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fakeController, FakeVault, FakeViewConfig } from '../helpers/vault';
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

/**
 * A backlog with a roster of `Resource` notes, which is where this menu's vocabulary comes
 * from now — a note, never an observed string. Two items name Alex by two different
 * spellings of the same link, which is the menu's own checkmark question.
 */
function assignedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, assignee: '[[Sam]]' } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 10, assignee: '[[Alex]]' }, parentLink: 'Epic B' });
	return vault;
}

describe('Set assignee', () => {
	it('offers the resource notes the base returned, alphabetically, and writes the one picked', async () => {
		const vault = assignedVault();
		const { containerEl } = makeView(vault, configured);

		const menu = assigneeMenu(containerEl, 'Epic A');
		if (!menu) throw new Error('Set assignee missing');
		// The roster is the notes, sorted, then the way to make a new one. Nothing is
		// checked while the note names nobody: absence is a value, and checking a name
		// would report an assignment nobody made.
		expect(menu.items.map((i) => i.titleText)).toEqual(['Alex', 'Sam', 'New resource...']);
		expect(menu.items.some((i) => i.checked)).toBe(false);

		menu.item('Sam')?.click();
		await flush();

		expect(vault.fm('Epic A.md')['assignee']).toBe('[[Sam]]');
	});

	it('checks the note the item names, and a second spelling of it is not a second entry', async () => {
		const vault = assignedVault();
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 30, assignee: 'Alex' } });
		const { containerEl } = makeView(vault, configured);

		// `[[Alex]]` and the bare `Alex` both resolve to the one note, compared by PATH —
		// so the note's own spelling is not a different resource and there is one entry to
		// check, not two.
		const menu = assigneeMenu(containerEl, 'Epic C');
		expect(menu?.items.map((i) => i.titleText)).toEqual(['Alex', 'Sam', 'New resource...', 'Clear assignee']);
		expect(menu?.item('Alex')?.checked).toBe(true);

		menu?.item('Alex')?.click();
		await flush();

		// Untouched — a re-pick must not spend the one undo slot.
		expect(vault.fm('Epic C.md')['assignee']).toBe('Alex');
	});

	it('never offers a name only a context row carries', () => {
		// The rule the whole vocabulary module states once: an excluded note's value is
		// not this base's vocabulary. Offering it would make a name assignable to every
		// result because an ancestor nobody can act on happened to use it. A resource NOTE
		// the base never returned is refused for the same reason — it is never in
		// `model.resources` at all, so there is nothing here left to test beyond the
		// ordinary case above: the roster IS the results.
		const vault = assignedVault();
		vault.addFile('Retired.md', { frontmatter: { type: 'Epic', order: 40, assignee: '[[Sam]]' } });
		// A result hanging from it, or the excluded note is never loaded at all and this
		// would assert nothing — the row has to be ON SCREEN for its value to be the
		// thing being refused.
		vault.addFile('Feature R1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Retired' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView(fakeController(), containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig(configured);
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Retired.md') };
		view.onDataUpdated();
		clickExpandAll(containerEl);

		expect(view.model?.byPath.get('Retired.md')?.outsideFilter).toBe(true);
		// The roster is unaffected by the filter either way — it is the `Resource` notes
		// the base returned, not a vocabulary gathered off any one row.
		expect(assigneeMenu(containerEl, 'Epic A')?.items.map((i) => i.titleText)).toEqual(['Alex', 'Sam', 'New resource...']);
	});

	it('has no entry checked, and offers no entry, for an item carrying a leftover plain string', () => {
		// A name left over from before resources were notes, or a value that never
		// resolves — a fact to render (the chip marks it broken) rather than an option to
		// offer, since picking any entry here would not agree with what the note says.
		const vault = assignedVault();
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 30, assignee: 'Robin' } });
		const { containerEl } = makeView(vault, configured);

		const menu = assigneeMenu(containerEl, 'Epic C');
		expect(menu?.items.map((i) => i.titleText)).toEqual(['Alex', 'Sam', 'New resource...', 'Clear assignee']);
		expect(menu?.items.some((i) => i.checked)).toBe(false);
	});

	it('holds the disabled reason and New resource..., and still Clear assignee, with no resource note in the base', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, assignee: 'Robin' } });
		const { containerEl } = makeView(vault, configured);

		expect(assigneeMenu(containerEl, 'Epic A')?.items.map((i) => i.titleText)).toEqual([
			'No resources in this base',
			'New resource...',
		]);
		expect(assigneeMenu(containerEl, 'Epic A')?.item('No resources in this base')?.disabled).toBe(true);

		// An empty roster is exactly when a leftover value most needs clearing — gated on
		// presence independently of whether any resource is offered, or the note itself
		// would be the only way out.
		const withValue = assigneeMenu(containerEl, 'Epic B');
		expect(withValue?.items.map((i) => i.titleText)).toEqual([
			'No resources in this base',
			'New resource...',
			'Clear assignee',
		]);
		withValue?.item('Clear assignee')?.click();
		await flush();
		expect('assignee' in vault.fm('Epic B.md')).toBe(false);
	});

	it('New resource... creates the note and then writes the link', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, { ...configured, resourceFolder: '', homeFolder: '' });

		assigneeMenu(containerEl, 'Epic A')?.item('New resource...')?.click();
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('resource prompt not opened');
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('resource prompt has no field');

		input.value = 'Robin';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.files.has('Robin.md')).toBe(true);
		expect(vault.fm('Epic A.md')['assignee']).toBe('[[Robin]]');
	});

	it('writes no link on a failed creation', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, configured);
		vi.spyOn(vault.app.vault, 'create').mockRejectedValue(new Error('disk full'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		assigneeMenu(containerEl, 'Epic A')?.item('New resource...')?.click();
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('resource prompt not opened');
		const input = modal.contentEl.querySelector('input');
		if (!input) throw new Error('resource prompt has no field');

		input.value = 'Robin';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		submitButton(modal)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect('assignee' in vault.fm('Epic A.md')).toBe(false);
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
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Alex', 'Sam', 'New resource...']);

		Menu.lastShown?.item('Alex')?.click();
		await flush();
		expect(vault.fm('Epic A.md')['assignee']).toBe('[[Alex]]');
	});

	it('renders a context row\'s name as a static chip, and offers nothing', () => {
		const vault = assignedVault();
		vault.addFile('Retired.md', { frontmatter: { type: 'Epic', order: 40, assignee: 'Ghost' } });
		vault.addFile('Feature R1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Retired' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView(fakeController(), containerEl);
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
