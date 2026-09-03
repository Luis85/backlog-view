// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import {
	drag,
	flush,
	key,
	makeView,
	refresh,
	rowByTitle,
	rows,
	titlesOf,
	treeOf,
	useViewHarness,
} from '../helpers/view';

useViewHarness();

/**
 * A focus level re-roots the tree at one rung, and Task 5 makes those promoted rows a
 * legal rank destination: `siblingPosition` now answers for two active focus rows
 * rather than refusing on `item.focusRoot`. Two epics, so the two PBIs it ranks against
 * each other have different REAL parents — the case the brief resolves explicitly: the
 * rank writes `order` and never touches `parent`.
 */
function focusedFixture() {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
	vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 2000 }, parentLink: 'Epic A' });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 3000 } });
	vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 4000 }, parentLink: 'Epic B' });
	return vault;
}

describe('focus rows accept a rank', () => {
	it('ranks a focused PBI above one with a different parent, writing order only', async () => {
		const vault = focusedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });
		// Captured before the drop: `parentLink` seeds a real `parent: [[Epic B]]` key
		// (Obsidian indexes a resolved bracketed link), so the write's whole frontmatter
		// object is compared rather than probing for one key's absence — an implementation
		// that reparented onto the hovered row's own parent would still leave a `parent`
		// key on the note, just holding `[[Epic A]]` instead.
		const before = { ...vault.fm('PBI B1.md') };

		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'before');
		await flush();

		expect(vault.writeLog.map((w) => w.path)).toEqual(['PBI B1.md']);
		// Every other key, `parent` included, is exactly what it was — only `order` moved.
		expect(vault.fm('PBI B1.md')).toEqual({ ...before, order: 1500 });
	});

	it('drops a focused row back onto its own position and writes nothing', async () => {
		const vault = focusedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		// PBI B1 is already second; dropping it right after PBI A1 asks for the slot
		// it already occupies. `peers` reproduces `model.roots` when the row is
		// spliced back in, so this must read as no move at all rather than a rank
		// that spends the undo slot with nothing changed on screen.
		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'after');
		await flush();

		expect(vault.writeLog).toEqual([]);
	});
});

/**
 * The same fixture with `PBI B1`'s parent link pointing at a note that does not exist —
 * the raw bracketed spelling a vault produces for an unresolved link, so no
 * `frontmatterLinks` entry (see `test/CLAUDE.md`). `parent === null` and
 * `hasParentValue` is true, which is exactly the pair an EXPLICIT top-level drop shows,
 * and the only thing that tells them apart is `DropTarget.parentUnchanged`.
 */
function orphanedFixture() {
	const vault = focusedFixture();
	vault.addFile('PBI B1.md', {
		frontmatter: { type: 'PBI', order: 4000, parent: '[[No Such Note]]' },
	});
	return vault;
}

/**
 * A focus level whose top row is a CONTEXT row with a rank. `Epic` and `PBI Ctx` are
 * outside the base; `PBI Ctx` still loads, as the ancestor of a result (`Task Ctx`), and
 * `collectFocusRoots` promotes it on level match alone — so it is drawn among the focus
 * peers, ranked, and immovable.
 */
function contextFocusFixture() {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 5 } });
	vault.addFile('PBI Ctx.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic' });
	vault.addFile('Task Ctx.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI Ctx' });
	vault.addFile('PBI A.md', { frontmatter: { type: 'PBI', order: 30 }, parentLink: 'Epic' });
	vault.addFile('PBI B.md', { frontmatter: { type: 'PBI', order: 40 }, parentLink: 'Epic' });
	return vault;
}

/** Select a row through the tree's own keyboard, so Alt+arrow acts on it. */
function selectRow(containerEl: HTMLElement, title: string): HTMLElement {
	const tree = treeOf(containerEl);
	for (const row of rows(containerEl)) {
		key(tree, 'ArrowDown');
		if (row.querySelector('.pbl-title')?.textContent === title) return tree;
	}
	throw new Error(`row not selectable: ${title}`);
}

/** Open the row's context menu and return the titles it offered. */
function menuTitles(containerEl: HTMLElement, title: string): string[] {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error('menu not shown');
	return menu.items.map((i) => i.titleText);
}

