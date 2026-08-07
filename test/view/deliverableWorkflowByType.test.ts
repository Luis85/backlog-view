// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { flush, makeView, noOptionalProperties, rowByTitle } from '../helpers/view';
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

	it('draws the Deliverable state once, as the chip, never also as a property cell', () => {
		// The row never draws one property twice with only one of them editable
		// (`src/view/CLAUDE.md`). The chip reads the Deliverable key now, so that key has
		// to leave the generic column set with `stateKey` — found by review: a Base whose
		// property order names it rendered the value in both places.
		const { view, containerEl, config } = makeView(vaultWithBoth(), CONFIG);
		config.order = ['note.deliverableStatus', 'note.status'];
		view.onDataUpdated();

		const row = rowByTitle(containerEl, 'D');
		expect(row.querySelector('.pbl-state-text')?.textContent).toBe('Draft');
		expect(row.querySelectorAll('.pbl-prop').length).toBe(0);
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

describe('the state column serves both workflows', () => {
	const header = (containerEl: HTMLElement) =>
		containerEl.querySelector('.pbl-cols .pbl-state-col')?.textContent;
	/** A chip needs a property column to exist, since the header only draws with one. */
	const withColumn = (harness: ReturnType<typeof makeView>) => {
		harness.config.order = ['note.points'];
		harness.view.onDataUpdated();
		return harness.containerEl;
	};

	it('takes the generic name only while two DISTINCT keys share the column', () => {
		// Two workflows on one column: naming it after either misidentifies the property
		// half the rows below it are showing.
		expect(header(withColumn(makeView(vaultWithBoth(), CONFIG)))).toBe('State');
		// One key in play — configured or falling back — and the column is that one
		// property, named as the user named it.
		const shared = { stateProperty: 'note.status', stateValues: 'To do, Done' };
		expect(header(withColumn(makeView(vaultWithBoth(), shared)))).toBe('status');
		const deliverableOnly = { deliverableStateProperty: 'note.deliverableStatus' };
		expect(header(withColumn(makeView(vaultWithBoth(), deliverableOnly)))).toBe('deliverableStatus');
	});

	it('draws the column for a Deliverable-only workflow, with a chip on Deliverables alone', () => {
		// The menu offers and writes Deliverable states in this configuration, so a tree
		// showing no chip at all was the menu and the column disagreeing.
		const { containerEl } = makeView(vaultWithBoth(), { deliverableStateProperty: 'note.deliverableStatus' });

		const cell = (title: string) => rowByTitle(containerEl, title).querySelector('.pbl-state-col');
		expect(cell('D')?.querySelector('.pbl-state-text')?.textContent).toBe('Draft');
		// The PBI's own workflow has no key, so no chip — but the cell still renders, or
		// every column after it would shift on that row alone.
		expect(cell('P')).not.toBeNull();
		expect(cell('P')?.querySelector('.pbl-state-chip')).toBeNull();
	});

	it('renders no state column when neither workflow has a key', () => {
		const { containerEl } = makeView(vaultWithBoth(), noOptionalProperties());
		expect(rowByTitle(containerEl, 'D').querySelector('.pbl-state-col')).toBeNull();
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

	it('withholds New Deliverable from a card’s own child creator too', () => {
		// `childTypeChoices` answers about the LADDER — a PBI holds Deliverables — and
		// that is a different question from what this board can show. Found by review:
		// filtering Set type alone left every Epic/Feature/PBI card offering
		// "New Deliverable", the same creation path the toolbar's filter closes.
		const vault = new FakeVault();
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: 'In progress' } });
		const harness = makeView(vault, CONFIG);
		const { containerEl } = harness;

		rowByTitle(containerEl, 'P').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('New Deliverable')).toBeDefined();

		harness.view.setProjection('board');
		cardByTitle(containerEl, 'P').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.item('New Deliverable')).toBeUndefined();
		// Withheld, not emptied: the ladder's own child and the other extras remain.
		expect(Menu.lastShown?.item('New Task')).toBeDefined();
		expect(Menu.lastShown?.item('New Bug')).toBeDefined();
	});

	it('never reports a board with no requirements work as "all done"', () => {
		// The advisory was asked of `model.results`, which counts the very Deliverables
		// this board excludes — so a base of Deliverables alone read "All 2 items are
		// done and hidden" beside a "Show completed items" button that would change
		// nothing. Asked of the board's own population it is simply empty.
		const vault = new FakeVault();
		vault.addFile('D1.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
		vault.addFile('D2.md', { frontmatter: { type: 'Deliverable', order: 20, deliverableStatus: 'Draft' } });
		const harness = makeView(vault, CONFIG);
		harness.view.setProjection('board');

		const advisory = harness.containerEl.querySelector('.pbl-board-advisory')?.textContent ?? '';
		expect(advisory).not.toContain('done and hidden');
		expect(advisory).toContain('No backlog items');
	});

	it('explains a Deliverable focus rather than offering to create another', () => {
		// Every focus root is a type this board excludes, so it is empty by construction.
		// The ordinary empty state would name the focused type and offer a "New
		// Deliverable" CTA — a fifth surface offering the one type this board cannot show.
		const harness = makeView(vaultWithBoth(), CONFIG, { focus: 'Deliverable' });
		harness.view.setProjection('board');
		const advisory = harness.containerEl.querySelector('.pbl-board-advisory');

		expect(advisory?.textContent).toContain('Deliverables are managed on their own board');
		expect(advisory?.textContent).not.toContain('New Deliverable');
		// The way out is the focus, so that is the button.
		const btn = advisory?.querySelector('button');
		expect(btn?.textContent).toBe('Show all types');
		btn?.click();
		expect(harness.view.settings.focusLevel).toBe('');
	});

	it('withholds Deliverable from the focus picker on the board', () => {
		const harness = makeView(vaultWithBoth(), CONFIG);
		const { containerEl } = harness;
		const focusChoices = () => {
			containerEl.querySelector<HTMLElement>('.pbl-focus-btn')?.click();
			return Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		};

		expect(focusChoices()).toContain('Deliverable');

		harness.view.setProjection('board');
		// Focusing it here narrows the board to roots it excludes — an empty board
		// reachable in one click. Withheld at the source; an inherited one still reads
		// in the button with the clear beside it.
		expect(focusChoices()).not.toContain('Deliverable');
		expect(focusChoices()).toContain('Bug');
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
