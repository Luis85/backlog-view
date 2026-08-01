// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { flush, makeView, refresh, useViewHarness } from '../helpers/view';
import { boardDrag } from '../helpers/dnd';
import { cardByTitle, cardTitles, columnByName, columnNames, columnsOf, countOf } from '../helpers/board';

useViewHarness();

/** Board mode over a configured three-state workflow. */
const BOARD = { viewMode: 'board', stateProperty: 'note.status', stateValues: 'New, Active, Done' };

/** Two epics; B has a done feature and an untyped-state feature. */
function boardVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
	vault.addFile('Feature B1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Epic B' });
	vault.addFile('Feature B2.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic B' });
	return vault;
}

describe('the board projection', () => {
	it('renders one column per configured state in order, the no-state column leading', () => {
		const { containerEl } = makeView(boardVault(), { ...BOARD }, { collapsed: true });

		expect(columnNames(containerEl)).toEqual(['No state', 'New', 'Active', 'Done']);
		// Feature B2 has no state property: gathered, never lost.
		expect(cardTitles(columnByName(containerEl, 'No state'))).toEqual(['Feature B2']);
		expect(cardTitles(columnByName(containerEl, 'New'))).toEqual(['Epic A']);
		expect(cardTitles(columnByName(containerEl, 'Active'))).toEqual(['Epic B']);
		expect(cardTitles(columnByName(containerEl, 'Done'))).toEqual(['Feature B1']);
		// The counts sum to the results the model holds.
		expect(columnsOf(containerEl).map(countOf)).toEqual(['1', '1', '1', '1']);
	});

	it('styles the done column as finished, and appends observed strays after the workflow', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Blocked' } });
		const { containerEl } = makeView(vault, { ...BOARD }, { collapsed: true });

		// Configured states keep their columns, cards or none; the stray is appended,
		// visibly outside the workflow.
		expect(columnNames(containerEl)).toEqual(['No state', 'New', 'Active', 'Done', 'Blocked']);
		expect(columnByName(containerEl, 'Done').hasClass('pbl-col-done')).toBe(true);
		const stray = columnByName(containerEl, 'Blocked');
		expect(stray.hasClass('pbl-col-outside')).toBe(true);
		expect(cardTitles(stray)).toEqual(['A']);
		// The empty no-state column shrinks to the leading drop strip.
		expect(columnByName(containerEl, 'No state').hasClass('pbl-board-strip')).toBe(true);
	});

	it('shows guidance instead of a board when no state property is configured', () => {
		const { containerEl } = makeView(boardVault(), { viewMode: 'board' }, { collapsed: true });

		expect(columnsOf(containerEl)).toHaveLength(0);
		const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(hint).toContain('State property');
		expect(hint).toContain('view options');
		// Guidance holds no options, so it must not claim to be a listbox — an
		// empty one may be announced as nothing at all.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
	});

	it('falls back to the observed states when no list is configured', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Doing' } });
		const { containerEl } = makeView(vault, { viewMode: 'board', stateProperty: 'note.status' }, { collapsed: true });

		expect(columnNames(containerEl)).toEqual(['No state', 'Doing', 'Done']);
	});

	it('a card carries its badge, its parent as context, and its rollup', () => {
		const { containerEl } = makeView(boardVault(), { ...BOARD }, { collapsed: true });

		const done = cardByTitle(containerEl, 'Feature B1');
		expect(done.querySelector('.pbl-badge-text')?.textContent).toBe('Feature');
		expect(done.querySelector('.pbl-card-parent')?.textContent).toContain('Epic B');
		expect(done.hasClass('pbl-done')).toBe(true);

		const parent = cardByTitle(containerEl, 'Epic B');
		// Cards the board shows elsewhere still surface as progress on their parent.
		expect(parent.querySelector('.pbl-progress-label')?.textContent).toBe('1/2');
	});

	it('a card carries the row’s tag controls — the board’s one tag surface until its menu lands', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New', tags: ['a'] } });
		const harness = makeView(vault, { ...BOARD }, { collapsed: true });
		harness.config.order = ['note.tags'];
		refresh(harness.view, vault);

		const card = cardByTitle(harness.containerEl, 'A');
		expect(card.querySelector('.pbl-tag')?.textContent).toBe('#a');
		// Present and revealed on card hover by the same stylesheet rule as rows —
		// hover itself is CSS, which the smoke test owns; the DOM is what jsdom can pin.
		expect(card.querySelector('.pbl-tag-remove')).not.toBeNull();
		expect(card.querySelector('.pbl-tag-add')).not.toBeNull();
	});

	it('activating a card opens its note, exactly as activating a row does', () => {
		const vault = boardVault();
		const { containerEl } = makeView(vault, { ...BOARD }, { collapsed: true });

		cardByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Epic A.md']);

		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Epic A.md', 'Epic B.md']);
	});

	it('an empty base still renders every stage, with the advisory beside the columns', () => {
		const { containerEl } = makeView(new FakeVault(), { ...BOARD }, { collapsed: true });

		// An empty board is empty stages, never no stages.
		expect(columnNames(containerEl)).toEqual(['No state', 'New', 'Active', 'Done']);
		const advisory = containerEl.querySelector('.pbl-board-advisory');
		expect(advisory?.querySelector('.pbl-empty-title')?.textContent).toBe('No backlog items');
	});

	it('treats any stored mode other than board as the tree', () => {
		const { containerEl } = makeView(boardVault(), { ...BOARD, viewMode: 'sideways' });

		expect(columnsOf(containerEl)).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-row').length).toBeGreaterThan(0);
	});
});

