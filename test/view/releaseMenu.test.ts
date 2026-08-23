// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import * as cardDrag from '../../src/view/interactions/cardDrag';
import { Menu, MenuItem } from '../helpers/obsidian-mock';
import { flush, itemAt, key, makeViewWithReleases, treeOf, useViewHarness } from '../helpers/view';

/**
 * `Set release` — what the row menu offers, and the keyboard behind it.
 *
 * Every case here opens `buildItemMenu` through `showContextMenuFor`, which is the
 * KEYBOARD's own path (`handleNavigationKey`'s ContextMenu / Shift+F10 arm) and the same
 * builder `showItemMenu` hands a pointer's `contextmenu`. That is why the last case can
 * ask whether the two inputs write the same batch by driving a real keystroke: there is
 * one builder, so a second list is unbuildable rather than merely absent.
 */

useViewHarness();

describe('the Set release menu', () => {
	/** The submenu's entries — empty where the row is offered no `Set release` at all. */
	function releaseEntries(view: ProductBacklogView, path: string): MenuItem[] {
		Menu.lastShown = null;
		view.showContextMenuFor(itemAt(view, path));
		return Menu.lastShown?.item('Set release')?.submenu?.items ?? [];
	}

	const releaseMenuLabels = (view: ProductBacklogView, path: string): string[] =>
		releaseEntries(view, path).map((entry) => entry.titleText);

	const checkedReleaseLabel = (view: ProductBacklogView, path: string): string | null =>
		releaseEntries(view, path).find((entry) => entry.checked)?.titleText ?? null;

	/** Select the row, press the menu key, and run the entry with that label. */
	function pickReleaseByKeyboard(
		view: ProductBacklogView,
		containerEl: HTMLElement,
		path: string,
		label: string,
	): void {
		view.selectItem(itemAt(view, path));
		key(treeOf(containerEl), 'ContextMenu');
		const entry = Menu.lastShown?.item('Set release')?.submenu?.items.find((si) => si.titleText === label);
		if (!entry) throw new Error(`no release entry titled ${label}`);
		entry.click();
	}

	it('offers every release the base holds, and a way out', () => {
		const { view } = makeViewWithReleases();
		expect(releaseMenuLabels(view, 'F.md')).toEqual(['2.4', '2.5', 'No release']);
	});

	it('checks the entry exactly when picking it would write nothing', () => {
		// Asked of the PLAN. A comparison written beside the plan drifts from it — the
		// register records those two coming apart the moment a second property joined.
		const { view } = makeViewWithReleases({ memberOf: { 'F.md': '2.4.md' } });
		expect(checkedReleaseLabel(view, 'F.md')).toBe('2.4');
	});

	it('checks "No release" for an item in none', () => {
		const { view } = makeViewWithReleases();
		expect(checkedReleaseLabel(view, 'F.md')).toBe('No release');
	});

	it('is absent entirely when the property is unbound', () => {
		const { view } = makeViewWithReleases({ releaseProperty: '' });
		// ABSENT, not present and inert: every pick would write nothing while one of
		// them showed as current, which is the gate that follows from no other.
		expect(view.model?.releases.map((release) => release.file.path)).toEqual(['2.4.md', '2.5.md']);
		expect(releaseMenuLabels(view, 'F.md')).toEqual([]);
		// The entry itself, asked directly: `releaseMenuLabels` answers `[]` for an absent
		// entry AND for a present one holding an empty submenu, so absence is only true by
		// construction until this line checks it.
		expect(Menu.lastShown?.item('Set release')).toBeUndefined();
	});

	it('is offered on no marker and no test-catalog note', () => {
		const { view } = makeViewWithReleases();
		// A release holds WORK — the reader's own refusals (`membershipTarget`), asked at
		// the writing end so a pick cannot make a membership the release view will call
		// unresolved.
		for (const path of ['2.4.md', 'Sprint 1.md', 'M1.md', 'Case.md', 'Suite.md']) {
			expect(releaseMenuLabels(view, path)).toEqual([]);
		}
	});

	it('offers no release the base excluded', () => {
		const { view } = makeViewWithReleases({ exclude: '2.5.md' });
		// Not vacuous: the excluded release is in the model, as a context row.
		expect(view.model?.byPath.get('2.5.md')?.outsideFilter).toBe(true);
		expect(releaseMenuLabels(view, 'F.md')).toEqual(['2.4', 'No release']);
	});

	it('distinguishes two releases that share a basename', () => {
		// The write resolves correctly either way, because it carries the TFile — this is
		// about the reader being able to tell which one they are picking. Qualified the
		// way `iterationTargets` qualifies a colliding sprint: the PATH minus the
		// extension, through the shared `namedTargets`. One answer on one surface — and
		// the path form is the correct one at the nested edge, where `X/Rel/2.4` and
		// `Y/Rel/2.4` would both read `2.4 (Rel)` under a folder suffix.
		const { view } = makeViewWithReleases({ releases: ['Releases/2.4.md', 'Archive/2.4.md'] });
		expect(releaseMenuLabels(view, 'F.md')).toEqual(['Releases/2.4', 'Archive/2.4', 'No release']);
	});

	it('is absent on a stubbed key with nowhere to go, and clearable on a real one', () => {
		// The gate asks the parsed ENTRY, `canSetIteration`'s own split: ✨ Assign missing
		// properties stubs `release: ''` onto every eligible note, so with no release in
		// the vault yet key PRESENCE is true on every row while there is neither an
		// assignment to clear nor anywhere to go.
		const stubbed = makeViewWithReleases({ releases: [], memberOf: { 'F.md': '' } });
		expect(itemAt(stubbed.view, 'F.md').ownKeys.release).toBe(true);
		expect(itemAt(stubbed.view, 'F.md').releaseEntry).toBeNull();
		expect(releaseMenuLabels(stubbed.view, 'F.md')).toEqual([]);

		// No targets is not the same as nothing to do: a note holding a link to a release
		// the base no longer returns is exactly where the clear has to stay reachable.
		const held = makeViewWithReleases({ releases: [], memberOf: { 'F.md': '2.4.md' } });
		expect(releaseMenuLabels(held.view, 'F.md')).toEqual(['No release']);
	});

	it('the keyboard writes the batch the menu writes, through the one method', async () => {
		const { view, vault, containerEl } = makeViewWithReleases();
		// Not only the same batch: the same METHOD. A pick that planned its write beside
		// `performReleaseMove` would log the same frontmatter and announce nothing.
		const spy = vi.spyOn(cardDrag, 'announceReleaseMove');
		pickReleaseByKeyboard(view, containerEl, 'F.md', '2.4');
		await flush();
		expect(spy).toHaveBeenCalledTimes(1);
		const byKeyboard = [...vault.writeLog];
		vault.writeLog.length = 0;

		await view.performReleaseMove(itemAt(view, 'F.md'), itemAt(view, '2.4.md'));
		await flush();
		expect(byKeyboard).toEqual(vault.writeLog);
		expect(byKeyboard).toHaveLength(1);
	});
});
