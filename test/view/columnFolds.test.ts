// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { cardDrag } from '../helpers/dnd';
import { flush, key, makeView, refresh, treeOf, useViewHarness } from '../helpers/view';
import { BOARD_WORKFLOW, cardTitles, columnByName, columnNames, countOf, makeBoard } from '../helpers/board';
import { bucketByName, horizonVault, makeRoadmap } from '../helpers/roadmap';

useViewHarness();

/**
 * Folding a board column and a horizon bucket: the reader's own fold, the done column's
 * once-only default, and what a fold does and does not take off the board.
 *
 * Every assertion here is about MARKUP and behaviour. What a folded column LOOKS like —
 * 44px, the rotated name — is a stylesheet question `test/view/boardColumnWidth.test.ts`
 * asks of the rule text, and a themed vault is what actually confirms it.
 */

/** The disclosure in a column's or bucket's header. */
function foldButton(el: HTMLElement): HTMLButtonElement {
	const btn = el.querySelector<HTMLButtonElement>('.pbl-chevron');
	if (!btn) throw new Error('no disclosure in this header');
	return btn;
}

function folded(el: HTMLElement): boolean {
	return el.classList.contains('pbl-board-collapsed') || el.classList.contains('pbl-bucket-collapsed');
}

/** Two epics in New and one unfinished item in Done, so nothing folds by default. */
function openVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'New' } });
	vault.addFile('Shipped.md', { frontmatter: { type: 'Epic', order: 30, status: 'Done' } });
	vault.addFile('Loose end.md', { frontmatter: { type: 'Task', order: 10, status: 'Active' }, parentLink: 'Shipped' });
	return vault;
}