describe('one rank, three inputs', () => {
	/**
	 * The contract Task 6 exists for: a focus row is a ranking destination for the drag,
	 * the keyboard and the menu alike, and the three land the SAME number. Three views
	 * over three fresh vaults rather than one view undone twice — an undo that restored a
	 * DIFFERENT number would still leave the comparison green.
	 */
	it('lands the same rank from the drag, Alt+arrow and the menu', async () => {
		const dragVault = focusedFixture();
		const dragView = makeView(dragVault, {}, { focus: 'PBI' });
		drag(rowByTitle(dragView.containerEl, 'PBI B1'), rowByTitle(dragView.containerEl, 'PBI A1'), 'before');
		await flush();

		const keyVault = focusedFixture();
		const keyView = makeView(keyVault, {}, { focus: 'PBI' });
		key(selectRow(keyView.containerEl, 'PBI B1'), 'ArrowUp', { altKey: true });
		await flush();

		const menuVault = focusedFixture();
		const menuView = makeView(menuVault, {}, { focus: 'PBI' });
		menuTitles(menuView.containerEl, 'PBI B1');
		Menu.lastShown?.item('Move up')?.click();
		await flush();

		const byDrag = dragVault.fm('PBI B1.md')['order'];
		// Stated as well as compared: three inputs agreeing on nothing written is the way
		// this comparison passes while the feature is missing.
		expect(byDrag).toBe(1500);
		expect(keyVault.fm('PBI B1.md')['order']).toBe(byDrag);
		expect(menuVault.fm('PBI B1.md')['order']).toBe(byDrag);
	});

	/**
	 * The same three inputs beside a RANKED context row, which is where they disagreed:
	 * `siblingContext` keeps such a row among the focus peers on purpose — its order is a
	 * real placement constraint — while `siblingPosition` refused it as a drop anchor, so
	 * Alt+arrow and the menu ranked across a row the drag would not even draw an indicator
	 * for. The refusal's reason is about reparenting and a focus rank changes no parent.
	 */
	it('lands the same rank from all three beside a ranked context row', async () => {
		const run = async (gesture: (containerEl: HTMLElement) => void) => {
			const vault = contextFocusFixture();
			const { containerEl } = makeView(vault, {}, { focus: 'PBI', only: ['Task Ctx.md', 'PBI A.md', 'PBI B.md'] });
			gesture(containerEl);
			await flush();
			return vault;
		};

		const byDrag = await run((el) => drag(rowByTitle(el, 'PBI A'), rowByTitle(el, 'PBI Ctx'), 'before'));
		const byKey = await run((el) => key(selectRow(el, 'PBI A'), 'ArrowUp', { altKey: true }));
		const byMenu = await run((el) => {
			menuTitles(el, 'PBI A');
			Menu.lastShown?.item('Move up')?.click();
		});

		// Between the context row (20) and the row ranked below it (10) — stated as well as
		// compared, because three inputs writing nothing agree too.
		expect(byDrag.fm('PBI A.md')['order']).toBe(15);
		expect(byKey.fm('PBI A.md')['order']).toBe(15);
		expect(byMenu.fm('PBI A.md')['order']).toBe(15);
		// The anchor is still a note this base may not touch, from any of the three.
		for (const vault of [byDrag, byKey, byMenu]) {
			expect(vault.writeLog.map((w) => w.path)).toEqual(['PBI A.md']);
		}
	});

	it('still refuses indent and outdent across the focus row', () => {
		const { containerEl } = makeView(focusedFixture(), {}, { focus: 'PBI' });

		const titles = menuTitles(containerEl, 'PBI B1');
		expect(titles).toContain('Move up');
		expect(titles.some((title) => title.startsWith('Indent'))).toBe(false);
		expect(titles).not.toContain('Outdent');
	});

	/**
	 * `focusRoot` is set on any promoted root, focus or no focus — a catalog `Test suite`
	 * under an `Epic` carries it while its real siblings are off screen. Membership in an
	 * ACTIVE focus forest is the test, so this one keeps the refusal. Non-vacuous by
	 * construction: `Suite 0` is a real previous sibling, so a `siblingContext` that fell
	 * through to the parent's children would offer `Move up` here.
	 */
	it('refuses to rank a promoted root that is not an active focus row', () => {
		const vault = focusedFixture();
		vault.addFile('Suite 0.md', { frontmatter: { type: 'Test suite', order: 5000 }, parentLink: 'Epic A' });
		vault.addFile('Suite 1.md', { frontmatter: { type: 'Test suite', order: 6000 }, parentLink: 'Epic A' });
		const { view, containerEl } = makeView(vault, {}, {});
		view.setProjection('catalog');

		const titles = menuTitles(containerEl, 'Suite 1');
		expect(titles).not.toContain('Move up');
		expect(titles).not.toContain('Move to top');
	});
});

