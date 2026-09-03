// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { clickExpandAll, drag, flush, key, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('an unranked context row among focused peers', () => {
	/**
	 * A focus rank whose context row was never ranked at all — `PBI Ctx` carries no
	 * `order` frontmatter, unlike `test/view/contextRowWrites.test.ts`'s own
	 * `focusedStressView`. The writable row (`PBI A`, 1000) draws before it, since a
	 * null order sorts last, and that draw order is the whole reason `Move down` used
	 * to be offered here: the unranked peer read as a neighbour to swap past, the write
	 * landed (a real order, 2000), the undo slot was spent, and the draw came out
	 * identical because a null order still sorts last at any magnitude. `siblingContext`
	 * must exclude a context row with nothing to rank from (the same test
	 * `anchoredOrder`'s own `isUnrankedContext` already applies) from the focused peers,
	 * so the command is refused rather than offered and spent.
	 */
	function unrankedContextView() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('PBI Ctx.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		vault.addFile('Task Ctx.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI Ctx' });
		vault.addFile('PBI A.md', { frontmatter: { type: 'PBI', order: 1000 }, parentLink: 'Epic' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = {
			data: vault.entries().filter((e) => !['Epic.md', 'PBI Ctx.md'].includes(e.file.path)),
		};
		view.onDataUpdated();
		view.setFocusLevel('PBI');
		clickExpandAll(containerEl);
		return { view, containerEl, vault };
	}

	it('draws the writable row before its unranked context peer, not vacuously', () => {
		const { view, containerEl } = unrankedContextView();
		const ctx = view.model?.byPath.get('PBI Ctx.md');
		expect(ctx?.outsideFilter).toBe(true);
		expect(ctx?.order).toBeNull();
		expect(ctx?.focusRoot).toBe(true);
		expect(titlesOf(containerEl)).toEqual(['PBI A', 'PBI Ctx', 'Task Ctx']);
	});

	it('does not offer Move down past a context row with nothing to rank from', () => {
		const { containerEl } = unrankedContextView();

		rowByTitle(containerEl, 'PBI A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).not.toContain('Move down');
	});

	it('writes nothing when the row is DRAGGED onto that context peer either', async () => {
		// The drag reaches the same focus branch Alt+arrow does, and must refuse the same
		// anchor: `anchoredOrder` would read a rankless row as no position at all and send
		// the card to the end of the whole population, which is not where it was dropped.
		const { containerEl, vault } = unrankedContextView();

		drag(rowByTitle(containerEl, 'PBI A'), rowByTitle(containerEl, 'PBI Ctx'), 'after');
		await flush();

		expect(vault.writeLog.length).toBe(0);
	});

	it('writes nothing and moves nothing when Alt+ArrowDown is pressed anyway', async () => {
		const { view, containerEl, vault } = unrankedContextView();
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('PBI A.md') as never);

		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.writeLog.length).toBe(0);
		expect(titlesOf(containerEl)).toEqual(['PBI A', 'PBI Ctx', 'Task Ctx']);
	});
});