describe('folding a board column', () => {
	it('takes its cards off the board and keeps its name, its count and its drop target', async () => {
		const vault = openVault();
		const { containerEl } = makeBoard(vault);
		const done = columnByName(containerEl, 'Done');
		expect(cardTitles(done)).toEqual(['Shipped']);

		foldButton(done).click();

		const shut = columnByName(containerEl, 'Done');
		expect(folded(shut)).toBe(true);
		expect(cardTitles(shut)).toEqual([]);
		// The register's own words: name and count stay visible, and the column stays a
		// stage of the workflow rather than becoming a gap in it.
		expect(columnNames(containerEl)).toEqual(['No state', 'New', 'Active', 'Done']);
		expect(countOf(shut)).toBe('1');

		// And it is still where finishing work lands — a stage nobody can drop into is
		// not a folded stage, it is a missing one.
		cardDrag(containerEl.querySelector<HTMLElement>('.pbl-card') ?? shut, shut);
		await flush();
		expect(vault.fm('Epic A.md')['status']).toBe('Done');
	});

	it('says which way it sits, and the same control says the way back', () => {
		const { containerEl } = makeBoard(openVault());
		const open = foldButton(columnByName(containerEl, 'Done'));
		expect(open.getAttribute('aria-expanded')).toBe('true');
		expect(open.getAttribute('aria-label')).toBe('Collapse Done');

		open.click();

		const shut = foldButton(columnByName(containerEl, 'Done'));
		expect(shut.getAttribute('aria-expanded')).toBe('false');
		expect(shut.getAttribute('aria-label')).toBe('Expand Done');
		shut.click();
		expect(folded(columnByName(containerEl, 'Done'))).toBe(false);
	});

	it('says it is folded where the keyboard path can hear it', () => {
		// The stop's `aria-label` overrides its children, so the disclosure's own
		// `aria-expanded` reaches nobody arriving by `aria-activedescendant` — and the count
		// survives the fold, so a silent label announces cards the column is not showing.
		const { containerEl } = makeBoard(openVault());
		const stop = () => columnByName(containerEl, 'Done').querySelector('.pbl-board-col-stop');
		expect(stop()?.getAttribute('aria-label')).toBe('Done, 1 card');

		foldButton(columnByName(containerEl, 'Done')).click();

		expect(stop()?.getAttribute('aria-label')).toBe('Done, collapsed, 1 card');
	});

	it('is off the tab order, like every other per-row control', () => {
		const { containerEl } = makeBoard(openVault());
		expect(foldButton(columnByName(containerEl, 'Done')).getAttribute('tabindex')).toBe('-1');
	});

	it('leaves the keyboard unable to select what it took off screen', () => {
		// The failure this pins: the keyboard walks the SNAPSHOT's columns, so a fold that
		// only skipped the DOM would let an arrow rest the selection on a card nobody can
		// see, with `aria-activedescendant` pointing at an element that is not there.
		const { containerEl, view } = makeBoard(openVault());
		foldButton(columnByName(containerEl, 'Done')).click();

		const tree = treeOf(containerEl);
		for (let i = 0; i < 12; i++) key(tree, 'ArrowRight');
		for (let i = 0; i < 12; i++) key(tree, 'ArrowDown');
		key(tree, 'End');

		expect(view.selectedPath).not.toBe('Shipped.md');
	});

	it('does not make the board claim it is empty', () => {
		// Folding every column is not "nothing to show": an advisory saying the work is
		// all done, or all filtered away, over a board whose cards are merely folded is
		// the board contradicting its own headers.
		const { containerEl } = makeBoard(openVault());
		for (const name of columnNames(containerEl)) {
			const col = columnByName(containerEl, name);
			if (col.querySelector('.pbl-chevron')) foldButton(col).click();
		}
		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
	});

	it('survives a data update, and comes back on the next open of the same view', () => {
		const vault = openVault();
		const { view, containerEl, config } = makeView(vault, BOARD_WORKFLOW, { collapsed: true, base: 'Backlog.base' });
		view.setProjection('board');
		foldButton(columnByName(containerEl, 'Done')).click();

		refresh(view, vault);
		expect(folded(columnByName(containerEl, 'Done'))).toBe(true);

		// A second view of the same base reads the same stored entry — this is the whole
		// of "persist that state": the fold is working position, on the device.
		view.onunload();
		const reopened = makeView(vault, BOARD_WORKFLOW, { collapsed: true, base: 'Backlog.base', viewName: config.name });
		reopened.view.setProjection('board');
		expect(folded(columnByName(reopened.containerEl, 'Done'))).toBe(true);
	});

	it('opens while a quick filter runs, so a search has no silent exception in it', () => {
		const { view, containerEl } = makeBoard(openVault());
		foldButton(columnByName(containerEl, 'Done')).click();
		expect(cardTitles(columnByName(containerEl, 'Done'))).toEqual([]);

		view.setFilter('Shipped');
		expect(cardTitles(columnByName(containerEl, 'Done'))).toEqual(['Shipped']);

		// Lifted, the fold is exactly where it was — a search does not rule on a column.
		view.setFilter('');
		expect(folded(columnByName(containerEl, 'Done'))).toBe(true);
	});

	it('offers no fold from the menu while a filter runs, because the button offers none', () => {
		// Found by review (Codex, PR #140). The disclosure is disabled while filtering and
		// this entry was not, so a folded column — which the filter override reports as
		// open — offered an enabled Collapse that wrote a fold nothing on screen could
		// show, and clearing the search revealed a fold the reader never watched happen.
		// Two surfaces over one action have to be AVAILABLE at the same times, not only
		// agree about the state.
		const { view, containerEl } = makeBoard(openVault());
		view.setFilter('Epic');

		expect(foldButton(columnByName(containerEl, 'New')).disabled).toBe(true);
		columnByName(containerEl, 'New')
			.querySelector('.pbl-board-col-header')
			?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const entry = Menu.lastShown?.item('Collapse New');
		expect(entry?.disabled).toBe(true);

		// Disabled AND inert: clicking it anyway writes no fold, so lifting the filter
		// leaves the column exactly as the reader left it.
		entry?.click();
		view.setFilter('');
		expect(folded(columnByName(containerEl, 'New'))).toBe(false);
	});

	it('is remembered per board, so two boards’ “Done” are two folds', () => {
		// The scope in the key. Without it, folding Done on the requirements board would
		// fold the Deliverables board's own Done, which no reader asked about.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('Thing.md', { frontmatter: { type: 'Deliverable', order: 20, status: 'New' } });
		// `New` on both boards, and neither is done — so nothing but the scope in the key
		// can be keeping these two folds apart.
		const { view, containerEl } = makeBoard(vault, { deliverableStateValues: 'New, Done' });
		foldButton(columnByName(containerEl, 'New')).click();
		expect(folded(columnByName(containerEl, 'New'))).toBe(true);

		view.setProjection('deliverables');
		expect(folded(columnByName(containerEl, 'New'))).toBe(false);
	});
});

