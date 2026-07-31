// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { drag, fixture, flush, key, makeView, rowByTitle, stubRect, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('drag and drop', () => {
	it('re-ranks when dropping before a sibling', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic B'), rowByTitle(containerEl, 'Epic A'), 'before');
		await flush();

		expect(vault.fm('Epic B.md')['order']).toBe(0);
		expect(vault.fm('Epic B.md')['parent']).toBeUndefined();
	});

	it('re-parents and re-types when dropping into a row', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Feature B2'), 'inside');
		await flush();

		const fm = vault.fm('Epic A.md');
		expect(fm['parent']).toBe('[[Feature B2]]');
		expect(fm['type']).toBe('PBI');
		expect(fm['order']).toBe(10);
	});

	it('refuses to drop an ancestor into its own subtree', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic B'), rowByTitle(containerEl, 'Feature B1'), 'inside');
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('marks the moved row pending until the data refreshes', async () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic B'), rowByTitle(containerEl, 'Epic A'), 'before');
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-pending')).toBe(true);

		await flush();
		view.onDataUpdated(); // the Bases refresh re-renders the tree
		expect(containerEl.querySelector('.pbl-pending')).toBeNull();
	});

	it('clears the pending mark when the write is rejected', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(containerEl.querySelector('.pbl-pending')).toBeNull();
		expect(vault.writeLog).toHaveLength(0);
	});

	it('shows the drop indicator on the hovered row', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		const from = rowByTitle(containerEl, 'Epic B');
		const to = rowByTitle(containerEl, 'Epic A');
		stubRect(to);
		from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));

		expect(to.classList.contains('pbl-drop-before')).toBe(true);
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-dragging')).toBe(true);
	});

	it('clears a stale parent link when the last orphaned root is dropped on the top-level strip', async () => {
		const vault = new FakeVault();
		vault.addFile('Root.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Orphan.md', { frontmatter: { type: 'Epic', order: 20 }, parentLink: 'Missing' });
		const { containerEl } = makeView(vault);

		expect(vault.fm('Orphan.md')['parent']).toBe('[[Missing]]');
		const strip = containerEl.querySelector<HTMLElement>('.pbl-root-drop');
		if (!strip) throw new Error('root drop strip missing');

		rowByTitle(containerEl, 'Orphan').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		strip.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
		strip.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
		await flush();

		expect('parent' in vault.fm('Orphan.md')).toBe(false);
	});
});

describe('drag state details', () => {
	it('expands a collapsed row after hovering over it during a drag', () => {
		vi.useFakeTimers();
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);

		const to = rowByTitle(containerEl, 'Epic B');
		stubRect(to);
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 15 }));
		// The pending expansion is signaled on the row while the timer runs
		expect(to.classList.contains('pbl-hover-expanding')).toBe(true);
		vi.advanceTimersByTime(700);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('drops the hover-expand cue when the drag moves off the row', () => {
		vi.useFakeTimers();
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const to = rowByTitle(containerEl, 'Epic B');
		stubRect(to);
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 15 }));
		expect(to.classList.contains('pbl-hover-expanding')).toBe(true);

		to.dispatchEvent(new MouseEvent('dragleave', { bubbles: true }));
		expect(to.classList.contains('pbl-hover-expanding')).toBe(false);
		vi.advanceTimersByTime(700);
		// The cancelled timer must not expand the row anyway
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('clears the indicator when the drag leaves the row', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const from = rowByTitle(containerEl, 'Epic B');
		const to = rowByTitle(containerEl, 'Epic A');
		stubRect(to);
		from.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		to.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientY: 3 }));
		expect(to.classList.contains('pbl-drop-before')).toBe(true);

		to.dispatchEvent(new MouseEvent('dragleave', { bubbles: true }));
		expect(to.classList.contains('pbl-drop-before')).toBe(false);
	});

	it('drops on the tree background to move an item to the top level', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		tree.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
		tree.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
		await flush();

		const fm = vault.fm('Feature B1.md');
		expect('parent' in fm).toBe(false);
		expect(fm['order']).toBe(30);
	});

	it('clears all drag state on dragend', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const row = rowByTitle(containerEl, 'Epic A');
		row.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-dragging')).toBe(true);
		expect(row.classList.contains('pbl-drag-source')).toBe(true);

		row.dispatchEvent(new MouseEvent('dragend', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-dragging')).toBe(false);
		expect(row.classList.contains('pbl-drag-source')).toBe(false);
	});
});