describe('ranking PAST an unranked context row', () => {
	/**
	 * The row is not the ANCHOR here — it merely sits among the focus rows, above the one
	 * the gesture aims at. `siblingPosition`'s focus branch built its peers unfiltered, so
	 * `orderForTarget` picked the rankless row as the anchor and `anchoredOrder` read that
	 * as "no position at all" — appending to the END of the whole population, which is the
	 * opposite end of the backlog from where the user aimed. `siblingContext` filtered the
	 * same list and the keyboard landed where it was aimed, so the drag and the two other
	 * inputs disagreed about one gesture.
	 *
	 * The writable rows are TIED deliberately: an unranked context row sorts last in rank
	 * order, so the only way one is drawn ABOVE a writable row is the tree-order fallback
	 * `inRankOrder` keeps for a population that is not distinctly ranked.
	 */
	function focusedView(sequence: ('Ctx' | 'A' | 'B')[]) {
		const vault = new FakeVault();
		const excluded = ['PBI Ctx.md'];
		sequence.forEach((name, i) => {
			const epic = `Epic ${i + 1}`;
			vault.addFile(`${epic}.md`, { frontmatter: { type: 'Epic', order: (i + 1) * 10 } });
			excluded.push(`${epic}.md`);
			if (name === 'Ctx') {
				vault.addFile('PBI Ctx.md', { frontmatter: { type: 'PBI' }, parentLink: epic });
				vault.addFile('Task Ctx.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI Ctx' });
			} else {
				vault.addFile(`PBI ${name}.md`, { frontmatter: { type: 'PBI', order: 5000 }, parentLink: epic });
			}
		});
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		anyView.config = new FakeViewConfig({});
		anyView.data = { data: vault.entries().filter((e) => !excluded.includes(e.file.path)) };
		view.onDataUpdated();
		view.setFocusLevel('PBI');
		clickExpandAll(containerEl);
		return { view, containerEl, vault };
	}

	/** The order this gesture wrote to `PBI B`, or null when it wrote nothing. */
	function rankOf(vault: FakeVault, path: string): number | null {
		const last = vault.writeLog.filter((w) => w.path === path).pop();
		return last === undefined ? null : (last.fm.order as number);
	}

	it('draws the unranked context row first, above both tied writable rows', () => {
		const { containerEl } = focusedView(['Ctx', 'A', 'B']);
		expect(titlesOf(containerEl)).toEqual(['PBI Ctx', 'Task Ctx', 'PBI A', 'PBI B']);
	});

	/**
	 * **This test asserted a write until 2026-09-03, and the write was wrong.** Its subject —
	 * that the drag, the keyboard and the menu answer identically — is intact and is what it
	 * still checks. What changed is the answer all three give.
	 *
	 * The fixture is a focused list whose unranked context row is drawn FIRST. A null sorts
	 * LAST the moment the fallback lifts, so any write that breaks the `A`/`B` tie moves that
	 * row from the top to the bottom: measured, dropping `PBI B` above `PBI A` wrote 2525 and
	 * returned `B, A, Ctx` for a gesture that asked for `Ctx, B, A`. The rank the three inputs
	 * agreed on was a rank that produced the wrong screen, so agreeing on it was not enough.
	 *
	 * No rank can do better here, which is why this is a refusal rather than a better number:
	 * the context row's position is fixed at last-once-sorted and nothing can ever give it a
	 * rank. So the capability this file was written to prove was never really present in this
	 * shape — it looked present because the assertion stopped at the write.
	 */
	it('has the drag, Alt+ArrowUp and the move menu all REFUSE, identically', async () => {
		const dragged = focusedView(['Ctx', 'A', 'B']);
		drag(rowByTitle(dragged.containerEl, 'PBI B'), rowByTitle(dragged.containerEl, 'PBI A'), 'before');
		await flush();

		const keyed = focusedView(['Ctx', 'A', 'B']);
		keyed.view.selectItem(keyed.view.model?.byPath.get('PBI B.md') as never);
		key(treeOf(keyed.containerEl), 'ArrowUp', { altKey: true });
		await flush();

		const menued = focusedView(['Ctx', 'A', 'B']);
		rowByTitle(menued.containerEl, 'PBI B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.items.find((i) => i.titleText === 'Move up')?.clickHandler?.();
		await flush();

		// All three decline, and none of them writes a rank that would move the context row.
		expect(rankOf(dragged.vault, 'PBI B.md')).toBeNull();
		expect(rankOf(keyed.vault, 'PBI B.md')).toBeNull();
		expect(rankOf(menued.vault, 'PBI B.md')).toBeNull();
	});

	// **The context row is ABOVE both, and the dragged row is the LAST one.** That is what
	// makes this discriminating, and the first version of this test was not: with the
	// context row in the middle and the FIRST row dragged, both index lists answer 0 and
	// the assertion passed whichever list the guard read. Here they disagree by exactly the
	// one unranked context row above — `rankablePeers(model.roots)` says 1, `model.roots`
	// says 2 — so a
	// guard reading the unfiltered list misses the no-op and writes to a row that did not
	// move. Peers and index have to come off the SAME list, and only this shape shows it.
	/**
	 * **Shadowed as of 2026-09-03, and kept with that said out loud.** The refusal above now
	 * answers this fixture too, so a zero-write assertion here would pass with the no-op
	 * check deleted — it would prove nothing about the index lists it was written for.
	 *
	 * The subject is still worth a test and the fixture is the wrong one for it; the shape
	 * that discriminates needs a focused list the guard does not refuse, which is a fixture
	 * with no unranked context row drawn above the rows in play. Recorded rather than
	 * quietly left green: a test that cannot fail for its own reason is not coverage, and
	 * this file's own comment above says exactly that about its first version.
	 */
	it.todo('reads the no-op index off the same filtered list, on a fixture the guard allows');
});
