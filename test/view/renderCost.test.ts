// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { key, makeView, rowByTitle, rows, treeOf, useViewHarness } from '../helpers/view';

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

		// `chipProps` resolves the columns onto `host.chips` once per data update and
		// `RowContext` carries that snapshot, so twenty times the rows costs the same.
		expect(large.order).toBe(small.order);
		expect(large.displayName).toBe(small.displayName);
		// `getOrder` has one call site — `chipProps`, run once per data update — so a
		// pass makes exactly one call; the bound leaves room for a second and none for
		// a per-row one.
		expect(large.order).toBeLessThanOrEqual(2);
		// Bounded by the columns themselves: one label per chip, plus the fixed
		// state/horizon/progress headers.
		expect(large.displayName).toBeLessThanOrEqual(COLUMNS.length + 3);
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
});
