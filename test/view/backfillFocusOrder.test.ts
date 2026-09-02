// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault, setResults } from '../helpers/vault';
import { Notice } from '../helpers/obsidian-mock';
import { flush, makeView, noOptionalProperties, refresh, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * What the ✨ promises about ORDER, asked of the projection this whole rank change exists
 * for rather than of a sibling group.
 *
 * **The scope, stated once so the three tests below can be read against it: filling a blank
 * never moves that blank, in the tree or at any focus level.** Those are the two places
 * this plugin orders rows by `order` — `compareSiblings` and `inRankOrder` — and a board
 * column or roadmap bucket needs no cover because it sorts by the Base's own `entryIndex`.
 * The promise is about the BLANK. It is not "the projection looks the same afterwards",
 * which no pass that only fills blanks can deliver; the third test pins why.
 *
 * Two mistakes are buried here, both of which read as settled at the time:
 *
 * "A backfilled rank never inverts a SIBLING pair" is true of a monotonic counter and says
 * nothing about a focus level, which is not a sibling group — before the backfill a focused
 * list renders in TREE order, because one missing rank defeats `inRankOrder`'s distinctness
 * test, and in RANK order once none is. The switch is what reorders.
 *
 * Then, having bounded the blank by the next rank ABOVE the highest one drawn over it: that
 * is the same thing only while a subtree's ranks run upward with the screen. It takes a
 * later-drawn row under a DIFFERENT parent, holding a LOWER rank, to tell them apart, and
 * every fixture written for the first bug stayed inside one increasing run.
 */
describe('the backfill and the focused order', () => {
	const initButton = (containerEl: HTMLElement) =>
		containerEl.querySelector<HTMLElement>('[aria-label="Assign missing properties"]');

	it('draws a focused list in the same order after the press as before', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		// Drawn FIRST and ranked last — the whole case. Seeded above the population maximum
		// it became 4000 and sorted behind B1; placed where it is drawn it stays in front.
		vault.addFile('A1.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 3000 }, parentLink: 'Epic B' });
		const { view, containerEl } = makeView(vault, noOptionalProperties(), { focus: 'Feature' });
		const before = titlesOf(containerEl);
		expect(before).toEqual(['A1', 'B1']);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		refresh(view, vault);

		expect(titlesOf(containerEl)).toEqual(before);
	});

	it('leaves a blank alone when no rank can keep it where it is drawn', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		// **Drawn AFTER A1 and ranked BELOW Epic A** — the shape every earlier fixture
		// missed, because it needs a later-drawn row under a DIFFERENT parent holding a
		// lower rank. There is no number both above everything drawn over A1 (1000) and
		// below everything drawn under it (500), so the only placement that keeps A1 where
		// it is drawn is no placement at all.
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 500 }, parentLink: 'Epic B' });
		const { view, containerEl } = makeView(vault, noOptionalProperties(), { focus: 'Feature' });
		const before = titlesOf(containerEl);
		expect(before).toEqual(['A1', 'B1']);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		refresh(view, vault);

		expect(vault.fm('A1.md')['order']).toBeUndefined();
		expect(titlesOf(containerEl)).toEqual(before);
	});

	it('leaves the blanks drawn AFTER a refused one alone too, rather than ranking them past it', async () => {
		// The refusal above, one row further on. A blank that stays blank sorts LAST among
		// its siblings, so a later blank that receives a number does not merely rank itself
		// — it ranks itself ahead of the row the walk just refused, and that row moves. The
		// guarantee is about the blank, and this is the blank being moved by somebody
		// else's placement.
		//
		// `A1` is an Epic under an Epic, which is what puts it in the roots' own focus key
		// while it is drawn INSIDE `A`: that is what makes `A`'s ceiling (50) fall below its
		// floor (100), with no number in between.
		const vault = new FakeVault();
		vault.addFile('X.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('A1.md', { frontmatter: { type: 'Epic', order: 50 }, parentLink: 'A' });
		vault.addFile('B.md', { frontmatter: { type: 'Epic' } });
		const { view, containerEl } = makeView(vault, noOptionalProperties());
		const before = titlesOf(containerEl);
		expect(before).toEqual(['X', 'A', 'A1', 'B']);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		refresh(view, vault);

		// `B` is refused WITH `A` rather than placed above it: the two are unranked
		// together, which is the only state that keeps them in the order they are drawn.
		expect(vault.fm('A.md')['order']).toBeUndefined();
		expect(vault.fm('B.md')['order']).toBeUndefined();
		expect(titlesOf(containerEl)).toEqual(before);
	});

	it('poisons the whole sibling group too, not only the refused focus key', async () => {
		// The same shape as the test above, but the row that moves shares no FOCUS KEY with
		// the one that was refused — only a PARENT. `Feature1` (key = Feature's levelIndex)
		// and `Bug1` (key = EXTRA_TYPE_RANK, an extra type) are both children of `A` and both
		// blank, so they are drawn adjacent under `compareSiblings`' tie-break. `Feature1` is
		// refused for the same reason `A` was above — its own nested `Feature2` ranks BELOW
		// the floor `A`'s own backfilled rank has already raised — and a refusal that only
		// poisons the FOCUS KEY leaves `Bug1` free to take a number, which sorts it ahead of
		// the blank `Feature1` and moves it. Poisoning the SIBLING GROUP as well is what
		// keeps them together.
		const vault = new FakeVault();
		vault.addFile('X.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Feature1.md', { frontmatter: { type: 'Feature' }, parentLink: 'A' });
		vault.addFile('Feature2.md', { frontmatter: { type: 'Feature', order: 50 }, parentLink: 'Feature1' });
		vault.addFile('Bug1.md', { frontmatter: { type: 'Bug' }, parentLink: 'A' });
		const { view, containerEl } = makeView(vault, noOptionalProperties());
		const before = titlesOf(containerEl);
		expect(before).toEqual(['X', 'A', 'Feature1', 'Feature2', 'Bug1']);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// `A` is the one real write (its own blank rank fits above `X` and below nothing) —
		// both blank rows are counted, not only the one whose key was refused directly.
		expect(Notice.messages).toEqual([
			'Product Backlog: updated 1 item.',
			'2 items were left without a rank, because no number fits where they are drawn. Run "Seed ranks from the hierarchy" from the command palette to renumber the whole backlog.',
		]);

		refresh(view, vault);

		// Left BLANK, both of them — never ranked past each other — which is the only state
		// that keeps the drawn order intact.
		expect(vault.fm('Feature1.md')['order']).toBeUndefined();
		expect(vault.fm('Bug1.md')['order']).toBeUndefined();
		expect(titlesOf(containerEl)).toEqual(before);
	});

	it('poisons the ROOT sibling group too, when the shared parent is null', async () => {
		// The same rule as the test above, but for the group `isPoisoned`'s own comment
		// names and nothing else here tests: `null`, the top-level group. `A` (an `Epic`,
		// key 0) and `Bug1` (a `Bug`, an extra type — key `EXTRA_TYPE_RANK`) are both ROOTS,
		// so both share the null parent, and neither shares the other's focus key. `A` is
		// refused for the familiar reason — its nested `A1` ranks below the floor `X`
		// raised — and a refusal that only poisons the focus key leaves `Bug1` free to take
		// a number, sorting it ahead of the still-blank `A`.
		const vault = new FakeVault();
		vault.addFile('X.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('A1.md', { frontmatter: { type: 'Epic', order: 50 }, parentLink: 'A' });
		vault.addFile('Bug1.md', { frontmatter: { type: 'Bug' } });
		const { view, containerEl } = makeView(vault, noOptionalProperties());
		const before = titlesOf(containerEl);
		expect(before).toEqual(['X', 'A', 'A1', 'Bug1']);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// Neither blank root is placeable, so no write lands at all — no "updated" notice,
		// only the skip.
		expect(Notice.messages).toEqual([
			'2 items were left without a rank, because no number fits where they are drawn. Run "Seed ranks from the hierarchy" from the command palette to renumber the whole backlog.',
		]);

		refresh(view, vault);

		expect(vault.fm('A.md')['order']).toBeUndefined();
		expect(vault.fm('Bug1.md')['order']).toBeUndefined();
		expect(titlesOf(containerEl)).toEqual(before);
	});

	it('leaves a blank alone when an unranked context row is drawn above it in the focus list', async () => {
		// The row that moves can never be GIVEN a rank at all, which is what makes a context
		// row the PERMANENT case of the refusal the two tests above poison for. `Ctx` is a
		// Feature the base excluded and `loadOutsideParents` kept on screen because `P` hangs
		// from it, so it is a focus root drawn above `F2` and its `order` stays null whatever
		// this action does. Fill `F2`'s blank and the focused Feature list turns from tree
		// order into rank order with `Ctx` still unranked — and a null rank sorts LAST, so
		// `Ctx` lands behind the row that was drawn under it. Skipping the context row
		// silently is what let that happen: it has to poison what it is comparable to, the
		// same way a refused blank does.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('Ctx.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 150 }, parentLink: 'Ctx' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 200 } });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic B' });
		const { view, containerEl } = makeView(vault, noOptionalProperties(), { focus: 'Feature', except: ['Ctx.md'] });
		const before = titlesOf(containerEl);
		expect(before).toEqual(['Ctx', 'P', 'F2']);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		// Refreshed with `Ctx` still cut, the way the base returned it in the first place.
		setResults(view, vault.entries().filter((entry) => entry.file.path !== 'Ctx.md'));

		expect(titlesOf(containerEl)).toEqual(before);
		expect(vault.fm('F2.md')['order']).toBeUndefined();
		expect(Notice.messages).toContain(
			'1 item was left without a rank, because no number fits where it is drawn. Run "Seed ranks from the hierarchy" from the command palette to renumber the whole backlog.',
		);
	});

	it('does not stop a blank that shares neither focus key nor sibling group with the context row', async () => {
		// The control the test above cannot supply, and the difference between a NARROW
		// poison and a blanket one: every context ancestor stopping the backfill below it
		// would leave a filtered vault unable to seed anything. `Ctx` is a Feature under `A`
		// and `B` is a root Epic, so the two share no focus key and no parent — they can
		// never be drawn against each other, and `B`'s blank is filled as usual.
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 100 } });
		vault.addFile('Ctx.md', { frontmatter: { type: 'Feature' }, parentLink: 'A' });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 150 }, parentLink: 'Ctx' });
		vault.addFile('B.md', { frontmatter: { type: 'Epic' } });
		const { containerEl } = makeView(vault, noOptionalProperties(), { except: ['Ctx.md'] });

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(Notice.messages).toEqual(['Product Backlog: updated 1 item.']);
		expect(vault.fm('B.md')['order']).toBeGreaterThan(150);
	});

	it('says the rank was skipped rather than claiming there was nothing to do', async () => {
		// The same vault as above, asked what the user is TOLD. A refused rank used to be
		// reduced to `null` inside the plan, so the action reported the one outcome that
		// was certainly false: every other property was already present, no write was
		// planned, and the ✨ said the backfill had nothing left to do while a blank rank
		// stayed blank. The remedy named is the one that reaches this row — the backfill
		// bounds a blank by what is drawn around it and here nothing fits, while Seed
		// rewrites every rank and is not bounded by anything.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 500 }, parentLink: 'Epic B' });
		const { containerEl } = makeView(vault, noOptionalProperties(), { focus: 'Feature' });

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		expect(Notice.messages).toEqual([
			'1 item was left without a rank, because no number fits where it is drawn. Run "Seed ranks from the hierarchy" from the command palette to renumber the whole backlog.',
		]);
	});

	it('still flips a pair whose EXISTING ranks contradict the drawn order', async () => {
		// **A known reorder, pinned rather than left unstated.** Filling blanks correctly is
		// not the same promise as "the projection looks the same afterwards": A1 and B1 are
		// already ranked, and already ranked against the order they are drawn in. Nothing an
		// action that only fills blanks can do will fix that — the switch from tree order to
		// rank order is what reveals it, and `Seed ranks from the hierarchy` rewriting every
		// rank is the only remedy. A reader finding this test should read it as the boundary
		// of the guarantee, not as a defect somebody missed.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature', order: 3000 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 1500 }, parentLink: 'Epic B' });
		// The one blank, and the only row this action may move. It is drawn last and must
		// STAY last — that half is the guarantee, in the same test as the half that is not.
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 4000 } });
		vault.addFile('C1.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic C' });
		const { view, containerEl } = makeView(vault, noOptionalProperties(), { focus: 'Feature' });
		// Tree order, because C1's missing rank defeats the distinctness test.
		expect(titlesOf(containerEl)).toEqual(['A1', 'B1', 'C1']);

		initButton(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();
		refresh(view, vault);

		expect(titlesOf(containerEl)).toEqual(['B1', 'A1', 'C1']);
	});
});
