// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { clickExpandAll, flush, key, makeView, refresh, rowByTitle, treeOf, useViewHarness } from '../helpers/view';

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

/**
 * The sibling case: the SUBJECT is still here, but the note a command's own label
 * names as its destination is not. `indent` re-resolves `namedParentPath` by path
 * before planning, and a miss there must report the same way `liveItem` does for a
 * vanished subject — the docblock's own words are "refuse if it is no longer a valid
 * destination", not "refuse in silence".
 */
describe('indent whose named destination left the base', () => {
	function view() {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 30 }, parentLink: 'Epic' });
		const harness = makeView(vault);
		clickExpandAll(harness.containerEl);
		return { ...harness, vault };
	}

	it('reports the vanished destination and writes nothing', async () => {
		const harness = view();
		rowByTitle(harness.containerEl, 'F2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('menu not shown');
		const entry = menu.item('Indent under "F1"');
		expect(entry).toBeDefined();

		// F1 — the named destination, not F2 the subject — drops out of the results.
		const anyView = harness.view as unknown as Record<string, unknown>;
		anyView.data = { data: harness.vault.entries().filter((e) => e.file.path !== 'F1.md') };
		harness.view.onDataUpdated();
		Notice.messages = [];

		entry?.click();
		await flush();

		expect(harness.vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([GONE]);
	});
});

/** What `indent` says when its named destination resolved but is no longer a valid parent. */
const TARGET_INVALID = 'That is no longer a valid destination, so nothing was moved.';

/**
 * The other half of the sibling case: the named destination did not vanish, it stopped
 * being a valid PARENT while the menu sat open — `indentTarget` refuses it for a reason
 * `rank.itemGone` cannot honestly say, since the note is still in this base. Two ways to
 * get there (Task 6's brief): retyped onto the other ladder, and turned into the
 * subject's own descendant. Both go through the menu path, which names the destination
 * and so must report; both are proven silent on the keyboard path beside them, which
 * names nothing and computes its own neighbour fresh — see `indentTarget`'s own comment
 * on why a null target there is "not expressible" rather than a refusal to report.
 */
describe('indent whose named destination resolves but is no longer valid', () => {
	it('reports a destination retyped onto the other ladder, and stays silent on the keyboard path for the same condition', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('T1.md', { frontmatter: { type: 'Task', order: 30 }, parentLink: 'Epic' });
		const { containerEl, view } = makeView(vault);
		clickExpandAll(containerEl);

		rowByTitle(containerEl, 'T1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('menu not shown');
		const entry = menu.item('Indent under "F1"');
		expect(entry).toBeDefined();

		// F1 stays in the base and stays T1's previous sibling — it is retyped onto the
		// test ladder, which is what `keepsProjection` refuses: T1 is a `Task`, ambiguous
		// between both ladders, and would cross into the catalog rather than stay on the
		// plan its real parent (`Epic`) still puts it on.
		vault.setFrontmatter('F1.md', { type: 'Test suite', order: 20 });
		refresh(view, vault);
		Notice.messages = [];

		entry?.click();
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([TARGET_INVALID]);

		// The keyboard path, asked of the SAME condition with no path named: `visibleNeighbor`
		// recomputes T1's previous sibling fresh and finds the same now-retyped F1, so
		// `indentTarget` refuses the same way — but Alt+Right draws no label and promises no
		// note, so a null target there must stay silent rather than borrow this sentence.
		Notice.messages = [];
		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown'); // Epic
		key(tree, 'ArrowDown'); // F1
		key(tree, 'ArrowDown'); // T1
		key(tree, 'ArrowRight', { altKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([]);
	});

	it('reports a destination that became the subject’s own descendant', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 30 }, parentLink: 'Epic' });
		const { containerEl, view } = makeView(vault);
		clickExpandAll(containerEl);

		rowByTitle(containerEl, 'F2').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		if (!menu) throw new Error('menu not shown');
		const entry = menu.item('Indent under "F1"');
		expect(entry).toBeDefined();

		// F1 stays in the base but is reparented under F2 — the subject the menu was
		// opened on — which is what `isInvalidParent` refuses: nesting F2 under its own
		// child. `setFrontmatter` alone leaves the old `parentLink` cache entry standing
		// (its own doc: it replaces `cache.frontmatter`, not `frontmatterLinks`), so the
		// resolved link is rewritten by hand the way `addFile` would have produced it.
		vault.setFrontmatter('F1.md', { type: 'Feature', order: 20, parent: '[[F2]]' });
		const f1Cache = vault.caches.get('F1.md');
		if (f1Cache) f1Cache.frontmatterLinks = [{ key: 'parent', link: 'F2', original: '[[F2]]' }];
		refresh(view, vault);
		Notice.messages = [];

		entry?.click();
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([TARGET_INVALID]);
	});
});

/**
 * The same fact asked at the FORBIDDEN THING rather than at the four places that reach
 * it. The gate's exclusion test used to read `outsideFilter === true`, which answers
 * false for a path the model does not hold — so absence, which is a different fact from
 * "present and included", authorized the write. Every caller is a place somebody thought
 * of; the gate holds for the one written next year.
 */
describe('the write gate on a note the model does not hold', () => {
	it('refuses the whole batch and says so', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		// In the vault, never in the results: the base returns `Epic` alone, and nothing
		// claims this note as an ancestor, so it is in no `byPath` this view ever builds.
		const outside = vault.addFile('Elsewhere.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { view } = makeView(vault, {}, { only: ['Epic.md'] });
		Notice.messages = [];

		expect(await view.applySafely([{ file: outside, order: 99 }])).toBeNull();
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'That change would edit a note outside this base’s filter, so nothing was written.',
		]);
	});
});
