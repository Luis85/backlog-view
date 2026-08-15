// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { flush, makeView, projectionButton, refresh, useViewHarness } from '../helpers/view';
import { cardDrag } from '../helpers/dnd';
import { cardByTitle, cardTitles, columnByName, columnNames, columnsOf, countOf, expandColumns } from '../helpers/board';

useViewHarness();

/** A configured three-state workflow; the mode itself is not a config key. */
const WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Active, Done' };

/**
 * A view flipped to the board through the toolbar's own path. The mode is UI
 * state in the view-state store, not a base setting, so tests set it the way the
 * user does — through the host — never through the config.
 */
function boardView(
	vault: FakeVault,
	cfg: Record<string, unknown> = { ...WORKFLOW },
	opts: { base?: string } = {},
) {
	const harness = makeView(vault, cfg, { collapsed: true, ...opts });
	harness.view.setProjection('board');
	// A done column with no open work starts folded — see `expandColumns`. This suite is
	// about what a board draws, so it opens them the way a reader would.
	expandColumns(harness.containerEl);
	return harness;
}

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
		const { containerEl } = boardView(boardVault());

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
		const { containerEl } = boardView(vault);

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
		const { containerEl } = boardView(boardVault(), {});

		expect(columnsOf(containerEl)).toHaveLength(0);
		const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(hint).toContain('State property');
		expect(hint).toContain('view options');
		// Guidance holds no options, so it must not claim to be a listbox — an
		// empty one may be announced as nothing at all.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
	});

	it('offers one press that sets the workflow up, and draws the columns right after', async () => {
		const vault = boardVault();
		const { containerEl, view } = boardView(vault, {});
		expect(columnsOf(containerEl)).toHaveLength(0);

		containerEl.querySelector<HTMLElement>('.pbl-empty button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// The same action the toolbar's backfill runs — one idea of what setting this
		// view up means, so the empty frame cannot offer something the button does not.
		expect(view.settings.stateKey).toBe('status');
		expect(columnsOf(containerEl).length).toBeGreaterThan(0);
		// The state key lands empty: every card is where it was, in no state at all.
		expect(vault.fm('Feature B2.md')['status']).toBe('');
		expect(vault.fm('Epic A.md')['status']).toBe('New');
	});

	it('withholds the setup button when the state property is one the user cleared', () => {
		// The roadmap's properties are still untouched, so something IS adoptable — but
		// binding them would leave the board saying exactly what it says now. The button
		// answers for this frame, never for what the action can do elsewhere.
		const { containerEl } = boardView(boardVault(), { stateProperty: '' });

		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No workflow to show');
		expect(containerEl.querySelector('.pbl-empty button')).toBeNull();
	});

	it('falls back to the observed states when no list is configured', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Doing' } });
		const { containerEl } = boardView(vault, { stateProperty: 'note.status' });

		expect(columnNames(containerEl)).toEqual(['No state', 'Doing', 'Done']);
	});

	it('a card carries its badge, its parent as context, and its rollup', () => {
		const { containerEl } = boardView(boardVault());

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
		const harness = boardView(vault);
		harness.config.order = ['note.tags'];
		refresh(harness.view, vault);

		const card = cardByTitle(harness.containerEl, 'A');
		expect(card.querySelector('.pbl-tag')?.textContent).toBe('#a');
		// Present and revealed on card hover by the same stylesheet rule as rows —
		// hover itself is CSS, which the smoke test owns; the DOM is what jsdom can pin.
		expect(card.querySelector('.pbl-tag-remove')).not.toBeNull();
		expect(card.querySelector('.pbl-tag-add')).not.toBeNull();
	});

	it('speaks the yielded label when a real state claims “No state”', () => {
		const vault = new FakeVault();
		vault.addFile('Named.md', { frontmatter: { type: 'Epic', order: 10, status: 'No state' } });
		vault.addFile('Bare.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { containerEl } = boardView(vault, { ...WORKFLOW, stateValues: 'No state, Done' });

		// The visible label yielded to "Unset"; the accessible name must follow, or
		// speech input cannot target the column by the name on screen.
		const unset = columnByName(containerEl, 'Unset');
		expect(unset.getAttribute('aria-label')).toBe('Unset — dropping here clears the state, 1 card');
		expect(columnByName(containerEl, 'No state').getAttribute('aria-label')).toBe('No state, 1 card');
	});

	it('activating a card opens its note, exactly as activating a row does', () => {
		const vault = boardVault();
		const { containerEl } = boardView(vault);

		cardByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Epic A.md']);

		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Epic A.md', 'Epic B.md']);
	});

	it('an empty base still renders every stage, with the advisory beside the columns', () => {
		const { containerEl } = boardView(new FakeVault());

		// An empty board is empty stages, never no stages.
		expect(columnNames(containerEl)).toEqual(['No state', 'New', 'Active', 'Done']);
		const advisory = containerEl.querySelector('.pbl-board-advisory');
		expect(advisory?.querySelector('.pbl-empty-title')?.textContent).toBe('No backlog items');
	});

	/** The board's own workflow, with a limit of two on Active. */
	const LIMITED = { ...WORKFLOW, 'wipLimit.active': '2' };

	/** N epics, all Active, so the Active column can be filled past its limit. */
	function activeVault(n: number): FakeVault {
		const vault = new FakeVault();
		for (let i = 1; i <= n; i++) {
			vault.addFile(`E${i}.md`, { frontmatter: { type: 'Epic', order: i * 10, status: 'Active' } });
		}
		return vault;
	}

	it('shows the count against the limit, and nothing when no limit is set', () => {
		const { containerEl } = boardView(boardVault(), LIMITED);
		expect(columnByName(containerEl, 'Active').querySelector('.pbl-board-col-limit')?.textContent).toBe('/ 2');
		expect(columnByName(containerEl, 'New').querySelector('.pbl-board-col-limit')).toBeNull();
	});

	it('signals an over-limit column in more than colour alone', () => {
		const { containerEl } = boardView(activeVault(3), LIMITED);
		const header = columnByName(containerEl, 'Active').querySelector('.pbl-board-col-header');
		// The class is the colour; the icon is what survives a colour-blind reader and
		// a monochrome screenshot. Asserting only the class would pass on a signal
		// nobody can see.
		expect(header?.classList.contains('pbl-board-col-over')).toBe(true);
		expect(header?.querySelector('.pbl-board-col-over-icon')).not.toBeNull();
	});

	it('is not over at the limit', () => {
		const { containerEl } = boardView(activeVault(2), LIMITED);
		const header = columnByName(containerEl, 'Active').querySelector('.pbl-board-col-header');
		expect(header?.classList.contains('pbl-board-col-over')).toBe(false);
		expect(header?.querySelector('.pbl-board-col-over-icon')).toBeNull();
	});

	it('speaks the limit and the overage as part of the column', () => {
		const { containerEl } = boardView(activeVault(3), LIMITED);
		expect(columnByName(containerEl, 'Active').getAttribute('aria-label')).toBe(
			'Active, 3 cards, limit 2, over by 1',
		);
	});

	it('keeps the signal reading the full population under a filter', async () => {
		// Extension 4a. The pair count narrows; the limit clause does not.
		const { containerEl, view } = boardView(activeVault(3), LIMITED);
		view.setFilter('E1');
		await flush();
		const col = columnByName(containerEl, 'Active');
		expect(col.getAttribute('aria-label')).toBe('Active, 1 of 3 cards match, limit 2, over by 1');
		expect(col.querySelector('.pbl-board-col-header')?.classList.contains('pbl-board-col-over')).toBe(true);
	});
});