describe('a focus rank never touches the parent key', () => {
	/**
	 * The trap this task carries: `DropTarget.parent` for a focus rank RESTATES the moved
	 * row's own parent, and for an unresolved link that value is `null` — indistinguishable
	 * from an explicit top-level drop, which must clear the stale key. Without
	 * `parentUnchanged` the keyboard deletes the property on every focused move.
	 *
	 * The whole frontmatter object is compared, so a DELETED key fails: asserting the
	 * parent is merely "not Epic A" passes on the very bug this pins. `order` is asserted
	 * changed in the same object, so the test cannot pass by refusing the move.
	 */
	it('leaves an unresolved parent link alone when the keyboard ranks a focus row', async () => {
		const vault = orphanedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		key(selectRow(containerEl, 'PBI B1'), 'ArrowUp', { altKey: true });
		await flush();

		expect(vault.fm('PBI B1.md')).toEqual({ type: 'PBI', order: 1500, parent: '[[No Such Note]]' });
	});

	it('leaves it alone when the MENU ranks the same row', async () => {
		const vault = orphanedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		menuTitles(containerEl, 'PBI B1');
		Menu.lastShown?.item('Move up')?.click();
		await flush();

		expect(vault.fm('PBI B1.md')).toEqual({ type: 'PBI', order: 1500, parent: '[[No Such Note]]' });
	});
});

