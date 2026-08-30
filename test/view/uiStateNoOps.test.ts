// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * Setting a piece of UI state to the value it already holds must cost nothing.
 *
 * Every setter on `ViewStateController` opens with the same guard, and the guard is the
 * whole reason a toolbar control may be wired straight to a setter: a picker that reports
 * the current entry, a grip that settles on the width it started from, a menu re-picking
 * the projection already on screen. Without it each of those repaints the view, and the
 * two that ask for `refreshFromData` re-root the model and re-query the Base — visible as
 * lost scroll position and lost focus, on a gesture that changed nothing.
 *
 * Asked of every setter at once rather than one test per control, because the guard is a
 * CATEGORY invariant: the setter added next is exactly the one nobody writes a test for.
 * The list below is every value-taking setter `ViewStateSurface` exposes; the three that
 * take a key as well (`setLaneCollapsed`, `setColumnCollapsed`, `setShelfHiddenTypes`)
 * are deliberately absent — those decide idempotence in `ViewState` or not at all, and
 * asserting a guard they do not have would be asserting the wrong rule.
 */
describe('a UI-state value set to what it already is', () => {
	it('neither renders nor refreshes, for every setter that holds one', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { view } = makeView(vault, { horizonProperty: 'note.horizon' });
		// The two picks that start unset need a first, real call to have something to be
		// redundant against: the axis pick is null until the user makes one, and the board
		// scope's guard asks three terms — the scope, the Deliverables pick and the
		// projection. Everything else below is already sitting at its default.
		view.setBoardScope(null);
		view.setAxisPick('horizons');

		const depths = view as unknown as { render(): void; renderTreeContent(): void; refreshFromData(): void };
		const spies = [
			vi.spyOn(depths, 'render'),
			vi.spyOn(depths, 'renderTreeContent'),
			vi.spyOn(depths, 'refreshFromData'),
		];

		view.setProjection(view.projection);
		view.setBoardScope(view.boardScope);
		view.setAxisPick(view.axisPick as 'horizons');
		view.setFocusLevel('');
		view.setClickFolds(view.clickFolds);
		view.setShowCompleted(view.showCompleted);
		view.setBucketGrid(view.bucketGrid);
		view.setShelfCollapsed(view.shelfCollapsed);
		view.setShelfSort(view.shelfSort);
		view.setShelfLayout(view.shelfLayout);
		view.setShelfHeight(view.shelfHeight);
		view.setShelfSearch(view.shelfSearch);
		view.setZoom(view.zoom);
		view.setDensity(view.density);
		view.setLeadWidth(view.leadWidth);
		view.setColWidth('note.horizon', view.colWidths['note.horizon'] ?? null);

		expect(spies.map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0]);
	});

	/**
	 * The other half of the same rule, and the reason the assertion above is not vacuous:
	 * a setter handed a DIFFERENT value does reach the view. One representative per render
	 * depth — the zoom renders, the shelf sort redraws the content, the focus re-roots the
	 * model — so a controller that had simply stopped calling its hooks fails here.
	 */
	it('still reaches the view when the value actually changes', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { view } = makeView(vault);

		const depths = view as unknown as { render(): void; renderTreeContent(): void; refreshFromData(): void };
		const render = vi.spyOn(depths, 'render');
		const content = vi.spyOn(depths, 'renderTreeContent');
		const refresh = vi.spyOn(depths, 'refreshFromData');

		view.setZoom(view.zoom === 'weeks' ? 'months' : 'weeks');
		view.setShelfSort(view.shelfSort === 'rank' ? 'title' : 'rank');
		view.setFocusLevel('Epic');

		// Called, not counted: `refreshFromData` renders and `render` renders the content,
		// so the three depths nest rather than partition. What is being proved here is only
		// that each hook is reachable at all.
		expect(render).toHaveBeenCalled();
		expect(content).toHaveBeenCalled();
		expect(refresh).toHaveBeenCalled();
	});
});
