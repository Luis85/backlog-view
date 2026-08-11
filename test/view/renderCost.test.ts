// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { clickExpandAll, key, makeView, rowByTitle, rows, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

const COLUMNS = ['note.points', 'note.owner', 'note.size'];

/** One epic per ten items, the rest features under it — a backlog shaped like a real one. */
function backlog(items: number): FakeVault {
	const vault = new FakeVault();
	for (let i = 0; i < items; i++) {
		if (i % 10 === 0) vault.addFile(`Epic ${i}.md`, { frontmatter: { type: 'Epic', order: i * 10 } });
		else
			vault.addFile(`Feature ${i}.md`, {
				frontmatter: { type: 'Feature', order: i * 10 },
				parentLink: `Epic ${i - (i % 10)}`,
			});
	}
	return vault;
}

/**
 * Count the Bases config lookups made by ONE full render pass over `items` rows. The
 * view is built and rendered once before the spies go on, so the numbers describe a
 * steady-state pass rather than first-load setup.
 */
function lookupsFor(items: number): { order: number; displayName: number; rendered: number } {
	const { view, config, containerEl } = makeView(backlog(items));
	config.order = [...COLUMNS];
	view.onDataUpdated();

	const order = vi.spyOn(config, 'getOrder');
	const displayName = vi.spyOn(config, 'getDisplayName');
	view.onDataUpdated();

	return {
		order: order.mock.calls.length,
		displayName: displayName.mock.calls.length,
		rendered: rows(containerEl).length,
	};
}

describe('render cost', () => {
	it('resolves the column config once per pass, not once per row', () => {
		const small = lookupsFor(20);
		const large = lookupsFor(400);

		// The fixture has to actually differ in size, or equality below proves nothing
		expect(small.rendered).toBe(20);
		expect(large.rendered).toBe(400);

		// `resolveColumns` resolves the columns onto `host.columns` once per data update
		// and `RowContext` carries that snapshot, so twenty times the rows costs the same.
		expect(large.order).toBe(small.order);
		expect(large.displayName).toBe(small.displayName);
		// `getOrder` has one call site — `resolveColumns`, run once per data update — so
		// a pass makes exactly one call; the bound leaves room for a second and none for
		// a per-row one.
		expect(large.order).toBeLessThanOrEqual(2);
		// Bounded by the columns themselves, and by nothing else: every label is resolved
		// in that same pass and carried on the `Column`, so the header reads it rather
		// than asking again — which is what retired the three fixed chip headers this
		// bound used to leave room for.
		expect(large.displayName).toBeLessThanOrEqual(COLUMNS.length);
	});

	/**
	 * A REGRESSION GUARD, not the statement of the invariant. "No interaction scans the
	 * tree" is a claim about every path, including ones not written yet, and a list of
	 * three cannot check it — that is the defect `docs/bugs/The drag cleanup scans the
	 * whole tree.md` records. The ban itself is the `no-restricted-syntax` rule on the
	 * `treeEl` receiver in `eslint.config.mjs`, which holds for code nobody has driven.
	 * These three are here because they are the paths `rowEls` exists for, and the drag
	 * is the one that was actually found scanning.
	 */
	it('never queries the tree element during selection, subtree refresh or drag cleanup', () => {
		const { containerEl } = makeView(backlog(60));
		const tree = treeOf(containerEl);
		const one = vi.spyOn(tree, 'querySelector');
		const all = vi.spyOn(tree, 'querySelectorAll');

		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown');
		expect(tree.getAttribute('aria-activedescendant')).not.toBeNull();

		const chevron = rowByTitle(containerEl, 'Epic 10').querySelector<HTMLElement>('.pbl-chevron');
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(rows(containerEl).length).toBe(51);
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(rows(containerEl).length).toBe(60);

		const dragged = rowByTitle(containerEl, 'Feature 11');
		dragged.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		expect(dragged.classList.contains('pbl-drag-source')).toBe(true);
		dragged.dispatchEvent(new MouseEvent('dragend', { bubbles: true }));
		expect(dragged.classList.contains('pbl-drag-source')).toBe(false);

		expect(one).not.toHaveBeenCalled();
		expect(all).not.toHaveBeenCalled();
	});

	it('prunes a detached subtree from rowEls without taking a promoted root with it', () => {
		// The over-pruning half of the same invariant the test above pins: `refreshRowChildren`
		// must prune ONLY what it detached. `Epic → Feature` and `Epic → Test case → PBI` — the
		// PBI is a plan member drawn as a promoted ROOT elsewhere, not under the Epic, so
		// collapsing the Epic detaches only the Feature's group. Walking the raw child list
		// instead of membership deletes the PBI's `rowEls` entry while its row stays on screen,
		// and selection is what reads that map — a DOM check would pass with the index empty.
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

	/**
	 * The invariant is asked AT THE FORBIDDEN THING — the layout getters themselves —
	 * rather than by asserting that this one handler looks right, so it holds for a hover
	 * handler written tomorrow. Same reasoning as the tree-scan spy above, and the same
	 * reason it is a spy on the call rather than a reading of the source.
	 *
	 * What it cost when it was false: `mouseover` on a row title read
	 * `scrollWidth`/`clientWidth` to decide whether the title needed a tooltip, which
	 * forces a synchronous re-layout of the whole tree — and hovering is itself what
	 * dirties style, so the read could never reuse a clean layout. Measured in the browser
	 * harness at 832 rows: 65.7ms per hover against 0.13ms without it.
	 */
	it('reads no layout while ANY part of a row is hovered', () => {
		const { containerEl } = makeView(backlog(60));
		const row = rowByTitle(containerEl, 'Feature 11');
		// On the prototype, not the element: the handler could reach layout through any
		// node it can see, and a spy on one element would miss a read of its parent.
		const scrollWidth = vi.spyOn(Element.prototype, 'scrollWidth', 'get');
		const clientWidth = vi.spyOn(Element.prototype, 'clientWidth', 'get');
		try {
			// EVERY descendant, not the title alone. Hovering only the title is what let the
			// type badge keep the identical read through the fix that removed the title's —
			// same defect, same file, missed because the check named a place instead of
			// sweeping the category. (Codex, PR #128.)
			for (const el of [row, ...row.querySelectorAll('*')]) {
				el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
			}

			expect(scrollWidth).not.toHaveBeenCalled();
			expect(clientWidth).not.toHaveBeenCalled();
		} finally {
			scrollWidth.mockRestore();
			clientWidth.mockRestore();
		}
	});
});
