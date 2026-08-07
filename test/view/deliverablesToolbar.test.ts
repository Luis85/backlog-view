// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Modal } from '../helpers/obsidian-mock';
import { fixture, makeView, projectionButton, useViewHarness } from '../helpers/view';

useViewHarness();

describe('the Deliverables board toggle', () => {
	it('offers a fourth toggle position for the Deliverables board', () => {
		const { containerEl, view } = makeView(fixture());
		const btn = projectionButton(containerEl, 'Show as Deliverables board');
		expect(btn).toBeTruthy();

		btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.projection).toBe('deliverables');
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