describe('the requirements board excludes Deliverables', () => {
	/** `boardVault()` plus a Deliverable sharing a real column's state. */
	function vaultWithDeliverable(): FakeVault {
		const vault = boardVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'New' } });
		return vault;
	}

	it('never shows a Deliverable as a card, though its state matches a real column', () => {
		const { containerEl } = boardView(vaultWithDeliverable());

		expect(cardTitles(columnByName(containerEl, 'New'))).toEqual(['Epic A']);
		expect(cardTitles(containerEl)).not.toContain('D');
	});

	it('keeps a Deliverable off the board even when its state names no configured column', () => {
		const vault = boardVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'Weird' } });
		const { containerEl } = boardView(vault);

		// A stray value normally mints its own column; a Deliverable's must not, or an
		// item this board is meant to hide would still open one in its name.
		expect(columnNames(containerEl)).toEqual(['No state', 'New', 'Active', 'Done']);
	});

	it('keeps the column count and its fullCount in agreement with the cards on screen', async () => {
		const vault = vaultWithDeliverable();
		const { containerEl, view } = boardView(vault);

		// Without the Deliverable inflating it, "New" holds exactly the one visible card.
		expect(countOf(columnByName(containerEl, 'New'))).toBe('1');

		view.setFilter('Epic A');
		await flush();
		// The filtered pair count is "of" the same population the unfiltered count
		// already excluded the Deliverable from — never "1 of 2".
		expect(countOf(columnByName(containerEl, 'New'))).toBe('1 of 1');
	});

	it('keeps a Deliverable’s Task children on the board as their own cards', () => {
		const vault = boardVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'New' } });
		vault.addFile('T.md', { frontmatter: { type: 'Task', order: 10, status: 'Active' }, parentLink: 'D' });
		const { containerEl } = boardView(vault);

		// Task-typed, so this rule does not touch it — it stays a card of its own,
		// placed by its OWN state rather than its parent's exclusion.
		expect(cardTitles(columnByName(containerEl, 'Active'))).toEqual(['Epic B', 'T']);
		expect(cardTitles(containerEl)).not.toContain('D');
		// Its parent chain still names the Deliverable, even though that parent has no
		// card of its own here — the same "context" a hidden ancestor already gets.
		expect(cardByTitle(containerEl, 'T').querySelector('.pbl-card-parent')?.textContent).toContain('D');
	});
});

