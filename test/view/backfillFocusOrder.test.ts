// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
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
