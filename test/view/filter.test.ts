// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fixture, key, makeView, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('quick filter', () => {
	function filterInput(containerEl: HTMLElement): HTMLInputElement {
		const input = containerEl.querySelector<HTMLInputElement>('.pbl-filter-input');
		if (!input) throw new Error('filter input missing');
		return input;
	}
	function setFilterText(containerEl: HTMLElement, text: string): void {
		const input = filterInput(containerEl);
		input.value = text;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}

	it('shows matches with their ancestors and subtrees', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'B1');
		expect(titlesOf(containerEl)).toEqual(['Epic B', 'Feature B1']);
		// aria positions describe the rendered set, not the full sibling group
		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-posinset')).toBe('1');
		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-setsize')).toBe('1');

		setFilterText(containerEl, 'Epic B');
		expect(titlesOf(containerEl)).toEqual(['Epic B', 'Feature B1', 'Feature B2']);

		setFilterText(containerEl, '');
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('overrides collapsed state while active and restores it after', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);

		setFilterText(containerEl, 'B1');
		expect(titlesOf(containerEl)).toEqual(['Epic B', 'Feature B1']);

		setFilterText(containerEl, '');
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
	});

	it('disables dragging while filtering', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'Epic');
		expect(rowByTitle(containerEl, 'Epic A').draggable).toBe(false);
		setFilterText(containerEl, '');
		expect(rowByTitle(containerEl, 'Epic A').draggable).toBe(true);
	});

	it('treats a whitespace-only filter as no filter', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault);

		setFilterText(containerEl, '   ');
		// Nothing is narrowed, so nothing pauses: full tree, dragging, collapsing
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-filtering')).toBe(false);
		expect(rowByTitle(containerEl, 'Epic A').draggable).toBe(true);
		expect(containerEl.querySelector<HTMLElement>('.pbl-count-label')?.textContent).toBe('4 items');

		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(config.setCalls.some((c) => c.key === 'collapsedItems')).toBe(false);
	});

	it('keeps keyboard navigation within the filtered rows', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		setFilterText(containerEl, 'B1');
		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'Feature B1').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'Enter');
		expect(vault.opened).toEqual([{ path: 'Feature B1.md', mode: false }]);
	});

	it('shows a no-match message and clears with Escape', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'zzz');
		expect(containerEl.querySelector('.pbl-empty-filter')?.textContent).toContain('No items match "zzz"');
		expect(titlesOf(containerEl)).toEqual([]);

		filterInput(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(filterInput(containerEl).value).toBe('');
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('clears the filter from the no-match state button and refocuses the input', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'zzz');
		containerEl
			.querySelector<HTMLElement>('.pbl-empty-filter button')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		// The toolbar input is synced and refocused for the next search
		expect(filterInput(containerEl).value).toBe('');
		expect(document.activeElement).toBe(filterInput(containerEl));
	});

	it('clears the filter with Escape from the tree, then the selection', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		setFilterText(containerEl, 'B1');
		key(tree, 'ArrowDown'); // select Epic B within the filtered rows
		key(tree, 'Escape');
		expect(filterInput(containerEl).value).toBe('');
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		// The selection survives the filter clear; a second Escape drops it
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'Escape');
		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
		// With nothing left to back out of, Escape is inert
		key(tree, 'Escape');
		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
	});

	it('focuses the filter input from the tree with "/"', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		// A modified "/" may belong to an app hotkey — leave it alone
		key(treeOf(containerEl), '/', { ctrlKey: true });
		expect(document.activeElement).not.toBe(filterInput(containerEl));

		key(treeOf(containerEl), '/');
		expect(document.activeElement).toBe(filterInput(containerEl));
	});

	it('keeps the input focused while filtering re-renders the tree', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const input = filterInput(containerEl);

		input.focus();
		setFilterText(containerEl, 'B');
		expect(document.activeElement).toBe(input);
	});

	it('highlights the matching part of titles', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		setFilterText(containerEl, 'b1');
		expect(rowByTitle(containerEl, 'Feature B1').querySelector('.pbl-match')?.textContent).toBe('B1');
		// Ancestors shown for context only are not falsely highlighted
		expect(rowByTitle(containerEl, 'Epic B').querySelector('.pbl-match')).toBeNull();

		setFilterText(containerEl, '');
		expect(rowByTitle(containerEl, 'Feature B1').querySelector('.pbl-match')).toBeNull();
	});

	it('pauses collapse controls and drag affordances while filtering', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault);
		// The CSS hooks that gray out the collapse controls and hide the grips
		expect(containerEl.querySelectorAll('.pbl-collapse-ctl')).toHaveLength(2);

		setFilterText(containerEl, 'B');
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-filtering')).toBe(true);
		const writesBefore = config.setCalls.length;
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(config.setCalls.length).toBe(writesBefore);

		setFilterText(containerEl, '');
		expect(containerEl.querySelector('.pbl-view')?.classList.contains('pbl-filtering')).toBe(false);
	});

	it('jumps to the first visible child when expanding under a filter', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		setFilterText(containerEl, 'B2'); // Epic B visible via Feature B2; Feature B1 hidden
		key(tree, 'ArrowDown'); // Epic B
		key(tree, 'ArrowRight');

		expect(rowByTitle(containerEl, 'Feature B2').classList.contains('pbl-selected')).toBe(true);
	});

	it('shows a clear button while active and clears on click', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const box = containerEl.querySelector<HTMLElement>('.pbl-filter');

		expect(box?.classList.contains('pbl-filter-active')).toBe(false);
		setFilterText(containerEl, 'B1');
		expect(box?.classList.contains('pbl-filter-active')).toBe(true);

		containerEl.querySelector<HTMLElement>('.pbl-filter-clear')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(filterInput(containerEl).value).toBe('');
		expect(box?.classList.contains('pbl-filter-active')).toBe(false);
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('shows filtered counts as "x of N"', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const label = () => containerEl.querySelector<HTMLElement>('.pbl-count-label')?.textContent;

		expect(label()).toBe('4 items');
		setFilterText(containerEl, 'B1');
		expect(label()).toBe('2 of 4');
		setFilterText(containerEl, '');
		expect(label()).toBe('4 items');
	});
});