describe('a menu outlives the model it was built from', () => {
	/**
	 * A context menu captures its item when it opens; a Bases refresh while it is open
	 * rebuilds every item as a NEW object, and every lookup on the way to a rank compares
	 * objects (`model.roots.includes`, `children.indexOf`, `ranked.indexOf`). The captured
	 * row is then in none of them and the move does nothing at all, silently. jsdom never
	 * refreshes on its own, so the rebuild here is deliberate.
	 */
	it('ranks the row the menu names after the model was rebuilt under it', async () => {
		const vault = focusedFixture();
		const { view, containerEl } = makeView(vault, {}, { focus: 'PBI' });

		menuTitles(containerEl, 'PBI B1');
		const captured = Menu.lastShown?.item('Move up');
		refresh(view, vault);
		captured?.click();
		await flush();

		expect(vault.fm('PBI B1.md')['order']).toBe(1500);
	});

	/**
	 * The other half of that re-resolution, and the half it broke: re-resolving the
	 * SUBJECT without re-resolving the TARGET makes the label and the write disagree.
	 * `Indent under "X"` is the one entry in this menu whose title names the note it
	 * reparents onto, and the click recomputed that destination from the row's previous
	 * visible neighbour AT CLICK TIME. Before the by-path lookup the stale item simply
	 * failed every lookup and the move refused — silently, but harmlessly; afterwards the
	 * subject resolves, the write lands, and it lands on the wrong parent.
	 *
	 * Both tests rebuild the model deliberately between opening the menu and clicking.
	 * jsdom refreshes on nothing of its own, so a test without that rebuild proves nothing.
	 */
	function indentFixture() {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 2000 }, parentLink: 'Epic A' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 3000 }, parentLink: 'Epic A' });
		return vault;
	}

	it('indents under the note the title named, not the neighbour the refresh produced', async () => {
		const vault = indentFixture();
		const { view, containerEl } = makeView(vault);

		expect(menuTitles(containerEl, 'F2')).toContain('Indent under "F1"');
		const captured = Menu.lastShown?.item('Indent under "F1"');
		// A new sibling lands between the two, so F2's previous visible neighbour is no
		// longer the row the open menu is naming.
		vault.addFile('F15.md', { frontmatter: { type: 'Feature', order: 2500 }, parentLink: 'Epic A' });
		refresh(view, vault);
		captured?.click();
		await flush();

		expect(vault.fm('F2.md')['parent']).toBe('[[F1]]');
	});

	it('refuses when the named note has become the item\'s own descendant', async () => {
		const vault = indentFixture();
		const { view, containerEl } = makeView(vault);

		expect(menuTitles(containerEl, 'F2')).toContain('Indent under "F1"');
		const captured = Menu.lastShown?.item('Indent under "F1"');
		// The named row is still THERE, and still resolves by path — it has just been moved
		// under the very item the menu is about. A previous visible sibling can never be a
		// descendant, so the recomputed destination never had to ask; a re-resolved one is
		// wherever the vault has since put it, and writing this one makes a cycle.
		vault.files.delete('F1.md');
		vault.caches.delete('F1.md');
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 2000 }, parentLink: 'F2' });
		refresh(view, vault);
		captured?.click();
		await flush();

		expect(vault.fm('F2.md')['parent']).toBe('[[Epic A]]');
		expect(vault.writeLog).toEqual([]);
	});

	it('refuses when the named note has changed LADDER since the menu was built', async () => {
		// `keepsProjection` was asked by the drag and by `outdentTarget` and not here,
		// sound by construction only while the destination was always the previous VISIBLE
		// sibling — a row on this screen, carrying this screen's ladder. Re-resolving a
		// named parent by path broke that: `byPath` holds every loaded item, including one
		// retyped onto the other ladder while the menu sat open, and a `Task` reparented
		// under a `Test case` leaves the plan for the catalog — off the screen it was
		// moved on. Only the menu is exposed; Alt+Right computes its neighbour at the
		// moment of the press.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('PBI P.md', { frontmatter: { type: 'PBI', order: 2000 }, parentLink: 'Epic A' });
		vault.addFile('A1.md', { frontmatter: { type: 'Task', order: 3000 }, parentLink: 'PBI P' });
		vault.addFile('T.md', { frontmatter: { type: 'Task', order: 4000 }, parentLink: 'PBI P' });
		const { view, containerEl } = makeView(vault);

		expect(menuTitles(containerEl, 'T')).toContain('Indent under "A1"');
		const captured = Menu.lastShown?.item('Indent under "A1"');
		vault.fm('A1.md')['type'] = 'Test case';
		refresh(view, vault);
		expect(view.model?.byPath.get('A1.md')?.ladder).not.toEqual(view.model?.byPath.get('T.md')?.ladder);
		captured?.click();
		await flush();

		expect(vault.fm('T.md')['parent']).toBe('[[PBI P]]');
		expect(vault.writeLog).toEqual([]);
	});

	it('refuses when the named note is no longer a destination at all', async () => {
		const vault = indentFixture();
		vault.addFile('F0.md', { frontmatter: { type: 'Feature', order: 1500 }, parentLink: 'Epic A' });
		const { view, containerEl } = makeView(vault);

		expect(menuTitles(containerEl, 'F2')).toContain('Indent under "F1"');
		const captured = Menu.lastShown?.item('Indent under "F1"');
		// The named row leaves the vault. F0 is what a recomputed neighbour would find,
		// and the write must not go there — a command that cannot do what its title says
		// does nothing, the refusal this path had before the subject was re-resolved.
		vault.files.delete('F1.md');
		vault.caches.delete('F1.md');
		refresh(view, vault);
		captured?.click();
		await flush();

		expect(vault.fm('F2.md')['parent']).toBe('[[Epic A]]');
		expect(vault.writeLog).toEqual([]);
	});
});

/**
 * A refused placement is the one drop outcome nothing used to report. The indicator
 * accepts the drop — `dropTargets.ts` decides where a row may LAND, and the rank is an
 * arithmetic question asked afterwards — so silence reads as a broken gesture rather than
 * as a full range, and the remedy each refusal names is the whole value of saying it.
 */
