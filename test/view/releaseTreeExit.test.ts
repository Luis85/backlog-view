// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, makeViewWithReleases, rows, titlesOf, useViewHarness } from '../helpers/view';
import { Menu } from '../helpers/obsidian-mock';

useViewHarness();

/**
 * `Release` leaves the backlog view — it is neither drawn nor offered there, because the
 * release view is the only door onto one now.
 *
 * Asked of the READERS, the way `releaseRows.test.ts` beside it is: the rows, and the
 * three surfaces `offerableTypes` feeds. The third test is the one that is not about
 * releases at all — it is about the FOREST, and it is what a narrowing of the hiding
 * alone reds.
 */

/** Every row the tree drew, by note path — the identity the fixture names them by. */
function rowPaths(containerEl: HTMLElement): string[] {
	return rows(containerEl).map((row) => row.dataset.path ?? '');
}

/** The titles of one open toolbar or context menu. */
function menuTitles(): string[] {
	return Menu.lastShown?.items.map((one) => one.titleText) ?? [];
}

describe('a release in the tree', () => {
	/**
	 * **The trap, and the reason this test is first.** The tree renders
	 * `projectionForest`'s own output and `renderForest` drops a hidden sibling WITHOUT
	 * descending through it, so a membership narrowed where the forest is not takes every
	 * row below a release off the screen with it — the failure `inPlan`'s own comment
	 * names for the iteration.
	 *
	 * `Ship it` is in the fixture as the control: a fix that emptied the tree entirely
	 * would pass an assertion that only said `1.0` was absent.
	 */
	it('keeps every work item that a release row was above', () => {
		const vault = new FakeVault();
		vault.addFile('Ship it.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10 }, parentLink: 'Ship it' });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: '1.0' });
		const { containerEl } = makeView(vault);

		expect(titlesOf(containerEl)).toEqual(['Ship it', 'Work']);
	});

	/** The same, with the release at the top of the tree rather than inside it. */
	it('carries the work under a release the tree roots at', () => {
		const vault = new FakeVault();
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10 } });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: '1.0' });
		const { containerEl } = makeView(vault);

		expect(titlesOf(containerEl)).toEqual(['Work']);
	});

	/**
	 * The row itself. Same narrowing `roadmapRows` already makes one projection over, now
	 * that the release view is the door a release is made and read through.
	 */
	it('draws no release row, even when the base returns one', () => {
		const { containerEl } = makeViewWithReleases();

		expect(rowPaths(containerEl)).not.toContain('2.4.md');
		expect(rowPaths(containerEl)).not.toContain('2.5.md');
		// The work beside them is untouched, so this is a type the tree refused rather than
		// a tree that drew nothing.
		expect(rowPaths(containerEl)).toContain('F.md');
	});

	/**
	 * **A focus is working position on the device (ADR 0011), so it outlives the projection
	 * and the release it was set on.** The tree's own picker offered `Release` until this
	 * change, so a stored one is not hypothetical the way an `Iteration` focus is: it is in
	 * somebody's view state right now. Left honoured, it re-roots the model at rows the tree
	 * no longer draws — the whole `Ship it` subtree gone, `Focus: Release` on the button, and
	 * no entry in the picker to leave by. That is the roadmap's own defect
	 * (`honouredFocusLevel`), reaching the tree the day the tree stopped drawing releases.
	 *
	 * Asserted as the WHOLE tree rather than as one row: without the guard the model is
	 * focused, `1.0`'s child is promoted, and `Later` is drawn on its own — so an assertion
	 * naming only `Later` passes on the broken code. The button is the second half, because
	 * a model rebuilt unfocused with a label still reading `Release` would be the same trap
	 * wearing the fix.
	 */
	it('honours no stored Release focus, which no picker can now clear', () => {
		const vault = new FakeVault();
		vault.addFile('Ship it.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Ship it' });
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 20 } });
		vault.addFile('Later.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: '1.0' });
		const { containerEl } = makeView(vault, {}, { focus: 'Release' });

		expect(titlesOf(containerEl)).toEqual(['Ship it', 'Work', 'Later']);
		expect(containerEl.querySelector<HTMLElement>('.pbl-focus-btn')?.textContent).not.toContain('Release');
	});

	/**
	 * All three surfaces `offerableTypes` feeds, because each fails differently: `New`
	 * would make a note the tree drops on the pass that made it, `Set type` would vanish
	 * the row it was used on, and the focus picker would offer a `Release`-only scope
	 * drawing an empty tree with nothing saying why.
	 *
	 * `Milestone` is asserted beside each: it is the marker the tree still draws, so a
	 * narrowing that took every marker would fail here rather than pass.
	 */
	it('offers Release as a type nowhere', () => {
		const { view, containerEl } = makeViewWithReleases();

		containerEl.querySelector<HTMLElement>('.pbl-new-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(menuTitles()).toContain('New Milestone');
		expect(menuTitles()).not.toContain('New Release');

		view.showContextMenuFor(view.model?.byPath.get('F.md') as never);
		const retype = Menu.lastShown?.item('Set type')?.submenu?.items.map((one) => one.titleText) ?? [];
		expect(retype).toContain('Milestone');
		expect(retype).not.toContain('Release');

		containerEl.querySelector<HTMLElement>('.pbl-focus-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(menuTitles()).toContain('Milestone');
		expect(menuTitles()).not.toContain('Release');
	});
});
