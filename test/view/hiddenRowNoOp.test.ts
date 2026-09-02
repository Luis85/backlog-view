// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { clickExpandAll, drag, flush, rowByTitle, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * **A drop that changes nothing the user can see must write nothing**, and the completed
 * toggle is the case both no-op checks used to miss.
 *
 * Hiding is a RENDER decision — `model.roots` and every sibling list keep the done row, so
 * it is still a ranking NEIGHBOUR, which is right and is what [[Rollups and hiding finished
 * work]] guarantees. What was wrong is that the two no-op comparisons counted it as a row a
 * drop could be said to have moved PAST. With `A`, a hidden done `H` and `B` ranked in that
 * order, dropping `B` straight after `A` — where it already appears — read as a move into
 * the slot before `H`: a write, an undo slot spent, and an identical screen.
 *
 * `visibleNeighbor` has always skipped hidden rows so that "structural commands never
 * produce a visually inert change". These two drive the DRAG against the same promise, on
 * both branches of `dropTargetFor` — the focused list and the ordinary tree.
 *
 * The fixture is built so the two readings DISAGREE. `H` sits between the two visible rows,
 * so a raw index says `B` is at 2 while the drawn order says 1; put the hidden row last and
 * both readings answer the same thing and the test passes either way, which is the failure
 * this file exists to avoid rather than demonstrate.
 */
function threeWithAHiddenMiddle(focus: boolean) {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
	vault.addFile('PBI A.md', { frontmatter: { type: 'PBI', order: 1000, status: 'New' }, parentLink: 'Epic' });
	vault.addFile('PBI H.md', { frontmatter: { type: 'PBI', order: 2000, status: 'Done' }, parentLink: 'Epic' });
	vault.addFile('PBI B.md', { frontmatter: { type: 'PBI', order: 3000, status: 'New' }, parentLink: 'Epic' });
	const containerEl = document.body.createDiv();
	const view = new ProductBacklogView({} as never, containerEl);
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = new FakeViewConfig({ stateProperty: 'note.status' });
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();
	view.setShowCompleted(false);
	if (focus) view.setFocusLevel('PBI');
	clickExpandAll(containerEl);
	return { view, containerEl, vault };
}

describe('a drop past a row the completed toggle is hiding', () => {
	it('writes nothing in a focused list, where the row is already where it lands', async () => {
		const { containerEl, vault } = threeWithAHiddenMiddle(true);
		// The hidden row is absent from the screen and present in the ranking population.
		expect(titlesOf(containerEl)).toEqual(['PBI A', 'PBI B']);

		drag(rowByTitle(containerEl, 'PBI B'), rowByTitle(containerEl, 'PBI A'), 'after');
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('writes nothing in the tree, which had the same gap', async () => {
		const { containerEl, vault } = threeWithAHiddenMiddle(false);
		expect(titlesOf(containerEl)).toEqual(['Epic', 'PBI A', 'PBI B']);

		drag(rowByTitle(containerEl, 'PBI B'), rowByTitle(containerEl, 'PBI A'), 'after');
		await flush();

		expect(vault.writeLog).toEqual([]);
	});
});

/**
 * The same rule, asked of the MENU — and the half that was still open, though not where
 * it first looked. `buildMoveSection` already gates each edge entry on a VISIBLE
 * neighbour (`rankedBottom && next`), so the entry is never offered against a hidden row.
 * What it cannot gate is the click that comes AFTER: a menu is built from the model of
 * the moment, and the completed toggle can hide the peer it was gated on before the user
 * picks anything.
 *
 * `moveToEdge` re-resolves the SUBJECT for exactly that reason, then recomputed the
 * target with a raw index into `fullList` — which keeps the hidden row, because hiding is
 * a render decision and the row is still a ranking neighbour ([[Rollups and hiding
 * finished work]]). So the subject read as "not yet at the bottom", was ranked past a row
 * nobody can see, and the screen came back identical with an undo slot spent.
 *
 * **The gesture has to be driven across the toggle**, which is why these two cost a
 * fixture of their own rather than an assertion on the menu: with the row hidden from the
 * start the entry is absent and the test passes against the unfixed code, which is the
 * shape this file exists to avoid. Watched failing before the guard, both directions,
 * because the guard is one ternary and a one-sided test passes against half of it.
 */
function twoVisibleWithAHiddenEdge(edge: 'top' | 'bottom') {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
	// The completed row takes the outermost rank, so once it is hidden the subject is the
	// outermost VISIBLE row while `fullList` still holds one row beyond it.
	const ranks = edge === 'bottom' ? { a: 1000, b: 2000, h: 3000 } : { h: 1000, a: 2000, b: 3000 };
	vault.addFile('PBI A.md', { frontmatter: { type: 'PBI', order: ranks.a, status: 'New' }, parentLink: 'Epic' });
	vault.addFile('PBI B.md', { frontmatter: { type: 'PBI', order: ranks.b, status: 'New' }, parentLink: 'Epic' });
	vault.addFile('PBI H.md', { frontmatter: { type: 'PBI', order: ranks.h, status: 'Done' }, parentLink: 'Epic' });
	const containerEl = document.body.createDiv();
	const view = new ProductBacklogView({} as never, containerEl);
	const anyView = view as unknown as Record<string, unknown>;
	anyView.app = vault.app;
	anyView.config = new FakeViewConfig({ stateProperty: 'note.status' });
	anyView.data = { data: vault.entries() };
	view.onDataUpdated();
	// Completed rows SHOWN while the menu is built — that is what makes the entry appear.
	view.setShowCompleted(true);
	clickExpandAll(containerEl);
	return { view, containerEl, vault };
}

describe('an edge move whose anchor the completed toggle hides between offer and click', () => {
	it('writes nothing for Move to bottom', async () => {
		const { view, containerEl, vault } = twoVisibleWithAHiddenEdge('bottom');
		expect(titlesOf(containerEl)).toEqual(['Epic', 'PBI A', 'PBI B', 'PBI H']);

		rowByTitle(containerEl, 'PBI B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const entry = Menu.lastShown?.item('Move to bottom');
		expect(entry).toBeDefined();

		// The peer the entry was gated on goes away while the menu is open.
		view.setShowCompleted(false);
		expect(titlesOf(containerEl)).toEqual(['Epic', 'PBI A', 'PBI B']);

		entry?.click();
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('writes nothing for Move to top', async () => {
		const { view, containerEl, vault } = twoVisibleWithAHiddenEdge('top');
		expect(titlesOf(containerEl)).toEqual(['Epic', 'PBI H', 'PBI A', 'PBI B']);

		rowByTitle(containerEl, 'PBI A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const entry = Menu.lastShown?.item('Move to top');
		expect(entry).toBeDefined();

		view.setShowCompleted(false);
		expect(titlesOf(containerEl)).toEqual(['Epic', 'PBI A', 'PBI B']);

		entry?.click();
		await flush();

		expect(vault.writeLog).toEqual([]);
	});
});
