// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Modal } from '../helpers/obsidian-mock';
import { fixture, makeView, projectionButton, refresh, useViewHarness } from '../helpers/view';
import { collapseAll, expandAll } from '../../src/view/render/toolbarControls';

useViewHarness();

describe('the Deliverables board entry', () => {
	it('is reached from the board scope picker, not from a toggle position of its own', () => {
		// The toggle carried a Deliverables position until 2026-08-16, when the user moved
		// it under the picker's Product entry: every board is the Board button now, and
		// the picker beside it says which. Driven through the real controls end to end.
		const { containerEl, view } = makeView(fixture());
		expect(() => projectionButton(containerEl, 'Show as Deliverables board')).toThrow();

		projectionButton(containerEl, 'Show as kanban boards').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		containerEl.querySelector<HTMLElement>('.pbl-scope-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const entry = Menu.lastShown?.item('Deliverables');
		// Directly under Product, and both entries wear an icon — the request that moved it.
		expect((Menu.lastShown?.items ?? []).map((mi) => mi.titleText).slice(0, 2)).toEqual([
			'Product',
			'Deliverables',
		]);
		expect(Menu.lastShown?.item('Product')?.iconName).toBe('square-kanban');
		expect(entry?.iconName).toBe('package');

		entry?.click();
		expect(view.projection).toBe('deliverables');
		// The Board position stays pressed, the picker names the chosen board, and its
		// entry is the checked one.
		const board = projectionButton(containerEl, 'Show as kanban boards');
		expect(board.getAttribute('aria-pressed')).toBe('true');
		expect(containerEl.querySelector('.pbl-scope-btn')?.getAttribute('aria-label')).toBe(
			'Board scope: Deliverables',
		);
		containerEl.querySelector<HTMLElement>('.pbl-scope-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Menu.lastShown?.item('Deliverables')?.checked).toBe(true);
		expect(Menu.lastShown?.item('Product')?.checked).toBe(false);
	});

	it('retains the pick: Board reopens Deliverables after a trip through the tree', () => {
		// The scope's own retention rule, extended to the second board: `Board` means the
		// board this view was last on. Product then clears the pick, so the round trip
		// after it lands on the product board again.
		const { containerEl, view } = makeView(fixture());
		view.setProjection('deliverables');
		view.setProjection('tree');
		projectionButton(containerEl, 'Show as kanban boards').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.projection).toBe('deliverables');

		containerEl.querySelector<HTMLElement>('.pbl-scope-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		Menu.lastShown?.item('Product')?.click();
		expect(view.projection).toBe('board');
		view.setProjection('tree');
		projectionButton(containerEl, 'Show as kanban boards').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.projection).toBe('board');
	});

	it('hides "Show completed items" on the Deliverables board even with a requirements state key', () => {
		const harness = makeView(fixture(), { stateProperty: 'note.status' });
		harness.view.setProjection('deliverables');
		expect(harness.containerEl.querySelector('.pbl-completed-toggle')).toBeNull();
	});

	it('counts a Deliverable done only in the requirements workflow as visible, not hidden', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'Done', deliverableStatus: 'Draft' },
		});
		const harness = makeView(vault, {
			stateProperty: 'note.status',
			showCompleted: false,
			deliverableStateProperty: 'note.deliverableStatus',
		});
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 item');
	});

	it('counts only Deliverable-typed items on the Deliverables board, never the whole base', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('P1.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('P2.md', { frontmatter: { type: 'PBI', order: 20 } });
		const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		// One Deliverable card renders; the toolbar must not report the base's other 2
		// PBIs as part of "how many items are on this board".
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 item');
	});

	it('scopes the count tooltip to Deliverables too, not just the label text', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('P1.md', { frontmatter: { type: 'PBI', order: 10 } });
		const harness = makeView(vault, { deliverableStateProperty: 'note.deliverableStatus' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		const count = containerEl.querySelector<HTMLElement>('.pbl-count-label');
		expect(count?.dataset.tooltip).toContain('Deliverable');
		expect(count?.dataset.tooltip).not.toContain('PBI');
	});
});

