// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { flush, makeView, rowByTitle } from '../helpers/view';
import { cardByTitle } from '../helpers/board';

/**
 * Which workflow tracks an item's state is a property of its TYPE, not of the
 * projection it is drawn in. Every check here drives the TREE — the projection where
 * the projection-based rule was wrong — plus the requirements board, where offering
 * `Deliverable` as a type writes a note that board cannot show.
 */

/** A Deliverable and a PBI, each carrying a value in each workflow's own key. */
function vaultWithBoth(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('D.md', {
		frontmatter: { type: 'Deliverable', order: 10, status: 'In progress', deliverableStatus: 'Draft' },
	});
	vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 20, status: 'In progress', deliverableStatus: 'Draft' } });
	return vault;
}

const CONFIG = {
	stateProperty: 'note.status',
	stateValues: 'To do, In progress, Done',
	deliverableStateProperty: 'note.deliverableStatus',
	deliverableStateValues: 'Concept, Draft, Review, Published',
};

function setStateValues(containerEl: HTMLElement, title: string): string[] {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const submenu = Menu.lastShown?.item('Set state')?.submenu;
	if (!submenu) throw new Error(`no Set state submenu for ${title}`);
	return submenu.items.map((i) => i.titleText);
}

describe('the workflow an item is tracked by follows its type, not the projection', () => {
	it('offers the Deliverable workflow’s states in the TREE’s Set state for a Deliverable', () => {
		const { containerEl } = makeView(vaultWithBoth(), CONFIG);

		// The reported bug: on the backlog tree a Deliverable's Set state listed the
		// requirements workflow. Both directions, so a fix that simply swapped the two
		// fails this as loudly as the bug did.
		expect(setStateValues(containerEl, 'D')).toEqual(['Concept', 'Draft', 'Review', 'Published']);
		expect(setStateValues(containerEl, 'P')).toEqual(['To do', 'In progress', 'Done']);
	});

	it('checks the entry the Deliverable already holds, in ITS workflow', () => {
		const { containerEl } = makeView(vaultWithBoth(), CONFIG);

		rowByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const submenu = Menu.lastShown?.item('Set state')?.submenu;
		// `Draft` is what `deliverableStatus` holds; `In progress` is the requirements
		// value sitting on the same note and must not be what the checkmark answers to.
		expect(submenu?.item('Draft')?.checked).toBe(true);
	});

	it('writes the Deliverable key from the tree, never the requirements one', async () => {
		const vault = vaultWithBoth();
		const { containerEl } = makeView(vault, CONFIG);

		rowByTitle(containerEl, 'D').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set state')?.submenu?.item('Review')?.click();
		await flush();

		expect(vault.fm('D.md')['deliverableStatus']).toBe('Review');
		expect(vault.fm('D.md')['status']).toBe('In progress');
	});

	it('shows the Deliverable’s own state on the tree’s state chip', () => {
		const { containerEl } = makeView(vaultWithBoth(), CONFIG);

		const chipText = (title: string) =>
			rowByTitle(containerEl, title).querySelector('.pbl-state-text')?.textContent;
		// The chip and the menu it opens must name one workflow — a chip reading
		// "In progress" over a menu offering Concept/Draft/Review is the same defect
		// one click earlier.
		expect(chipText('D')).toBe('Draft');
		expect(chipText('P')).toBe('In progress');
	});
});

describe('the requirements board does not offer a type it cannot show', () => {
	it('withholds Deliverable from Set type on the board, and keeps it in the tree', () => {
		const harness = makeView(vaultWithBoth(), CONFIG);
		const { containerEl } = harness;

		rowByTitle(containerEl, 'P').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('Set type')?.submenu?.items.map((i) => i.titleText)).toContain('Deliverable');

		harness.view.setProjection('board');
		cardByTitle(containerEl, 'P').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const onBoard = Menu.lastShown?.item('Set type')?.submenu?.items.map((i) => i.titleText);
		expect(onBoard).not.toContain('Deliverable');
		// Withheld, not emptied: every other declared type is still offered.
		expect(onBoard).toContain('Bug');
	});

	it('keeps the PRIMARY New button off Deliverable too, under an inherited Deliverable focus', () => {
		// `newItemType` follows the FOCUS target, so a Deliverable focus left active from
		// another projection made the button read "New Deliverable" on the requirements
		// board while the chevron beside it had already withheld that type — a narrower
		// list is decoration if the button beside it does not draw from it.
		const harness = makeView(vaultWithBoth(), CONFIG, { focus: 'Deliverable' });
		const { containerEl } = harness;
		const primary = () => containerEl.querySelector('.pbl-new-btn')?.textContent;

		expect(primary()).toBe('New Deliverable');

		harness.view.setProjection('board');
		expect(primary()).toBe('New Epic');
	});

	it('withholds New Deliverable from the toolbar’s type picker on the board', () => {
		const harness = makeView(vaultWithBoth(), CONFIG);
		const { containerEl } = harness;
		const pickTitles = () => {
			containerEl.querySelector<HTMLElement>('.pbl-new-pick')?.click();
			return Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		};

		expect(pickTitles()).toContain('New Deliverable');

		harness.view.setProjection('board');
		expect(pickTitles()).not.toContain('New Deliverable');
		expect(pickTitles()).toContain('New Bug');
	});
});
