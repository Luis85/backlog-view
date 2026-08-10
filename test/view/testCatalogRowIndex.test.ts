// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { clickExpandAll, makeView, rowByTitle, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * Split out of `testCatalog.test.ts` (the `test/**` line budget) rather than staying a
 * case in its "tree-shaped" describe block: this is the row-index side of the same
 * promoted-root fact that block already covers for the filter, so it earns its own file
 * rather than a home in `testCatalogState.test.ts`, which is the unrelated write-path
 * subject (the test workflow's own key).
 */
describe('a promoted root survives an unrelated collapse', () => {
	it('keeps a promoted root in the row index when its raw ancestor is collapsed', () => {
		// `Epic → Feature` and `Epic → Test case → PBI`. The PBI is drawn as a promoted plan
		// root; collapsing the Epic detaches only the Feature's group, so the PBI's row stays
		// on screen and must stay reachable by lookup. Asserted through a real click, which is
		// what reads `rowEls` to mark the row selected — a DOM check would pass while the
		// index was empty.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Bridge case.md', { frontmatter: { type: 'Test case', order: 20 }, parentLink: 'Epic' });
		vault.addFile('Deep PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Bridge case' });
		const { containerEl } = makeView(vault);
		clickExpandAll(containerEl);
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature', 'Deep PBI']);

		// Collapse the Epic through its own chevron — the real path `refreshRowChildren` runs on.
		rowByTitle(containerEl, 'Epic')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Deep PBI']);

		// The promoted root is still drawn, so it must still be selectable.
		rowByTitle(containerEl, 'Deep PBI').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(rowByTitle(containerEl, 'Deep PBI').classList.contains('pbl-selected')).toBe(true);
	});
});
