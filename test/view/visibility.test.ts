// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { flush, key, makeView, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('completed items', () => {
	/** Three top-level branches: done-with-open-child, fully done, open — plus a done leaf. */
	function completedFixture(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic X.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('F open.md', { frontmatter: { order: 10, status: 'Open' }, parentLink: 'Epic X' });
		vault.addFile('Epic Y.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		vault.addFile('F done.md', { frontmatter: { order: 10, status: 'Done' }, parentLink: 'Epic Y' });
		vault.addFile('Epic Z.md', { frontmatter: { type: 'Epic', order: 30, status: 'Open' } });
		vault.addFile('Leaf D.md', { frontmatter: { type: 'Epic', order: 40, status: 'Done' } });
		return vault;
	}

	// A factory: config.set() mutates the values object it was handed, so a
	// shared literal would leak one test's toggle into the next.
	const hiddenConfig = () => ({ stateProperty: 'note.status', showCompleted: false });

	it('hides fully done subtrees but keeps done parents with open children', () => {
		const { containerEl } = makeView(completedFixture(), hiddenConfig());

		expect(titlesOf(containerEl)).toEqual(['Epic X', 'F open', 'Epic Z']);
		// Visible siblings renumber the accessible positions.
		expect(rowByTitle(containerEl, 'Epic X').getAttribute('aria-setsize')).toBe('2');
		expect(rowByTitle(containerEl, 'Epic Z').getAttribute('aria-posinset')).toBe('2');
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('3 of 6');

		const toggle = containerEl.querySelector<HTMLElement>('.pbl-completed-toggle');
		expect(toggle?.classList.contains('is-active')).toBe(true);
		expect(toggle?.getAttribute('aria-label')).toBe('Show completed items (3 hidden)');
	});

	it('renders a parent whose children are all hidden as a leaf with its rollup', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Open' } });
		vault.addFile('F1.md', { frontmatter: { order: 10, status: 'Done' }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { order: 20, status: 'Done' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, hiddenConfig());

		const epic = rowByTitle(containerEl, 'Epic');
		expect(titlesOf(containerEl)).toEqual(['Epic']);
		expect(epic.getAttribute('aria-expanded')).toBeNull();
		expect(epic.querySelector('.pbl-chevron')?.classList.contains('pbl-leaf')).toBe(true);
		// The rollup still counts the hidden children.
		expect(epic.querySelector('.pbl-progress-label')?.textContent).toBe('2/2');
	});

	it('suspends hiding while the quick filter is active', () => {
		const { view, containerEl } = makeView(completedFixture(), hiddenConfig());

		view.setFilter('F done');
		expect(titlesOf(containerEl)).toEqual(['Epic Y', 'F done']);
		view.setFilter('');
		expect(titlesOf(containerEl)).toEqual(['Epic X', 'F open', 'Epic Z']);
	});

	it('toggles the option from the toolbar eye button', () => {
		const shown = makeView(completedFixture(), { stateProperty: 'note.status' });
		shown.containerEl.querySelector<HTMLElement>('.pbl-completed-toggle')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(shown.config.setCalls).toContainEqual({ key: 'showCompleted', value: false });

		const hidden = makeView(completedFixture(), hiddenConfig());
		hidden.containerEl.querySelector<HTMLElement>('.pbl-completed-toggle')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(hidden.config.setCalls).toContainEqual({ key: 'showCompleted', value: true });
	});

	it('moves and navigates across hidden siblings to the next visible one', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Open' } });
		vault.addFile('H.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 30, status: 'Open' } });
		const { containerEl } = makeView(vault, hiddenConfig());

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'A').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowDown', { altKey: true });
		await flush();
		// A lands after B, the next visible sibling — past the hidden H.
		expect(vault.fm('A.md').order).toBe(40);
	});

	it('omits move commands that could only swap with hidden rows', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Open' } });
		vault.addFile('H.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 30, status: 'Open' } });
		const { containerEl } = makeView(vault, hiddenConfig());

		rowByTitle(containerEl, 'B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		expect(menu?.item('Move down')).toBeUndefined();
		expect(menu?.item('Move to bottom')).toBeUndefined();
		// The visible predecessor is A — the hidden H is never named.
		expect(menu?.item('Indent under "A"')).toBeDefined();
	});

	it('treats a parent with only hidden children as a leaf for keyboard expansion', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Open' } });
		vault.addFile('F1.md', { frontmatter: { order: 10, status: 'Done' }, parentLink: 'Epic' });
		const { containerEl, config } = makeView(vault, hiddenConfig());

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		key(tree, 'ArrowLeft');
		key(tree, 'ArrowRight');

		// No invisible collapse state is written or persisted for the apparent leaf.
		expect(config.setCalls.filter((c) => c.key === 'collapsedItems')).toHaveLength(0);
		expect(rowByTitle(containerEl, 'Epic').classList.contains('pbl-selected')).toBe(true);
	});

	it('shows the all-done state with a way back when everything hides', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Closed' } });
		const { containerEl, config } = makeView(vault, hiddenConfig());

		const empty = containerEl.querySelector('.pbl-empty-filter');
		expect(empty?.textContent).toContain('All 2 items are done and hidden.');
		empty?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(config.setCalls).toContainEqual({ key: 'showCompleted', value: true });
	});
});

describe('hierarchy scope', () => {
	/** A backlog folder that also holds ordinary notes, as `file.inFolder()` returns it. */
	function mixedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Backlog/Sprint notes.md');
		vault.addFile('Backlog/README.md');
		return vault;
	}

	it('renders only the work items and says how many notes it skipped', () => {
		const { containerEl } = makeView(mixedVault());

		expect(titlesOf(containerEl)).toEqual(['Epic A']);
		const note = containerEl.querySelector('.pbl-ignored-note');
		expect(note?.textContent).toBe('2 notes ignored');
		// The tooltip has to name the option that brings them back
		expect((note as HTMLElement).dataset.tooltip).toContain('Ignore notes outside the hierarchy');
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 item');
	});

	it('renders every note and no advisory when the option is off', () => {
		const { containerEl } = makeView(mixedVault(), { hierarchyOnly: false });

		expect(titlesOf(containerEl).sort()).toEqual(['Epic A', 'README', 'Sprint notes']);
		expect(containerEl.querySelector('.pbl-ignored-note')).toBeNull();
	});

	it('explains an empty view caused by the scope', () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Sprint notes.md');
		const { containerEl } = makeView(vault);

		const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(hint).toContain('1 note in this base has no supported type and no parent');
		expect(hint).toContain('Ignore notes outside the hierarchy');
	});

	it('keeps the generic hint when the base is simply empty', () => {
		const { containerEl } = makeView(new FakeVault());
		expect(containerEl.querySelector('.pbl-empty-hint')?.textContent).toContain("Point this base's filter");
	});

	it('pluralizes the scope hint for more than one ignored note', () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Sprint notes.md');
		vault.addFile('Backlog/Retro notes.md');
		const { containerEl } = makeView(vault);

		const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(hint).toContain('2 notes in this base have no supported type and no parent, so they are not treated as backlog items');
	});
});
