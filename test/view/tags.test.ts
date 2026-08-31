// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { flush, Harness, makeView, rowByTitle, submitPrompt, useViewHarness } from '../helpers/view';

useViewHarness();

describe('tag editing', () => {
	/** Two epics carrying tags, with the tags property among the visible ones. */
	function tagged(configValues: Record<string, unknown> = {}): Harness & { vault: FakeVault } {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, tags: ['alpha', 'beta'] } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, tags: 'gamma' } });
		const harness = makeView(vault, configValues);
		harness.config.order = ['note.tags'];
		harness.view.onDataUpdated();
		return { ...harness, vault };
	}

	function tagsOf(containerEl: HTMLElement, title: string): string[] {
		return Array.from(rowByTitle(containerEl, title).querySelectorAll('.pbl-tag-text')).map(
			(el) => el.textContent ?? '',
		);
	}

	/** Click the row's add-tag button and return the menu it opened. */
	function openTagMenu(containerEl: HTMLElement, title: string): Menu {
		rowByTitle(containerEl, title)
			.querySelector<HTMLElement>('.pbl-tag-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('tag menu not shown');
		return menu;
	}

	it('renders each tag as a removable pill with a way to add one', () => {
		const { containerEl } = tagged();

		expect(tagsOf(containerEl, 'Epic A')).toEqual(['#alpha', '#beta']);
		// A string value holding tags is read the same as a list
		expect(tagsOf(containerEl, 'Epic B')).toEqual(['#gamma']);

		const pill = rowByTitle(containerEl, 'Epic A').querySelector('.pbl-tag');
		const remove = pill?.querySelector('.pbl-tag-remove');
		expect(remove?.tagName).toBe('BUTTON');
		// No Tab stop — the tree keeps its single-tab-stop model
		expect(remove?.getAttribute('tabindex')).toBe('-1');
		expect(remove?.getAttribute('aria-label')).toBe('Remove tag alpha');
		expect(rowByTitle(containerEl, 'Epic A').querySelector('.pbl-tag-add')).not.toBeNull();
	});

	it('keeps the add button beside the pills, not behind them', () => {
		const vault = new FakeVault();
		// More tags than a column can show: the pills clip, the control must not
		vault.addFile('Epic A.md', {
			frontmatter: { type: 'Epic', order: 10, tags: ['one', 'two', 'three', 'four', 'five', 'six'] },
		});
		const harness = makeView(vault);
		harness.config.order = ['note.tags'];
		harness.view.onDataUpdated();

		const cell = rowByTitle(harness.containerEl, 'Epic A').querySelector('.pbl-prop-tags');
		const list = cell?.querySelector('.pbl-tag-list');
		expect(list?.querySelectorAll('.pbl-tag')).toHaveLength(6);
		// A sibling of the clipped pill box, and the last thing in the cell
		expect(cell?.querySelector('.pbl-tag-add')?.parentElement).toBe(cell);
		expect(list?.querySelector('.pbl-tag-add')).toBeNull();
		expect(cell?.lastElementChild?.classList.contains('pbl-tag-add')).toBe(true);
	});

	it('removes a tag without touching the others', async () => {
		const { containerEl, vault } = tagged();

		rowByTitle(containerEl, 'Epic A')
			.querySelector<HTMLElement>('.pbl-tag-remove')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(vault.fm('Epic A.md').tags).toEqual(['beta']);
		// The click stays on the pill — it must not also open the note
		expect(vault.opened).toEqual([]);
	});

	it('removes two tags in a row without the second undoing the first', async () => {
		// Both clicks come from the same rendered row, whose tags are a snapshot from
		// before either write — the second must not put the first tag back.
		const { containerEl, vault } = tagged();
		const row = rowByTitle(containerEl, 'Epic A');
		const [first, second] = Array.from(row.querySelectorAll<HTMLElement>('.pbl-tag-remove'));

		first.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		second.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect('tags' in vault.fm('Epic A.md')).toBe(false);
	});

	it('removes the key when the last tag goes', async () => {
		const { containerEl, vault } = tagged();

		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-tag-remove')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect('tags' in vault.fm('Epic B.md')).toBe(false);
	});

	it('offers the tags in use, checked where the item already carries them', async () => {
		const { containerEl, vault } = tagged();
		const menu = openTagMenu(containerEl, 'Epic B');

		expect(menu.items.map((i) => i.titleText)).toEqual(['#alpha', '#beta', '#gamma', 'New tag...']);
		expect(menu.item('#gamma')?.checked).toBe(true);
		expect(menu.item('#alpha')?.checked).toBe(false);

		menu.item('#alpha')?.click();
		await flush();
		expect(vault.fm('Epic B.md').tags).toEqual(['gamma', 'alpha']);
	});

	it('toggles an assigned tag back off from the menu', async () => {
		const { containerEl, vault } = tagged();

		openTagMenu(containerEl, 'Epic B').item('#gamma')?.click();
		await flush();

		expect('tags' in vault.fm('Epic B.md')).toBe(false);
	});

	// The normalization rules themselves are node tests (test/domain/noteFields.test.ts);
	// these two are the round trip that proves the prompt reaches them, and the notice
	// the user gets when it refuses.
	it('adds a typed tag, normalized to a usable frontmatter tag', async () => {
		const { containerEl, vault } = tagged();

		openTagMenu(containerEl, 'Epic B').item('New tag...')?.click();
		submitPrompt({ title: '#Sprint 12!' });
		await flush();

		expect(vault.fm('Epic B.md').tags).toEqual(['gamma', 'Sprint-12']);
	});

	it('refuses a tag Obsidian would not recognize, and says why', async () => {
		const { containerEl, vault } = tagged();

		openTagMenu(containerEl, 'Epic B').item('New tag...')?.click();
		// Digits alone are not a tag — writing it would look like it worked
		submitPrompt({ title: '123' });
		await flush();

		expect(vault.fm('Epic B.md').tags).toBe('gamma');
		expect(Notice.messages.some((m) => m.includes('at least one non-numeric character'))).toBe(true);
	});

	it('stops offering tag editing when the tags property is cleared', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, tags: ['alpha'] } });
		const { containerEl } = makeView(vault, { tagsProperty: '' });

		expect(containerEl.querySelector('.pbl-tag')).toBeNull();
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Edit tags')).toBeUndefined();
	});

	it('reaches the same choices from the context menu', () => {
		const { containerEl } = tagged();
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const submenu = Menu.lastShown?.item('Edit tags')?.submenu;
		expect(submenu?.items.map((i) => i.titleText)).toEqual(['#alpha', '#beta', '#gamma', 'New tag...']);
	});

	it('leaves the property read-only when it is not the configured tags property', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, tags: ['alpha'] } });
		vault.entryValues.set('Epic A.md', { 'note.tags': { toString: () => 'alpha' } });
		const { containerEl, config, view } = makeView(vault, { tagsProperty: 'note.labels' });
		config.order = ['note.tags'];
		view.onDataUpdated();

		expect(containerEl.querySelector('.pbl-tag')).toBeNull();
		expect(containerEl.querySelector('.pbl-prop-value')?.textContent).toBe('alpha');
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Edit tags')).toBeUndefined();
	});

	it('offers no tag editing while the column is hidden', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, tags: ['alpha'] } });
		const { containerEl } = makeView(vault);

		expect(containerEl.querySelector('.pbl-tag')).toBeNull();
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Edit tags')).toBeUndefined();
	});

	it('shows a context row’s tags without offering to change them', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, tags: ['outside'] } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10, tags: ['alpha'] }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, {}, { only: ['PBI.md'], order: ['note.tags'] });

		const epic = rowByTitle(containerEl, 'Epic');
		expect(tagsOf(containerEl, 'Epic')).toEqual(['#outside']);
		expect(epic.querySelector('.pbl-tag-remove')).toBeNull();
		expect(epic.querySelector('.pbl-tag-add')).toBeNull();
		epic.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Edit tags')).toBeUndefined();

		// An excluded note's tags are not this base's vocabulary either
		expect(openTagMenu(containerEl, 'PBI').items.map((i) => i.titleText)).toEqual(['#alpha', 'New tag...']);
	});
});
