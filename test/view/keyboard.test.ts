// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { fixture, flush, key, makeView, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('collapsing', () => {
	it('collapses a subtree via the chevron, without touching the base file', () => {
		const vault = fixture();
		const { containerEl, config } = makeView(vault);

		const chevron = rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-chevron');
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-expanded')).toBe('false');
		// Collapse state is session-only: the .base file must not grow a path per row.
		expect(config.setCalls.some((c) => c.key === 'collapsedItems')).toBe(false);
		// The chevron click must not open the note
		expect(vault.opened).toHaveLength(0);
	});
});

describe('opening and keyboard', () => {
	it('opens an item on click and marks it selected', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		const row = rowByTitle(containerEl, 'Epic A');
		row.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(vault.opened).toEqual([{ path: 'Epic A.md', mode: false }]);
		expect(row.classList.contains('pbl-selected')).toBe(true);
	});

	it('navigates with arrows and opens with Enter', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'Epic A').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowDown');
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'Enter');
		expect(vault.opened).toEqual([{ path: 'Epic B.md', mode: false }]);
	});

	it('reorders siblings with Alt+ArrowDown', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown'); // select Epic A
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.fm('Epic A.md')['order']).toBe(30);
	});

	it('jumps to the first and last visible item with Home and End', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'End');
		expect(rowByTitle(containerEl, 'Feature B2').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'Home');
		expect(rowByTitle(containerEl, 'Epic A').classList.contains('pbl-selected')).toBe(true);
	});

	it('clears the selection with Escape', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		expect(containerEl.querySelector('.pbl-selected')).not.toBeNull();
		key(tree, 'Escape');
		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
		expect(tree.hasAttribute('aria-activedescendant')).toBe(false);
	});

	it('points aria-activedescendant at the selected row across renders', () => {
		const vault = fixture();
		const { containerEl, view } = makeView(vault);
		const tree = treeOf(containerEl);

		expect(tree.hasAttribute('aria-activedescendant')).toBe(false);
		// The focus ring is the tree's own until a row takes it; CSS reads the class
		// rather than a :has() selector, so it has to track the selection exactly.
		expect(tree.classList.contains('pbl-has-selection')).toBe(false);
		key(tree, 'ArrowDown');
		const row = rowByTitle(containerEl, 'Epic A');
		expect(row.id).not.toBe('');
		expect(tree.getAttribute('aria-activedescendant')).toBe(row.id);
		expect(tree.classList.contains('pbl-has-selection')).toBe(true);

		// A re-render rebuilds the rows; the reference must follow the new element.
		view.onDataUpdated();
		const rerendered = rowByTitle(containerEl, 'Epic A');
		expect(rerendered.classList.contains('pbl-selected')).toBe(true);
		expect(tree.getAttribute('aria-activedescendant')).toBe(rerendered.id);
		expect(tree.classList.contains('pbl-has-selection')).toBe(true);

		view.clearSelection();
		expect(tree.classList.contains('pbl-has-selection')).toBe(false);
	});
});

describe('keyboard expand and collapse', () => {
	it('collapses, expands and traverses with left and right arrows', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown'); // Epic B, expanded
		key(tree, 'ArrowRight'); // already expanded: jump to first child
		expect(rowByTitle(containerEl, 'Feature B1').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowLeft'); // leaf-ish: jump back to the parent
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowLeft'); // collapse the subtree
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(rowByTitle(containerEl, 'Epic B').classList.contains('pbl-selected')).toBe(true);
		key(tree, 'ArrowRight'); // expand it again
		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});

	it('ignores keyboard actions on a selection hidden by collapsing', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown'); // Feature B1
		expect(rowByTitle(containerEl, 'Feature B1').classList.contains('pbl-selected')).toBe(true);
		// Collapse the parent — the selected row is no longer visible
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		key(tree, 'Enter');
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.opened).toHaveLength(0);
		expect(vault.writeLog).toHaveLength(0);
	});
});

describe('keyboard structure shortcuts', () => {
	it('moves up, outdents and indents with Alt+arrows', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { autoAssignType: true });
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown'); // Epic B
		key(tree, 'ArrowUp', { altKey: true });
		await flush();
		expect(vault.fm('Epic B.md')['order']).toBe(0);

		key(tree, 'ArrowRight', { altKey: true }); // indent under Epic A (previous sibling)
		await flush();
		expect(vault.fm('Epic B.md')['parent']).toBe('[[Epic A]]');
		// The explicitly typed subtree follows the ladder
		expect(vault.fm('Feature B1.md')['type']).toBe('PBI');
	});

	it('outdents to the top level with Alt+ArrowLeft', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown'); // Feature B1
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();

		const fm = vault.fm('Feature B1.md');
		expect('parent' in fm).toBe(false);
		expect(fm['order']).toBe(30);
	});
});

describe('the Deliverables board keyboard', () => {
	it('routes the Deliverables board through the board keyboard handler, not the tree', async () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		const harness = makeView(vault, {
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Draft, Review',
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		// Nothing selected yet: the TREE handler's ArrowRight is a no-op with no current
		// row (`handleExpandCollapseKey` is only reached when `current` is non-null), while
		// the BOARD handler always has an entry point — even an empty leading column is a
		// valid stop. Landing on `selectedBoardColumn` is proof the board dispatcher ran;
		// the tree handler would leave it untouched (null).
		key(treeOf(containerEl), 'ArrowRight');
		await flush();
		expect(harness.view.selectedBoardColumn).toBe(0);
	});

	it('Alt+Right on a Deliverables card writes the Deliverable state alone', async () => {
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Untouched', deliverableStatus: 'Draft' },
		});
		const harness = makeView(vault, {
			stateProperty: 'note.status',
			deliverableStateProperty: 'note.deliverableStatus',
			deliverableStateValues: 'Draft, Review',
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		// Select the card directly rather than via arrow navigation — the leading no-state
		// column is empty in this fixture, so an ArrowRight walk lands on ITS stop, never
		// on a card, and this test's subject is the move-key routing, not board arithmetic.
		const card = harness.view.model?.results.find((i) => i.title === 'D');
		if (!card) throw new Error('missing D');
		harness.view.selectItem(card);

		key(treeOf(containerEl), 'ArrowRight', { altKey: true });
		await flush();

		expect(vault.fm('D.md')['deliverableStatus']).toBe('Review');
		expect(vault.fm('D.md')['status']).toBe('Untouched');
	});
});