describe('a drop that cannot be ranked says why', () => {
	/** Two ranks a rounding step apart, so no six-decimal number fits between them. */
	function squeezedFixture() {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 2 } });
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 2.000001 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 3000 } });
		vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 4000 }, parentLink: 'Epic B' });
		return vault;
	}

	it('names Respace when the gap between the two neighbours is spent', async () => {
		const vault = squeezedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'before');
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'No room left between those two items. Run "Respace ranks" from the command palette.',
		]);
	});

	// **The case no other refusal reaches: the placement SUCCEEDS and nothing moves.**
	// `PBI C` is unranked, so `inRankOrder` draws the focus list in tree order; `A1` and
	// `B1` are both ranked and there is a ranked row between them in the population, so
	// the arithmetic finds a perfectly good midpoint. Written, it would be correct and
	// invisible — the screen is identical and the undo slot is gone.
	//
	// The fixture has to have BOTH: an unranked focus row to hold the fallback open, and
	// two ranked neighbours with room between them so no earlier refusal fires first. Drop
	// either half and this passes for the wrong reason — with the row ranked the fallback
	// lifts and the drag legitimately moves something; with no room the `gapSpent` refusal
	// answers instead and the new one is never asked.
	it('refuses a rank that could not show, rather than writing one nobody can see', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 2000 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 3000 } });
		vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 4000 }, parentLink: 'Epic B' });
		// The row that holds the fallback open, and never moves in this test.
		vault.addFile('PBI C.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic B' });
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'before');
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'This list is drawn in tree order, because some of its rows have no rank or share one — so ordering it by hand would not show. Use the toolbar’s set-up button to fill in missing ranks, or run "Seed ranks from the hierarchy" from the command palette.',
		]);
	});

	it('names the set-up button when a neighbour has no rank at all', async () => {
		const vault = squeezedFixture();
		// A blank rank is a different fact from a full range, and it takes the other
		// remedy: the backfill can fill this one in, and Respace cannot invent a position.
		vault.addFile('PBI A2.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic A' });
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		// Landing after the blank makes the blank the anchor, and an anchor with no number
		// is the one thing no arithmetic can place against.
		drag(rowByTitle(containerEl, 'PBI A1'), rowByTitle(containerEl, 'PBI A2'), 'after');
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'That item has no rank yet. Use the toolbar’s set-up button to fill in the missing ones.',
		]);
	});

	it('reports the CONFIGURATION instead, because every remedy above is blocked by it', async () => {
		// Both roles on one key: no note has a readable rank, so the placement refuses
		// `unranked` — and the button that sentence names refuses at the same gate. The
		// advice would be a dead end, so the gate's own refusal is what is said.
		const vault = squeezedFixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' }, { focus: 'PBI' });

		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'before');
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'Fix the view options first: the parent and order properties share the key "parent".',
		]);
	});
});

/**
 * **Distinctness of the peers says the fallback WILL lift; it does not say the list comes
 * back in the order on screen.** The sharper half of the same rule, found in review after
 * the first half shipped.
 *
 * Drawn `A(30), B(10), C(10)`: the list is in tree-order fallback because B and C tie, and
 * a dragged C has peers A and B holding distinct ranks — so the first version of the guard
 * allowed the drop. It wrote C a rank of 20 and the list came back `B, C, A`. Two things
 * wrong at once, both worse than the invisible write the guard was built for: C is not at
 * the top where it was dropped, and B, which nobody touched, has moved above A.
 *
 * The fixture needs the peers' ranks to DISAGREE with their drawn order — A drawn first and
 * ranked last — because peers whose ranks already ascend are the case that must keep
 * working. The control below is that case, and without it a guard that simply refused every
 * focus drop would pass the test above.
 */
describe('a focus drop whose peers are ranked against their drawn order', () => {
	function threeRoots(a: number, b: number, c: number) {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2 } });
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 3 } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: a }, parentLink: 'Epic A' });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: b }, parentLink: 'Epic B' });
		vault.addFile('C.md', { frontmatter: { type: 'PBI', order: c }, parentLink: 'Epic C' });
		return { vault, ...makeView(vault, {}, { focus: 'PBI' }) };
	}

	it('refuses, rather than landing the row elsewhere and moving an untouched one', async () => {
		const { containerEl, vault } = threeRoots(30, 10, 10);
		// Drawn in TREE order, because B and C tie — which is the state this turns on.
		expect(titlesOf(containerEl)).toEqual(['A', 'B', 'C']);

		drag(rowByTitle(containerEl, 'C'), rowByTitle(containerEl, 'A'), 'before');
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'This list is drawn in tree order, because some of its rows have no rank or share one — so ordering it by hand would not show. Use the toolbar’s set-up button to fill in missing ranks, or run "Seed ranks from the hierarchy" from the command palette.',
		]);
	});

	it('still allows the drop where the peers already stand in their rank order', async () => {
		// The control, and it is load-bearing: peers A(10) and B(20) ascend as drawn, so
		// lifting the fallback leaves them put and C lands where it was dropped. A guard that
		// refused this would have taken the feature away rather than repaired it, and no
		// assertion on the case above could tell those two apart.
		const { containerEl, vault } = threeRoots(10, 20, 20);

		drag(rowByTitle(containerEl, 'C'), rowByTitle(containerEl, 'A'), 'before');
		await flush();

		expect(vault.writeLog.map((w) => w.path)).toEqual(['C.md']);
	});
});

