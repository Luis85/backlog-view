// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from 'obsidian';
import { FakeVault } from '../helpers/vault';
import { cardDrag } from '../helpers/dnd';
import { cardByTitle, cardTitles, columnByName } from '../helpers/board';
import { shelfCountOf, shelfOf, shelfTitles } from '../helpers/roadmap';
import { flush, key, makeView, refresh, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The iteration board's shelf: the work the sprint can still pull in, above its columns.
 *
 * What is driven here is the population, the two directions of the gesture, and the one
 * rule the pull rests on — a card arriving from the shelf joins the iteration AND lands
 * in the bucket it was dropped on, in ONE write, so one undo takes both back.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
};

const SPRINT = 'Sprint 12.md';

function sprintVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
	vault.addFile('Sprint 13.md', { frontmatter: { type: 'Iteration', order: 20 } });
	vault.addFile('In sprint.md', {
		frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
	});
	vault.addFile('Committed elsewhere.md', {
		frontmatter: { type: 'PBI', order: 20, status: 'New', iteration: '[[Sprint 13]]' },
	});
	vault.addFile('Uncommitted.md', { frontmatter: { type: 'PBI', order: 30, status: 'New' } });
	vault.addFile('Finished.md', { frontmatter: { type: 'PBI', order: 40, status: 'Done' } });
	return vault;
}

/** A sprint with nothing committed to it — so the board's columns draw empty. */
function emptySprintVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
	vault.addFile('Uncommitted.md', { frontmatter: { type: 'PBI', order: 30, status: 'New' } });
	return vault;
}

function onSprint(vault: FakeVault) {
	const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
	harness.view.setProjection('iteration');
	harness.view.setBoardScope(SPRINT);
	return harness;
}