describe('the done column’s own default', () => {
	it('starts folded where it holds nothing but finished work', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('Shipped.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		const { containerEl } = makeBoard(vault, {}, { foldedColumns: true });

		expect(folded(columnByName(containerEl, 'Done'))).toBe(true);
		// Only the done one: the default is about finished noise, not about columns.
		expect(folded(columnByName(containerEl, 'New'))).toBe(false);
	});

	it('starts open where a done card still carries open work below it', () => {
		// Extension 2a: a retained card's rollup is not noise.
		const { containerEl } = makeBoard(openVault(), {}, { foldedColumns: true });
		expect(folded(columnByName(containerEl, 'Done'))).toBe(false);
	});

	it('takes no default while the column holds nothing at all', () => {
		// Settling is permanent, so a default taken on an empty board is a default taken on
		// no evidence. A board drawn before its results arrive has an empty Done like every
		// other column; without the population term it shut Done for good and handed the
		// work back folded when it turned up. Found by review, PR #140.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('Shipped.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		const { view, containerEl } = makeView(vault, BOARD_WORKFLOW, { collapsed: true, only: [] });
		view.setProjection('board');
		expect(folded(columnByName(containerEl, 'Done'))).toBe(false);

		refresh(view, vault);

		// And the default is still there to be taken the moment there IS evidence for it.
		expect(folded(columnByName(containerEl, 'Done'))).toBe(true);
	});

	it('still folds when the completed items it holds are the ones being hidden', () => {
		// Found by review (Codex, PR #140). "Show completed items" off takes every finished
		// subtree out of the POPULATION, so a done column of finished work reported
		// `fullCount === 0` and read as empty — and the guard against settling an empty
		// column then blocked the fold in exactly the configuration it exists for.
		// Extension 3b of the requirement: the stage still renders, folded at most.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('Shipped.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		const { containerEl } = makeBoard(vault, { showCompleted: false }, { foldedColumns: true });

		expect(cardTitles(columnByName(containerEl, 'Done'))).toEqual([]);
		expect(folded(columnByName(containerEl, 'Done'))).toBe(true);
	});

	it('takes no default from a column the board holds nothing for', () => {
		// The other side of the same term, and why it is there: settling is permanent, so a
		// board with nothing in it must not shut Done for good and hand the work back
		// folded when it arrives.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const { containerEl } = makeBoard(vault, {}, { foldedColumns: true });

		expect(folded(columnByName(containerEl, 'Done'))).toBe(false);
	});

	it('never folds again once the reader has opened it', () => {
		// The tree's own rule: a default applies to what nobody has ruled on. Without the
		// second list the next data update would shut the column in front of the user who
		// had just opened it.
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'Epic', order: 20, status: 'Done' } });
		const { view, containerEl } = makeBoard(vault, {}, { foldedColumns: true });
		expect(folded(columnByName(containerEl, 'Done'))).toBe(true);

		foldButton(columnByName(containerEl, 'Done')).click();
		refresh(view, vault);

		expect(folded(columnByName(containerEl, 'Done'))).toBe(false);
	});
});

