// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { clickExpandAll, flush, makeView, rowByTitle, useViewHarness } from '../helpers/view';

useViewHarness();

/** What every structural command says when its subject has left the base. */
const GONE = 'That item is no longer in this base, so nothing was moved.';

/**
 * A context menu captures its row when it opens. A Bases refresh in between can drop that
 * row from the results — and when nothing below it matched either, the note is not even
 * loaded as a context row, so the model does not hold it at all.
 *
 * That absence is the write gate's blind spot from the other side: `outsideFilter` reads
 * the item's own flag, and a path the model never returned has no flag to read. So the
 * refusal has to be at the SUBJECT: `liveItem` answers null and each of the four
 * structural commands says so and stops.
 */
describe('a structural command whose subject left the base', () => {
	/**
	 * `F2` is the subject and is deliberately a LEAF: a parent dropped from the results is
	 * pulled back in as a context row, which the gate already refuses. Only a note nothing
	 * claims as an ancestor goes missing from `byPath` altogether, which is the case this
	 * file is about. Every rank distinct, so all six entries plan a real number and the
	 * menu offers them all while the row is still there.
	 */
	function view() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 30 }, parentLink: 'Epic' });
		vault.addFile('F3.md', { frontmatter: { type: 'Feature', order: 40 }, parentLink: 'Epic' });
		const harness = makeView(vault);
		clickExpandAll(harness.containerEl);
		return { ...harness, vault };
	}

	/** Hand the view a result set without `F2`, the way a Bases refresh would. */
	function dropSubject(harness: ReturnType<typeof view>): void {
		const anyView = harness.view as unknown as Record<string, unknown>;
		anyView.data = { data: harness.vault.entries().filter((e) => e.file.path !== 'F2.md') };
		harness.view.onDataUpdated();
	}

	/**
	 * All four entry points from the one surface that can hold a stale subject, driven as
	 * six menu entries because that is how many the four commands reach the reader as.
	 *
	 * **`Indent under "F1"` is the one that wrote.** Its named parent is still there, so
	 * the target resolved, the placement returned a real rank and the gate waved the batch
	 * through — `parent` and `order` onto a note this base no longer returns. `Move to
	 * bottom` wrote too, and worse: ranked against the STALE peer list it landed `-990`.
	 * The other four refused already — but in silence, or, through `performDrop`'s
	 * reporter, naming the backfill as the remedy for a note the backfill will never see.
	 * Both halves of this assertion fail without the fix, and they were watched failing
	 * separately.
	 */
	it('writes nothing and names the note for every entry the menu offered', async () => {
		const harness = view();
		rowByTitle(harness.containerEl, 'F2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('menu not shown');
		const titles = ['Move up', 'Move down', 'Move to top', 'Move to bottom', 'Outdent', 'Indent under "F1"'];
		for (const title of titles) expect(menu.item(title), title).toBeDefined();

		dropSubject(harness);
		Notice.messages = [];
		for (const title of titles) {
			menu.item(title)?.click();
			await flush();
		}

		expect(harness.vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual(titles.map(() => GONE));
	});
});