describe('the iteration shelf', () => {
	it('holds the work in NO iteration, and nothing else', () => {
		// In no iteration, never "not in this one": work committed to another fortnight is
		// committed, and offering it here would make a pull a silent removal from somebody
		// else's sprint. Finished work is out by its own workflow, and the two `Iteration`
		// notes are the boxes rather than what goes in them.
		const { containerEl } = onSprint(sprintVault());
		expect(shelfTitles(containerEl)).toEqual(['Uncommitted']);
	});

	it('draws above the columns, which is the direction a card travels', () => {
		const { containerEl } = onSprint(sprintVault());
		const shelf = shelfOf(containerEl);
		const cols = containerEl.querySelector('.pbl-board-cols');
		expect(shelf).not.toBeNull();
		// `DOCUMENT_POSITION_FOLLOWING`: the columns come after the shelf in the frame.
		expect(shelf?.compareDocumentPosition(cols as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('is not drawn on the product board, which is scoped to no iteration at all', () => {
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('board');
		expect(shelfOf(harness.containerEl)).toBeNull();
	});

	it('pulls a card in: it joins the iteration AND lands in the bucket, in one write', async () => {
		const vault = sprintVault();
		const { containerEl } = onSprint(vault);

		cardDrag(cardByTitle(containerEl, 'Uncommitted'), columnByName(containerEl, 'In progress'));
		await flush();

		expect(vault.fm('Uncommitted.md')['iteration']).toBe('[[Sprint 12]]');
		expect(vault.fm('Uncommitted.md')['status']).toBe('Doing');
		// ONE record on one file — one gesture, one edit of that note, one captured
		// inverse — rather than a join write and a state write landing separately.
		expect(vault.writeLog).toHaveLength(1);
	});

	it('takes both halves back on one undo', async () => {
		const vault = sprintVault();
		const { containerEl } = onSprint(vault);

		cardDrag(cardByTitle(containerEl, 'Uncommitted'), columnByName(containerEl, 'In progress'));
		await flush();
		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();

		expect('iteration' in vault.fm('Uncommitted.md')).toBe(false);
		expect(vault.fm('Uncommitted.md')['status']).toBe('New');
	});

	it('lands a pull whose state already reads into the bucket', async () => {
		// The bucket guard is about a card ALREADY on this board. A shelf card holding
		// `New` dropped on Open changes no state and still has to join.
		const vault = sprintVault();
		const { containerEl } = onSprint(vault);

		cardDrag(cardByTitle(containerEl, 'Uncommitted'), columnByName(containerEl, 'Open'));
		await flush();

		expect(vault.fm('Uncommitted.md')['iteration']).toBe('[[Sprint 12]]');
		expect(vault.fm('Uncommitted.md')['status']).toBe('New');
	});

	it('folds and reopens from its own disclosure, and starts open', () => {
		// Open until a reader shuts it: a shelf they have to find before they can pull
		// from it answers nothing. The fold is a COLUMN fold (`ColumnScope` 'backlog'),
		// so it lands in the same store every other fold does.
		const { containerEl, view } = onSprint(sprintVault());
		const disclosure = () => shelfOf(containerEl)?.querySelector<HTMLElement>('.pbl-shelf-disclosure');
		expect(shelfTitles(containerEl)).toEqual(['Uncommitted']);

		disclosure()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.columnCollapsed('backlog', null, false)).toBe(true);
		expect(shelfTitles(containerEl)).toEqual([]);
		// The pressed button is gone with the frame it rebuilt, so focus follows the part
		// it played rather than the node — onto its own replacement, which is the only way
		// back into a shut shelf.
		expect(containerEl.ownerDocument.activeElement).toBe(disclosure());

		disclosure()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(shelfTitles(containerEl)).toEqual(['Uncommitted']);
	});

	it('drops a card on the shelf to take it out of the iteration', async () => {
		const vault = sprintVault();
		const { containerEl } = onSprint(vault);
		const shelf = shelfOf(containerEl);

		cardDrag(cardByTitle(containerEl, 'In sprint'), shelf as HTMLElement);
		await flush();

		// The link and nothing else: leaving a sprint is not a state change.
		expect('iteration' in vault.fm('In sprint.md')).toBe(false);
		expect(vault.fm('In sprint.md')['status']).toBe('New');
	});

	it('shows the card it just pulled in on the board, and drops it off the shelf', async () => {
		const vault = sprintVault();
		const { containerEl, view } = onSprint(vault);

		cardDrag(cardByTitle(containerEl, 'Uncommitted'), columnByName(containerEl, 'In progress'));
		await flush();
		refresh(view, vault);

		expect(cardTitles(columnByName(containerEl, 'In progress'))).toEqual(['Uncommitted']);
		expect(shelfTitles(containerEl)).toEqual([]);
	});

	describe('its picks', () => {
		/** Every control the roadmap's header carries, by class. */
		const CONTROLS = ['.pbl-shelf-layout', '.pbl-shelf-sort', '.pbl-shelf-filter', '.pbl-shelf-search-input'];

		it('draws the same four controls the roadmap’s header does', () => {
			// Withheld until 2026-08-21 because their keyboard path — the card menu's shelf
			// section — was the roadmap's alone. It is not any more, so the reason is gone and
			// the band that most needs narrowing (a backlog, not a handful of unplaced notes)
			// gets the same controls.
			const { containerEl } = onSprint(sprintVault());
			const shelf = shelfOf(containerEl);
			for (const control of CONTROLS) expect(shelf?.querySelector(control)).not.toBeNull();
		});

		it('narrows the band by the search, and keeps the count the true total', () => {
			const vault = sprintVault();
			vault.addFile('Another idea.md', { frontmatter: { type: 'PBI', order: 50, status: 'New' } });
			const { view, containerEl } = onSprint(vault);
			expect(shelfTitles(containerEl).sort()).toEqual(['Another idea', 'Uncommitted']);
			view.setShelfSearch('another');
			expect(shelfTitles(containerEl)).toEqual(['Another idea']);
			// The count is what the band HOLDS, never what the narrowing leaves — the roadmap's
			// own guarantee, and the reason a narrowing has to say on its face that it is one.
			expect(shelfCountOf(containerEl)).toBe('2');
		});

		it('narrows the band by the type filter', () => {
			const vault = sprintVault();
			vault.addFile('A task.md', { frontmatter: { type: 'Task', order: 60, status: 'New' } });
			const { view, containerEl } = onSprint(vault);
			expect(shelfTitles(containerEl).sort()).toEqual(['A task', 'Uncommitted']);
			view.setShelfHiddenTypes(new Set(['Task']));
			expect(shelfTitles(containerEl)).toEqual(['Uncommitted']);
		});

		it('offers the shelf section in a card’s menu, which is the keyboard’s way in', () => {
			// Every header control here is `tabindex="-1"` inside a composite pane, so this menu
			// is not a convenience: without it the four controls above are pointer-only and the
			// feature fails at its own purpose. The board's own rule, stated at its
			// hidden-match links.
			const { containerEl } = onSprint(sprintVault());
			Menu.lastShown = null;
			cardByTitle(containerEl, 'Uncommitted').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
			const titles = Menu.lastShown?.items.map((item) => item.titleText) ?? [];
			expect(titles).toContain('Shelf layout');
			expect(titles).toContain('Sort the shelf');
			expect(titles).toContain('Filter the shelf by type');
			expect(titles).toContain('Search the shelf...');
		});

		it('returns the controls to the tab order when the narrowing empties the pane', () => {
			// The state that makes a `-1` a trap rather than a convention: an iteration with
			// nothing committed draws empty columns, and a search narrow enough to empty the
			// shelf leaves no card anywhere — so no card menu, which is the only keyboard path
			// to these controls, and the column menu carries no shelf section. Without this the
			// reader cannot clear the search that put them there. (Codex, PR #187.)
			//
			// `emptySprintVault` rather than `sprintVault`: the latter's `In sprint.md` is
			// committed to this iteration and always draws a card in a column, so
			// `paneHasCards` would stay true and the controls would correctly stay at `-1` —
			// asserting the opposite of what this test is for.
			const { view, containerEl } = onSprint(emptySprintVault());
			view.setShelfSearch('nothing matches this');
			const shelf = shelfOf(containerEl);
			for (const control of CONTROLS) {
				expect(shelf?.querySelector(control)?.getAttribute('tabindex')).toBe('0');
			}
		});

		it('keeps them out of it while cards are on screen, which is the composite’s rule', () => {
			const { containerEl } = onSprint(sprintVault());
			const shelf = shelfOf(containerEl);
			for (const control of CONTROLS) {
				expect(shelf?.querySelector(control)?.getAttribute('tabindex')).toBe('-1');
			}
		});

		it('keeps them out of it when a COLUMN holds the only card and the shelf is emptied', () => {
			// The `||`'s first half alone: `In sprint` keeps a column non-empty while the
			// search empties the shelf. `columns.some(...)` by itself would already pass this
			// (it is true here) — the case that actually distinguishes the two terms is the
			// next test, where this half is false and the other has to carry it.
			const { view, containerEl } = onSprint(sprintVault());
			view.setShelfSearch('nothing matches this');
			const shelf = shelfOf(containerEl);
			for (const control of CONTROLS) {
				expect(shelf?.querySelector(control)?.getAttribute('tabindex')).toBe('-1');
			}
		});

		it('keeps them out of it when the SHELF holds the only card and every column is empty', () => {
			// The `||`'s second half alone: nothing is committed, so every column is empty,
			// and `columns.some(...)` reads false — `shelf.drawn.length > 0` is what has to
			// keep the controls at `-1` here. Reducing the expression to `columns.some(...)`
			// alone fails this one; reducing it to `shelf.drawn.length > 0` alone fails the
			// previous test — together they are what the comment above both call sites claims.
			const { containerEl } = onSprint(emptySprintVault());
			const shelf = shelfOf(containerEl);
			for (const control of CONTROLS) {
				expect(shelf?.querySelector(control)?.getAttribute('tabindex')).toBe('-1');
			}
		});

		/**
		 * `activeShelf`'s own copy of the same two-term expression (`shelfSurface.ts`,
		 * consumed by `refocus`) is a second, independent computation from the same two
		 * facts — a bug in it would not be caught by the tabindex tests above, which read
		 * `syncShelfTabStops`'s copy in `iterationBoard.ts` instead. Driven the same way,
		 * through the one place `paneHasCards` is observable: which element a rebuild sends
		 * focus to.
		 */
		function pickSortAndGetFocus(containerEl: HTMLElement): Element | null {
			const btn = shelfOf(containerEl)?.querySelector<HTMLElement>('.pbl-shelf-sort');
			Menu.lastShown = null;
			btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
			const entry = Menu.lastShown?.items.find((i) => i.titleText === 'Title (A to Z)');
			if (!entry) throw new Error('sort menu did not offer Title (A to Z)');
			entry.click();
			return containerEl.ownerDocument.activeElement;
		}

		it('sends focus to the pane, not the button, when a column keeps it a composite', () => {
			// `columns.some(...)` alone is true here (`In sprint` stays in Open); the shelf
			// is emptied by the search. If `paneHasCards` read only `shelf.drawn.length > 0`
			// this would wrongly send focus to the sort button's replacement instead.
			const { view, containerEl } = onSprint(sprintVault());
			view.setShelfSearch('nothing matches this');
			expect(pickSortAndGetFocus(containerEl)).toBe(containerEl.querySelector('.pbl-tree'));
		});

		it('sends focus to the pane, not the button, when only the shelf keeps it a composite', () => {
			// The mirror case: every column is empty, so `columns.some(...)` is false, and
			// only `shelf.drawn.length > 0` (the shelf's own `Uncommitted` card) keeps this a
			// composite. If `paneHasCards` read only the columns term this would wrongly send
			// focus to the sort button's replacement instead.
			const { containerEl } = onSprint(emptySprintVault());
			expect(pickSortAndGetFocus(containerEl)).toBe(containerEl.querySelector('.pbl-tree'));
		});

		it('drops the pane to a region when the narrowing empties both halves', () => {
			// `renderIterationBoardContent` used to hand this board the unconditional
			// `listbox` the Deliverables and requirements boards still carry — a promise of
			// options that a narrowing which empties every column AND the shelf broke, since
			// the tab-stop lift already turns this exact state into a plain region for the
			// header's own controls. Asked with the same two-term expression as the tab-stop
			// decision, so the role and the tab stops can no longer disagree.
			const { view, containerEl } = onSprint(emptySprintVault());
			view.setShelfSearch('nothing matches this');
			expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
		});

		it('keeps the listbox role wherever a column or the shelf still draws a card', () => {
			const withCommitted = onSprint(sprintVault()).containerEl;
			expect(withCommitted.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');
			const shelfOnly = onSprint(emptySprintVault()).containerEl;
			expect(shelfOnly.querySelector('.pbl-tree')?.getAttribute('role')).toBe('listbox');
		});

		it('withholds the section while the band is shut, as the header withholds the pickers', () => {
			// `addShelfSection` is the card menu's own section, so a collapsed shelf draws no
			// shelf card to menu from at all; the card to right-click has to be a BOARD one —
			// `In sprint`, committed to this iteration and drawn in the Open column.
			const { view, containerEl } = onSprint(sprintVault());
			view.setColumnCollapsed('backlog', null, true);
			Menu.lastShown = null;
			cardByTitle(containerEl, 'In sprint').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
			const titles = Menu.lastShown?.items.map((item) => item.titleText) ?? [];
			expect(titles).not.toContain('Sort the shelf');
		});

		it('puts focus on the control’s replacement when the pane holds no card', () => {
			// The other half of the tab-stop lift. Promoting the controls and then sending focus
			// to the empty pane strands the reader exactly as leaving them at -1 would.
			//
			// The pick is what matters, not the open: `refocus` runs from the `after` callback
			// `showTypeMenu` hands `addShelfTypeItems`, so it fires when an ITEM is chosen — a
			// synthetic click on the button alone only opens the menu and focuses nothing in
			// jsdom. `emptySprintVault` again, for `paneHasCards`' own reason above.
			const { view, containerEl } = onSprint(emptySprintVault());
			view.setShelfSearch('nothing matches this');
			Menu.lastShown = null;
			shelfOf(containerEl)
				?.querySelector<HTMLElement>('.pbl-shelf-filter')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			const hideAll = Menu.lastShown?.items.find((item) => item.titleText === 'Hide all types');
			if (!hideAll) throw new Error('type menu did not offer Hide all types');
			hideAll.click();
			expect(containerEl.ownerDocument.activeElement).toBe(
				shelfOf(containerEl)?.querySelector('.pbl-shelf-filter'),
			);
		});
	});
});