describe('the fold and a context card', () => {
	it('never folds a column whose context card is standing for open results', () => {
		// The blank-board case, driven end to end: focused at Epic with the epic excluded,
		// the context card in Done is the only card on the board and the open PBI beneath
		// it has none of its own. A Done column folded on its silence left every column
		// empty and no advisory — the board simply showed nothing.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Done' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'Epic' });
		const { view, containerEl } = makeView(vault, BOARD_WORKFLOW, {
			collapsed: true,
			only: ['PBI.md'],
			focus: 'Epic',
		});
		view.setProjection('board');

		expect(folded(columnByName(containerEl, 'Done'))).toBe(false);
		expect(cardTitles(columnByName(containerEl, 'Done'))).toEqual(['Epic']);
	});
});

describe('folding a horizon bucket', () => {
	it('takes its cards off the roadmap and stays a drop target', async () => {
		const vault = horizonVault();
		const { containerEl } = makeRoadmap(vault, { horizonValues: 'Now, Next, Later' });
		const now = bucketByName(containerEl, 'Now');
		expect(now.querySelectorAll('.pbl-card')).toHaveLength(1);

		foldButton(now).click();

		const shut = bucketByName(containerEl, 'Now');
		expect(folded(shut)).toBe(true);
		expect(shut.querySelectorAll('.pbl-card')).toHaveLength(0);
		expect(shut.querySelector('.pbl-bucket-count')?.textContent).toBe('1');

		cardDrag(bucketByName(containerEl, 'Later').querySelector<HTMLElement>('.pbl-card') ?? shut, shut);
		await flush();
		expect(vault.fm('Later item.md')['horizon']).toBe('Now');
	});

	it('says it is folded, the column stop’s own reason', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		expect(bucketByName(containerEl, 'Now').getAttribute('aria-label')).toBe('Now, 1 item');

		foldButton(bucketByName(containerEl, 'Now')).click();

		expect(bucketByName(containerEl, 'Now').getAttribute('aria-label')).toBe('Now, collapsed, 1 item');
	});

	it('never folds itself, whatever the cards in it say', () => {
		// An axis has no notion of finished, so there is no default to take — a bucket is
		// open until a reader shuts it.
		const { containerEl } = makeRoadmap(horizonVault());
		expect(folded(bucketByName(containerEl, 'Now'))).toBe(false);
	});

	it('does not make the roadmap claim it is empty', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		for (const name of ['Now', 'Later']) foldButton(bucketByName(containerEl, name)).click();
		expect(containerEl.querySelector('.pbl-board-advisory')).toBeNull();
	});

	it('keeps its fold apart from a board column spelled the same', () => {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'Epic', order: 10, status: 'Now', horizon: 'Now' } });
		const { view, containerEl } = makeRoadmap(vault, { ...BOARD_WORKFLOW, stateValues: 'Now, Done' });
		foldButton(bucketByName(containerEl, 'Now')).click();
		expect(folded(bucketByName(containerEl, 'Now'))).toBe(true);

		view.setProjection('board');
		expect(folded(columnByName(containerEl, 'Now'))).toBe(false);
	});

	it('has no keyboard path, which is the bucket gap and not a fold gap', () => {
		// A bucket is not a keyboard stop, so nothing selects one to act on and the card
		// menu is about a card. Recorded here rather than left to be discovered: the board
		// column's fold IS reachable from its stop's menu, and this one is not, until
		// `docs/requirements/Keyboard and menu on the roadmap.md` gives buckets stops.
		const { containerEl } = makeRoadmap(horizonVault());
		const card = bucketByName(containerEl, 'Now').querySelector<HTMLElement>('.pbl-card');
		card?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		// The card's own menu opened — so this is a statement about what is IN it, not
		// about a menu that failed to appear.
		expect(Menu.lastShown?.item('Set horizon')).toBeDefined();
		expect(Menu.lastShown?.item('Collapse Now')).toBeUndefined();
	});
});