// A Deliverable acting purely as an outsideFilter context row (an excluded ancestor
// placing a visible descendant) is exercised in deliverablesBoardContext.test.ts —
// split out to keep this file under its line budget, and because it is one subject.

describe('the projection toggle', () => {
	function storedEntries(vault: FakeVault): Record<string, { prefs: { mode?: string } }> {
		return (vault.localStorage.get('product-backlog:view-state') ?? {}) as Record<
			string,
			{ prefs: { mode?: string } }
		>;
	}

	it('persists in localStorage per saved view — never in the base file', () => {
		const vault = boardVault();
		const first = makeView(vault, { ...WORKFLOW }, { base: 'Backlog.base' });
		const toggle = projectionButton(first.containerEl, 'Show as kanban board');
		expect(toggle.getAttribute('aria-pressed')).toBe('false');

		// The click flips the projection in place — no config write, no Bases refresh.
		toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(columnsOf(first.containerEl).length).toBeGreaterThan(0);
		expect(projectionButton(first.containerEl, 'Show as kanban board').getAttribute('aria-pressed')).toBe('true');
		// The rule itself: base settings go on the view; UI state never touches it.
		expect(first.config.setCalls.some((c) => c.key === 'viewMode')).toBe(false);
		first.view.onunload();
		expect(storedEntries(vault)['Backlog.base#Backlog']?.prefs.mode).toBe('board');

		// A fresh view over the same saved view restores the board from the store.
		document.body.empty();
		const second = makeView(vault, { ...WORKFLOW }, { base: 'Backlog.base', collapsed: true });
		expect(columnsOf(second.containerEl).length).toBeGreaterThan(0);

		// And toggling back to the tree clears the field rather than storing a default.
		projectionButton(second.containerEl, 'Show as backlog tree').dispatchEvent(
			new MouseEvent('click', { bubbles: true }),
		);
		second.view.onunload();
		expect(storedEntries(vault)['Backlog.base#Backlog']?.prefs.mode).toBeUndefined();
	});

	it('treats a stored mode it does not recognize as the tree', () => {
		const vault = boardVault();
		vault.localStorage.set('product-backlog:view-state', {
			'Backlog.base#Backlog': {
				base: 'Backlog.base',
				folds: { collapsed: [], expanded: [], lanes: [] },
				prefs: { mode: 'sideways' },
			},
		});
		const { containerEl } = makeView(vault, { ...WORKFLOW }, { base: 'Backlog.base' });

		expect(columnsOf(containerEl)).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-row').length).toBeGreaterThan(0);
	});

	it('renders the collapse controls in board mode, disabled — Epic B has cards, and every one of them is a card', () => {
		const { containerEl } = boardView(boardVault());
		const ctls = Array.from(containerEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl'));
		expect(ctls).toHaveLength(2);
		// The board has nothing to disclose that is not a card's own children, and a
		// card's own toggle is the only thing that may open or close it.
		expect(ctls.every((b) => b.disabled)).toBe(true);
		// The rest of the toolbar survives the projection: creation, undo, the filter.
		expect(containerEl.querySelector('.pbl-new-btn')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-undo-btn')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-filter-input')).not.toBeNull();
	});

	it('marks the content pane as a listbox in board mode, a tree otherwise', () => {
		const board = boardView(boardVault());
		expect(board.containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');

		document.body.empty();
		const tree = makeView(boardVault(), {});
		expect(tree.containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('tree');
	});
});

describe('focus on the board', () => {
	/** The Base returns only the features; their epic lives outside the filter. */
	function focusedView(configValues: Record<string, unknown>, focus: string) {
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
		// Not a config value: focus is working position, set through the view.
		view.setFocusLevel(focus);
		view.setProjection('board');
		return { view, config, containerEl, vault };
	}

	it('makes the focused level the cards', () => {
		const { containerEl } = focusedView(WORKFLOW, 'Feature');

		expect(cardTitles(columnByName(containerEl, 'New'))).toEqual(['F2']);
		expect(cardTitles(columnByName(containerEl, 'Active'))).toEqual(['F1']);
		expect(cardTitles(containerEl)).toHaveLength(2);
	});

	it('renders an excluded focus-level item as an inert context card that places its results', async () => {
		const { containerEl, vault } = focusedView(WORKFLOW, 'Epic');

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
		cardDrag(card, columnByName(containerEl, 'Done'));
		await flush();
		expect(vault.fm('Epic.md')['status']).toBe('Someday');
		expect(vault.writeLog).toHaveLength(0);
	});
});
