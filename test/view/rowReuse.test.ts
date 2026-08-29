// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { itemAt, makeView, refresh, rowByTitle, rows, titlesOf, useViewHarness } from '../helpers/view';

useViewHarness();

/** One epic over three features, all indexed and all drawing plain frontmatter. */
function backlog(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	for (const [i, name] of ['Alpha', 'Beta', 'Gamma'].entries()) {
		vault.addFile(`${name}.md`, {
			frontmatter: { type: 'Feature', order: (i + 1) * 10, status: 'Open' },
			parentLink: 'Epic',
		});
	}
	return vault;
}

const STATE = { stateProperty: 'note.status' };

describe('row reuse across a data update', () => {
	it('keeps the same element for every path when nothing changed', () => {
		const { view, containerEl } = makeView(backlog(), STATE);
		view.onDataUpdated();
		const before = rows(containerEl);

		view.onDataUpdated();

		const after = rows(containerEl);
		expect(after).toHaveLength(before.length);
		after.forEach((row, i) => expect(row).toBe(before[i]));
	});

	it('rebuilds only the row whose note changed', () => {
		const vault = backlog();
		const { view, containerEl } = makeView(vault, STATE);
		view.onDataUpdated();
		const untouched = rowByTitle(containerEl, 'Gamma');
		const changed = rowByTitle(containerEl, 'Beta');

		vault.setFrontmatter('Beta.md', { type: 'Feature', order: 20, status: 'Doing', parent: '[[Epic]]' });
		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Gamma')).toBe(untouched);
		expect(rowByTitle(containerEl, 'Beta')).not.toBe(changed);
	});

	it('leaves exactly one column header after repeated updates', () => {
		// A GUARD on the reconcile's header rule, and it passes before and after by design:
		// a pass that empties the tree can only ever have one header, so this says nothing
		// until the tree stops being emptied — at which point a header appended per pass
		// stacks one more on every update.
		const { view, containerEl } = makeView(backlog(), STATE, { order: ['note.status'] });
		view.onDataUpdated();
		view.onDataUpdated();
		view.onDataUpdated();

		expect(containerEl.querySelectorAll('.pbl-cols')).toHaveLength(1);
	});

	it("carries a kept row's child group with it when siblings reorder", () => {
		const vault = backlog();
		vault.addFile('Deep.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Alpha' });
		const { view, containerEl } = makeView(vault, STATE);
		view.onDataUpdated();

		// Alpha moves below Gamma. Its subtree has to travel with it.
		vault.setFrontmatter('Alpha.md', { type: 'Feature', order: 40, status: 'Open', parent: '[[Epic]]' });
		view.onDataUpdated();

		expect(titlesOf(containerEl)).toEqual(['Epic', 'Beta', 'Gamma', 'Alpha', 'Deep']);
	});

	it('re-indents a reused child group when its parent is reparented deeper', () => {
		// A same-depth sibling reorder does not exercise this: the group's own `--pbl-depth`
		// was written by `childGroupEl` at CREATION only, so a reparent to a new depth
		// rebuilds the row (depth is in the signature) and would leave the reused group's
		// indent guide at the old level.
		const vault = backlog();
		vault.addFile('Deep.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Alpha' });
		// Beta is a parent from the start, so the expand-all `makeView` runs settles it: a
		// note that becomes a parent for the FIRST time is collapsed by `collapseNewParents`,
		// which would hide the reparented row this test is about.
		vault.addFile('Beta kid.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Beta' });
		const { view, containerEl } = makeView(vault, STATE);
		view.onDataUpdated();
		expect(rowByTitle(containerEl, 'Alpha').getAttribute('aria-level')).toBe('2');

		// Alpha moves from under Epic to under Beta — one level deeper, still expanded.
		// Through `addFile` and NOT `setFrontmatter`: the parent edge lives in the link
		// cache (`resolveParent` reads `frontmatterLinks` first and the raw value only as a
		// fallback), and `setFrontmatter` rewrites the frontmatter alone — so an edit that
		// reads as a reparent moves nothing at all, and this test asserted `'1' === '1'`
		// about a tree that had not changed until it was written this way.
		vault.addFile('Alpha.md', {
			frontmatter: { type: 'Feature', order: 20, status: 'Open' },
			parentLink: 'Beta',
		});
		refresh(view, vault);

		const row = rowByTitle(containerEl, 'Alpha');
		// The CONTROL: the depth actually moved. Without it an inert fixture passes the
		// comparison below by leaving both sides at the level they started on.
		expect(row.getAttribute('aria-level')).toBe('3');
		const group = row.nextElementSibling as HTMLElement;
		expect(group.hasClass('pbl-children')).toBe(true);
		expect(titlesOf(containerEl)).toContain('Deep');
		// Asserted against the ROW's own depth rather than a literal: `buildRow` and
		// `childGroupEl` write the same number, and the bug is precisely that they stop
		// agreeing. A hard-coded 2 would still pass if both drifted together.
		expect(group.style.getPropertyValue('--pbl-depth')).toBe(row.style.getPropertyValue('--pbl-depth'));
	});

	it('rebuilds every row when a setting that changes a row is toggled', () => {
		// A GUARD on the pass-level fingerprint, passing before and after by design. A view
		// option arrives on the same argument-less update path as a data change, so nothing
		// per-row would ever notice it — `renderInputs` is where it lands.
		const { view, containerEl, config } = makeView(backlog(), { ...STATE, showCounts: false });
		view.onDataUpdated();
		const before = rowByTitle(containerEl, 'Alpha');

		config.set('showCounts', true);
		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Alpha')).not.toBe(before);
	});

	it('rebuilds every row when a column is not frontmatter-backed', () => {
		// A GUARD, passing before and after by design — and NARROWER than it reads. What it
		// holds is that `reusableColumns` is CONSULTED: stubbed to `true` this test fails,
		// because the row is then kept (watched, 2026-08-15). What it does NOT hold is that
		// the harm is caught. jsdom's fake entry cannot make `file.mtime` move, so the stale
		// cell the predicate exists to prevent cannot be produced here at all — a kept row
		// here looks identical to a correct one. The failure it really guards needs a vault
		// where a body edit moves `file.mtime` under an unchanged frontmatter, which is the
		// live-vault check Task 7 files.
		const { view, containerEl } = makeView(backlog(), STATE, { order: ['file.mtime'] });
		view.onDataUpdated();
		const before = rowByTitle(containerEl, 'Alpha');

		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Alpha')).not.toBe(before);
	});

	it('leaves only the empty state when the last result goes', () => {
		// Marking the last open item done is an ordinary write, and it reaches the tree as an
		// update whose shared inputs are identical and whose index is full — so reuse is
		// chosen and nothing below the early return prunes. Without the clear, the empty
		// message is appended UNDER the rows it says are gone.
		const vault = backlog();
		const { view, containerEl } = makeView(vault, STATE);
		view.onDataUpdated();
		expect(rows(containerEl).length).toBeGreaterThan(0);

		for (const path of ['Alpha.md', 'Beta.md', 'Gamma.md', 'Epic.md']) vault.files.delete(path);
		refresh(view, vault);

		expect(rows(containerEl)).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-cols')).toHaveLength(0);
	});

	it('never keeps a row whose value cell drew a link', () => {
		// The column gate asks where a value comes FROM; it cannot ask what the value renders
		// INTO. A link's text belongs to another note, so that note can change with this
		// row's frontmatter — and its signature — untouched.
		const vault = backlog();
		vault.entryValues.set('Alpha.md', {
			'note.related': {
				toString: () => 'Gamma',
				renderTo: (el: HTMLElement) => {
					el.createEl('a', { text: 'Gamma' });
				},
			},
		});
		const { view, containerEl } = makeView(vault, STATE, { order: ['note.related'] });
		view.onDataUpdated();
		const before = rowByTitle(containerEl, 'Alpha');
		const other = rowByTitle(containerEl, 'Beta');

		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Alpha')).not.toBe(before);
		// And only that row: a link in one cell must not cost the whole pass its reuse.
		expect(rowByTitle(containerEl, 'Beta')).toBe(other);
	});

	it('falls back to a whole render when the row it was asked to refresh is not on screen', () => {
		// `refreshSubtree` reads `rowEls`, which holds what the last pass DREW — so an item
		// inside a shut subtree has no row there. Its three callers (the disclosure, the
		// keyboard's fold and a drop) all reach it with an item they believe is drawn, and
		// a redraw arriving between the belief and the call is exactly the window this
		// guard covers. Rendering the whole tree is the fallback because the alternative is
		// doing nothing: a fold that silently no-ops leaves the twisty saying one thing and
		// the rows another, which is worse than a pass nobody needed.
		const { view, containerEl } = makeView(backlog(), STATE, { collapsed: true });
		// Shut, so its features were never drawn and are not in the index.
		expect(titlesOf(containerEl)).toEqual(['Epic']);
		const child = itemAt(view, 'Alpha.md');
		const rendered = vi.spyOn(view, 'render');

		view.refreshSubtree(child);

		// The pass ran and drew the tree the model describes, rather than throwing.
		expect(titlesOf(containerEl)).toEqual(['Epic']);
		// And it was a WHOLE render, which is the half the screen cannot show: a shut tree
		// renders to the same one row either way, so every visible assertion above passes
		// just as well if the guard becomes `if (!row) return;`. The spy is on the call
		// because the call is the claim — the register's own "check the forbidden thing,
		// not the places" rule, read for a thing that must HAPPEN. Row identity cannot
		// stand in for it: this file's first test is that a render reuses the element for
		// every unchanged path, so a full render and a no-op leave the same element in
		// place by design. (Found by review, Codex on PR #217, against a version of this
		// test whose own comment claimed the distinction it did not draw.)
		expect(rendered).toHaveBeenCalledTimes(1);
	});

	it('never keeps a row whose file the metadata cache has not indexed', () => {
		// The other half of the same rule, for the other reason: the cells are drawn from the
		// Bases ENTRY while the signature is read from the metadata CACHE, so while the cache
		// is silent for a note a `note.*` value can move with the signature identical. Two
		// updates after the cache goes, because the first is what makes the row's own terms
		// change; the second is the one that would claim it.
		const vault = backlog();
		const { view, containerEl } = makeView(vault, STATE);
		// The FRONTMATTER goes and the link cache stays, which is what keeps the row on
		// screen to be reused: dropping the whole cache entry unparents the note, and a
		// vault set to hierarchy-only drops it from the model altogether — a row nothing
		// draws proves nothing about whether a drawn one may be kept.
		const cache = vault.caches.get('Gamma.md');
		if (cache) delete cache.frontmatter;
		view.onDataUpdated();
		const unindexed = rowByTitle(containerEl, 'Gamma');
		const indexed = rowByTitle(containerEl, 'Beta');

		view.onDataUpdated();

		expect(rowByTitle(containerEl, 'Gamma')).not.toBe(unindexed);
		expect(rowByTitle(containerEl, 'Beta')).toBe(indexed);
	});
});