describe('the requirements board excludes Deliverables from its count', () => {
	it('does not count a Deliverable toward the requirements board’s item count', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		const harness = makeView(vault);
		harness.view.setProjection('board');
		const { containerEl } = harness;

		// One card renders (see board.test.ts); the toolbar must agree with it rather
		// than reporting the base's Deliverable as part of "how many items are here".
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toBe('1 item');
	});

	it('keeps the level-breakdown tooltip free of Deliverables on the requirements board', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		const harness = makeView(vault);
		harness.view.setProjection('board');
		const { containerEl } = harness;

		const count = containerEl.querySelector<HTMLElement>('.pbl-count-label');
		expect(count?.dataset.tooltip).not.toContain('Deliverable');
	});

	it('leaves the tree’s own count untouched — Deliverables still belong there', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 } });
		const harness = makeView(vault);
		// Default projection is the tree.

		expect(harness.containerEl.querySelector('.pbl-count-label')?.textContent).toBe('2 items');
	});
});

describe('creation on the Deliverables board', () => {
	it('binds the primary New button to New Deliverable, and drops the "another type" picker', () => {
		const harness = makeView(fixture());
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		// Creating anything other than a Deliverable makes no sense here — the board
		// would not show it — so the picker offering every OTHER type is gone too.
		expect(containerEl.querySelector('.pbl-new-btn')?.textContent).toContain('New Deliverable');
		expect(containerEl.querySelector('.pbl-new-pick')).toBeNull();
	});

	it('creates a Deliverable from the primary button even while a focus would otherwise change its type', () => {
		// Off the Deliverables board, `newItemType` reads the active focus level — proof
		// this binding does not fall through to that rule by accident.
		const harness = makeView(fixture(), {}, { focus: 'Feature' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Modal.lastOpened?.titleEl.textContent).toBe('New Deliverable');
	});

	it('still offers every type on the requirements board — the picker is Deliverables-only', () => {
		const harness = makeView(fixture());
		harness.view.setProjection('board');

		expect(harness.containerEl.querySelector('.pbl-new-pick')).not.toBeNull();
	});
});

describe('the focus control on the Deliverables board', () => {
	it('reads "Deliverables", disabled, rather than disappearing when no focus is set', () => {
		const harness = makeView(fixture());
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		// The board only ever shows Deliverables here — nothing is narrowing it — so
		// the button is a real, disabled control rather than absent or a CSS-only lie.
		const btn = containerEl.querySelector<HTMLButtonElement>('.pbl-focus-btn');
		expect(btn).not.toBeNull();
		expect(btn?.tagName).toBe('BUTTON');
		expect(btn?.textContent).toContain('Deliverables');
		expect(btn?.disabled).toBe(true);
		// Nothing to clear: no clear button rides along with the fixed label.
		expect(containerEl.querySelector('.pbl-focus-clear')).toBeNull();
	});

	it('still reads the fixed, disabled "Deliverables" button under an inherited PBI focus', () => {
		// PBI does not narrow this board — `collectFocusRoots`'s `extraFocused` rule
		// already admits every Deliverable as a focus root under PBI focus regardless
		// of subtree position — so the fixed button stays exactly as true as it is
		// with no focus at all, never the "Focused: PBI" label.
		const harness = makeView(fixture(), {}, { focus: 'PBI' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		const btn = containerEl.querySelector<HTMLButtonElement>('.pbl-focus-btn');
		expect(btn?.textContent).toContain('Deliverables');
		expect(btn?.disabled).toBe(true);
	});

	it('still reads the fixed, disabled "Deliverables" button under an inherited Deliverable focus', () => {
		// Focusing Deliverable by name reaches every Deliverable in the base by
		// definition, so this also does not narrow the board.
		const harness = makeView(fixture(), {}, { focus: 'Deliverable' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		const btn = containerEl.querySelector<HTMLButtonElement>('.pbl-focus-btn');
		expect(btn?.textContent).toContain('Deliverables');
		expect(btn?.disabled).toBe(true);
	});

	it('still reads the fixed, disabled "Deliverables" button under an inherited Feature focus', () => {
		// Reversed by the human's own request: a focus level set on another projection
		// must never narrow this board, Feature included — so there is nothing left to
		// clear, and no "Focused: Feature" label either.
		const harness = makeView(fixture(), {}, { focus: 'Feature' });
		harness.view.setProjection('deliverables');
		const { containerEl } = harness;

		const btn = containerEl.querySelector<HTMLButtonElement>('.pbl-focus-btn');
		expect(btn?.textContent).toContain('Deliverables');
		expect(btn?.disabled).toBe(true);
		expect(containerEl.querySelector('.pbl-focus-clear')).toBeNull();
	});
});

describe('the bulk collapse controls leave the Deliverables board’s own cards alone', () => {
	/** `iconButton` puts the label in `aria-label`; the button's own text is an icon. */
	function collapseCtl(containerEl: HTMLElement, label: string): HTMLButtonElement | undefined {
		return Array.from(containerEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl')).find(
			(b) => b.getAttribute('aria-label') === label,
		);
	}

	/**
	 * A Deliverable with a child, and a FEATURE focus that does not contain it. Every
	 * Deliverable is a card, so Expand all/Collapse all must leave it exactly as they
	 * found it whether or not a focus set elsewhere would otherwise have hidden it from
	 * `model.items` — the workflow is configured because without one this board draws its
	 * no-workflow guidance instead of cards, and the buttons are disabled for that reason
	 * rather than this one.
	 */
	const WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Done' };

	function outsideTheFocus(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('F.md', { frontmatter: { type: 'Feature', order: 10, status: 'New' } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 20, status: 'New' } });
		vault.addFile('T.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'D' });
		return vault;
	}

	// Every Deliverable is a card here — nothing else is ever drawn on this board — so the
	// buttons are disabled outright (see `toolbarCollapse.test.ts`'s disabling describe
	// block for the general rule), and `expandAll` is driven directly rather than through
	// a click a disabled button would refuse to fire.
	it('disables the buttons and leaves a Deliverable card the focus level excludes untouched by Expand all', () => {
		const { containerEl, view } = makeView(outsideTheFocus(), { ...WORKFLOW }, { collapsed: true });
		view.setProjection('deliverables');
		view.setFocusLevel('Feature');
		expect(view.isCardCollapsed('D.md')).toBe(true);
		expect(collapseCtl(containerEl, 'Expand all')?.disabled).toBe(true);

		expandAll(view);

		expect(view.isCardCollapsed('D.md')).toBe(true);
		// Only the card's own toggle opens it — simulated the way its click handler does.
		view.setCardCollapsed('D.md', false);
		expect(view.isCardCollapsed('D.md')).toBe(false);
	});

	it('opens a NEWLY seen Deliverable’s card collapsed, focus or no focus', () => {
		// `refreshFromData` settles new parents from `model.items`, which is the FOCUSED
		// render set, so a Deliverable arriving outside the active focus subtree was never
		// ruled on and its card opened expanded — the one population in this view that a
		// focus cannot narrow bypassing the collapsed-by-default rule the tree and both
		// other boards keep.
		const vault = outsideTheFocus();
		const { view } = makeView(vault, { ...WORKFLOW }, { collapsed: true });
		view.setProjection('deliverables');
		view.setFocusLevel('Feature');

		vault.addFile('D2.md', { frontmatter: { type: 'Deliverable', order: 30, status: 'New' } });
		vault.addFile('T2.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'D2' });
		refresh(view, vault);

		expect(view.isCardCollapsed('D2.md')).toBe(true);
	});

	it('leaves it open too, so Collapse all does not fight the card’s own state', () => {
		const { view } = makeView(outsideTheFocus(), { ...WORKFLOW }, { collapsed: true });
		view.setProjection('deliverables');
		view.setFocusLevel('Feature');
		view.setCardCollapsed('D.md', false);

		collapseAll(view);

		expect(view.isCardCollapsed('D.md')).toBe(false);
	});
});