/**
 * The same rule, and the third round on it: a RANKED context row is part of the sort.
 *
 * `distinctlyRanked` skips an `outsideFilter` row on purpose — it asks whether the list can
 * ever be ordered, and a row no pass can migrate would veto that forever. `drawnInRankOrder`
 * asks a different question, what the sort will DO, and the sort moves a context row like
 * any other. Copying the skip therefore looked consistent and was wrong.
 *
 * Drawn writable `A(20)`, context `C(10)` (with its own task keeping it loaded), writable
 * `D(20)`: the writable peers of a dragged D are just `A`, trivially in order, so the drop
 * was allowed. It wrote D a 15 and the list came back `C, T, D, A` — D below where it was
 * dropped, and the context row lifted to the top.
 */
describe('a focus drop past a ranked context row', () => {
	function withContextRoot(dOrder: number) {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1 } });
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 2 } });
		vault.addFile('Epic D.md', { frontmatter: { type: 'Epic', order: 3 } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic A' });
		vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic C' });
		vault.addFile('D.md', { frontmatter: { type: 'PBI', order: dOrder }, parentLink: 'Epic D' });
		// The task is what keeps C loaded as a context ancestor while the base excludes it.
		vault.addFile('T.md', { frontmatter: { type: 'Task', order: 50 }, parentLink: 'C' });
		return { vault, ...makeView(vault, {}, { focus: 'PBI', except: ['C.md'] }) };
	}

	it('refuses where the context row would be sorted above the row just dropped', async () => {
		const { containerEl, vault } = withContextRoot(20);
		// Tree order, because the two writable rows tie — and C is drawn between them, with
		// the task that keeps it loaded underneath it.
		expect(titlesOf(containerEl)).toEqual(['A', 'C', 'T', 'D']);

		drag(rowByTitle(containerEl, 'D'), rowByTitle(containerEl, 'A'), 'before');
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('allows the drop where a context row TIES with a writable one and the list is ordered', async () => {
		// Round four on this guard, and the one where the fix over-refused. Writable A(10) and
		// D(20) are distinct, so the list is drawn in rank order and the drag is an ordinary
		// visible move — but the context row C(10) ties with A, the peers fail the strict
		// ascending test, and the drop was refused with a notice. A feature loss, and exactly
		// what the control beside it was meant to catch: it did not, because it only covered a
		// context row that DIFFERS from its writable neighbour rather than one that ties.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1 } });
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 2 } });
		vault.addFile('Epic D.md', { frontmatter: { type: 'Epic', order: 3 } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic A' });
		vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic C' });
		vault.addFile('D.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Epic D' });
		vault.addFile('T.md', { frontmatter: { type: 'Task', order: 50 }, parentLink: 'C' });
		const { containerEl } = makeView(vault, {}, { focus: 'PBI', except: ['C.md'] });

		drag(rowByTitle(containerEl, 'D'), rowByTitle(containerEl, 'A'), 'before');
		await flush();

		expect(vault.writeLog.map((w) => w.path)).toEqual(['D.md']);
	});

	it('still allows the drop when the list is not in fallback at all', async () => {
		// The control, and it corrects the reading that nearly went in: with D ranked 30 the
		// two WRITABLE rows are already distinct, so `inRankOrder` never falls back — the list
		// is drawn in rank order, the drag moves something visible, and refusing it would be
		// the feature's removal. The guard only ever speaks where the fallback is holding.
		const { containerEl, vault } = withContextRoot(30);

		drag(rowByTitle(containerEl, 'D'), rowByTitle(containerEl, 'A'), 'before');
		await flush();

		expect(vault.writeLog.map((w) => w.path)).toEqual(['D.md']);
	});
});
