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

	/**
	 * The mirror of the test above, and it was the untested half: every navigation case
	 * here drove `ArrowDown`, and `ArrowUp` appeared only with Alt held, which is a
	 * different action entirely (a reorder). Two rules, both of them the down key's read
	 * backwards — with nothing selected the far edge in the direction of travel is where
	 * travel starts, and the near edge is a floor rather than a wrap.
	 */
	it('navigates back up with ArrowUp, from the end and down to the floor', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);
		const selected = (): string | undefined =>
			tree.querySelector<HTMLElement>('.pbl-selected .pbl-title')?.textContent ?? undefined;

		key(tree, 'ArrowUp');
		expect(selected()).toBe('Feature B2');
		key(tree, 'ArrowUp');
		expect(selected()).toBe('Feature B1');
		key(tree, 'ArrowUp');
		key(tree, 'ArrowUp');
		expect(selected()).toBe('Epic A');
		// The first row is a floor, not a wrap: pressing on holds the selection there.
		key(tree, 'ArrowUp');
		expect(selected()).toBe('Epic A');
	});

	it('reorders siblings with Alt+ArrowDown', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown'); // select Epic A
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		// The midpoint of Epic B (20) and the next row in the global population,
		// Feature B1 (30) — one write, never a renumbered group.
		expect(vault.fm('Epic A.md')['order']).toBe(25);
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

	/**
	 * The pointer's way out, and it lives beside the key because the key alone was not
	 * one: `Escape` needs the pane focused, and the gesture that selects a row — a click
	 * that opens its note — hands focus to the editor.
	 */
	it('clears the selection when the click lands on the pane itself', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-selected')).not.toBeNull();

		tree.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
		expect(tree.hasAttribute('aria-activedescendant')).toBe(false);
	});

	/**
	 * Background is what a click is NOT on, and it has to be: the scroller's own blank
	 * strip is the area under the last row and almost nothing else, because the pane is
	 * filled with containers — a row's child group here, the column strip on the board.
	 * Asking `evt.target === treeEl` would leave the blank space a user can actually hit
	 * meaning nothing at all.
	 */
	it('clears it from a child group’s blank space, not only the scroller', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		containerEl.querySelector('.pbl-children')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(containerEl.querySelector('.pbl-selected')).toBeNull();
	});

	/**
	 * The control half of the rule is a CATEGORY — a tab stop — and this is the case that
	 * makes an enumeration insufficient: the timeline's lead-resize grip is a
	 * `role="separator"` div, so it is neither an item nor a `button`, and a rule listing
	 * the controls that exist would have cleared the selection under the user's hand
	 * mid-resize. The pane itself carries `tabindex="0"` too and must stay background,
	 * which the test above holds from the other side.
	 */
	it('keeps the selection when the timeline’s resize grip is clicked', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-20' } });
		const { view, containerEl } = makeView(vault, { startProperty: 'note.start', targetProperty: 'note.target' });
		view.setProjection('roadmap');
		key(treeOf(containerEl), 'ArrowDown');
		expect(containerEl.querySelector('.pbl-selected')).not.toBeNull();

		containerEl
			.querySelector('.pbl-timeline-lead-grip')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(containerEl.querySelector('.pbl-selected')).not.toBeNull();
	});

	/** A control acts on its own, and acting is not a click on nothing. */
	it('keeps the selection when a per-row control is clicked', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const row = rowByTitle(containerEl, 'Epic B');
		row.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		row.querySelector<HTMLElement>('.pbl-chevron')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(row.classList.contains('pbl-selected')).toBe(true);
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
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown'); // Epic B
		key(tree, 'ArrowUp', { altKey: true });
		await flush();
		expect(vault.fm('Epic B.md')['order']).toBe(-990);

		key(tree, 'ArrowRight', { altKey: true }); // indent under Epic A (previous sibling)
		await flush();
		expect(vault.fm('Epic B.md')['parent']).toBe('[[Epic A]]');
		// The subtree it carried is not written at all — an indent moves one note.
		expect(vault.fm('Feature B1.md')['type']).toBe('Feature');
		expect(vault.writeLog.some((w) => w.path === 'Feature B1.md')).toBe(false);
	});

	/**
	 * The keyboard reaches indent through the same `indentTarget` the menu is gated on, so
	 * neither can act on a nesting the other withholds.
	 *
	 * **Green before that gate existed**, and recorded as a pin rather than a proof: an
	 * ungated indent plans no writes either, because the refusal happens in the planner.
	 * What was broken on this path was the OFFER, and the menu test is where the gate is
	 * measured. What this holds is the other direction — an indent that ever planned its
	 * own write beside the gate instead of through it would land here.
	 */
	it('writes nothing on Alt+ArrowRight when the nesting would refuse', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('C1.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('C2.md', { frontmatter: { type: 'Feature', order: 30 }, parentLink: 'Epic' });
		vault.addFile('C4.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown'); // Epic
		key(tree, 'ArrowDown'); // C1
		key(tree, 'ArrowDown'); // C2
		key(tree, 'ArrowRight', { altKey: true });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
		expect(vault.fm('C2.md')['parent']).toBe('[[Epic]]');
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