describe('the projection toggle', () => {
	it('persists the mode per saved view from the toolbar', () => {
		const treeSide = makeView(boardVault(), { stateProperty: 'note.status' });
		const toggle = treeSide.containerEl.querySelector<HTMLButtonElement>('.pbl-mode-toggle');
		expect(toggle?.getAttribute('aria-label')).toBe('Show as kanban board');
		toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(treeSide.config.setCalls).toContainEqual({ key: 'viewMode', value: 'board' });

		document.body.empty();
		const boardSide = makeView(boardVault(), { ...BOARD }, { collapsed: true });
		const back = boardSide.containerEl.querySelector<HTMLButtonElement>('.pbl-mode-toggle');
		expect(back?.getAttribute('aria-label')).toBe('Show as backlog tree');
		back?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(boardSide.config.setCalls).toContainEqual({ key: 'viewMode', value: 'backlog' });
	});

	it('drops the tree-only collapse controls in board mode', () => {
		const { containerEl } = makeView(boardVault(), { ...BOARD }, { collapsed: true });
		expect(containerEl.querySelector('.pbl-collapse-ctl')).toBeNull();
		// The rest of the toolbar survives the projection: creation, undo, the filter.
		expect(containerEl.querySelector('.pbl-new-btn')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-undo-btn')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-filter-input')).not.toBeNull();
	});

	it('marks the content pane as a listbox in board mode, a tree otherwise', () => {
		const board = makeView(boardVault(), { ...BOARD }, { collapsed: true });
		expect(board.containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');

		document.body.empty();
		const tree = makeView(boardVault(), {});
		expect(tree.containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('tree');
	});
});

describe('focus on the board', () => {
	/** The Base returns only the features; their epic lives outside the filter. */
	function focusedView(configValues: Record<string, unknown>) {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Someday' } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Active' }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 20, status: 'New' }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const config = new FakeViewConfig(configValues);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Epic.md') };
		view.onDataUpdated();
		return { view, config, containerEl, vault };
	}

	it('makes the focused level the cards', () => {
		const { containerEl } = focusedView({ ...BOARD, focusLevel: 'Feature' });

		expect(cardTitles(columnByName(containerEl, 'New'))).toEqual(['F2']);
		expect(cardTitles(columnByName(containerEl, 'Active'))).toEqual(['F1']);
		expect(cardTitles(containerEl)).toHaveLength(2);
	});

	it('renders an excluded focus-level item as an inert context card that places its results', async () => {
		const { containerEl, vault } = focusedView({ ...BOARD, focusLevel: 'Epic' });

		// The Epic is outside the filter, but the results beneath it still need a board.
		const card = cardByTitle(containerEl, 'Epic');
		expect(card.hasClass('pbl-card-context')).toBe(true);
		// Context is a DESCRIPTION on the card, never a label: a label would replace
		// the content-derived accessible name and cost a reader the badge, the
		// parent line and the rollup this inert card exists to carry.
		expect(card.getAttribute('aria-label')).toBeNull();
		expect(card.getAttribute('aria-description')).toContain('shown for context');
		// Its own state names no column, and an excluded value must not mint one: it
		// gathers under no-state, and counts stay results-only.
		expect(columnNames(containerEl)).toEqual(['No state', 'New', 'Active', 'Done']);
		expect(cardTitles(columnByName(containerEl, 'No state'))).toEqual(['Epic']);
		expect(countOf(columnByName(containerEl, 'No state'))).toBe('0');
		// It carries the rollup of what it places.
		expect(card.querySelector('.pbl-progress-label')?.textContent).toBe('0/2');
		// A rendered context card IS a card: no advisory may claim the board is empty
		// (cardCount is 0 here by design — results-only — which is exactly why the
		// advisory must not read it).
		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();

		// Inert: dragging it moves nothing and writes nothing.
		boardDrag(card, columnByName(containerEl, 'Done'));
		await flush();
		expect(vault.fm('Epic.md')['status']).toBe('Someday');
		expect(vault.writeLog).toHaveLength(0);
	});
});
