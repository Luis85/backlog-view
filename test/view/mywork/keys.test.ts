// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeMyWorkView, mwActive, mwPress, mwRow, mwTwisty, myWorkVault, treeEl } from '../../helpers/mywork';

/**
 * The my-work tree's keyboard — Task 7 of [[Assigned work in the sidebar]]: the shared
 * `wireScopeKeys` (`src/view/scopeKeys.ts`, moved out of `src/view/release/scopeKeys.ts`)
 * wired to THIS tree, over `myWorkVault()`'s own Ada tree
 * (`test/helpers/mywork.ts`'s own docblock): `Epic.md` (context) -> `Feature.md`
 * (context) -> `PBI Ada.md`, plus `PBI Hidden.md` re-rooted under `Epic.md`.
 *
 * `test/view/release/scopeKeys.test.ts` is the exhaustive suite over the shared
 * mechanism (every arrow behaviour, Home/End, the stale-fold guard, the focus-carry
 * across a fold's redraw, the active-row survival across a data update and a rename);
 * this file only has to show the SAME mechanism reaches this second tree — it does not
 * re-litigate the mechanism itself.
 */
describe('the my-work tree’s keyboard', () => {
	it('moves the roving selection and points aria-activedescendant at it', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		mwPress(view, 'ArrowDown');

		expect(mwActive(view)).toBe('Feature.md');
		expect(treeEl(view).getAttribute('aria-activedescendant')).toBe(mwRow(view, 'Feature.md').id);
	});

	it('opens and closes a row with the arrow keys', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		mwPress(view, 'ArrowDown'); // Feature.md — has one child, PBI Ada.md.
		mwPress(view, 'ArrowLeft'); // Open -> fold it shut.
		expect(mwRow(view, 'Feature.md').getAttribute('aria-expanded')).toBe('false');

		mwPress(view, 'ArrowRight'); // Closed -> step IN means unfold first.
		expect(mwRow(view, 'Feature.md').getAttribute('aria-expanded')).toBe('true');
	});

	it('opens the note on Enter', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');

		mwPress(view, 'ArrowDown'); // Feature.md
		mwPress(view, 'Enter');

		expect(vault.opened.map((o) => o.path)).toEqual(['Feature.md']);
		// Opening is never a write — the whole point of a context-row target.
		expect(vault.writeLog).toHaveLength(0);
	});

	it('keeps the selected row across the redraw a fold causes', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		treeEl(view).focus();

		mwPress(view, 'ArrowDown'); // Feature.md
		// A MOUSE fold, not a keyboard one: `drawDisclosure` sets `activeRowFile` before
		// `toggleFold` calls `render()`, which detaches and rebuilds the whole tree —
		// without `treeHadFocus` and the restore this drives, this drops focus to the body
		// and strands the keyboard one press in (`render()`'s own stated reason).
		mwTwisty(view, 'Feature.md').click();

		expect(document.activeElement).toBe(treeEl(view));
		expect(mwActive(view)).toBe('Feature.md');
	});

	it('reaches both ends with Home and End', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		mwPress(view, 'End');
		expect(mwActive(view)).toBe('PBI Hidden.md');

		mwPress(view, 'Home');
		expect(mwActive(view)).toBe('Epic.md');
	});

	/**
	 * The acceptance criterion Task 4's own PBI states and no test asserted, because
	 * nothing set `activeRowFile` until this task's keyboard did: a pick is a change of
	 * SCREEN — a different person's tree — and the roving row must not survive it, the
	 * same rule `ReleaseView.pick()` states for `activeScopeFile`. `Feature.md` is
	 * context in BOTH Ada's and Bo's trees, so a leaked file that merely happened to
	 * land on either person's own first row would pass by accident; this does not.
	 */
	it('clears the roving row on a pick, so a different person does not inherit it', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		mwPress(view, 'ArrowDown');
		expect(mwActive(view)).toBe('Feature.md');

		view.pick('People/Bo.md');

		expect(view.activeRowFile).toBeNull();
		expect(mwActive(view)).toBeNull();
	});

	it('marks the row a click lands on, not the row the keyboard left behind', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		mwRow(view, 'PBI Ada.md').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

		expect(mwActive(view)).toBe('PBI Ada.md');
		expect(view.activeRowFile?.path).toBe('PBI Ada.md');
	});

	it('leaves the clicked row marked when the click focuses the tree', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		// The browser's own order: `mousedown`, then focus lands on the tree (one tab
		// stop, so the nearest focusable ancestor takes it), then `click`. jsdom does
		// neither the focus nor the click for us, so the focus is dispatched by hand —
		// it is the event whose listener used to repaint row 0 and scroll to the top.
		mwRow(view, 'PBI Ada.md').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		treeEl(view).dispatchEvent(new FocusEvent('focus'));

		expect(mwActive(view)).toBe('PBI Ada.md');
	});
});
