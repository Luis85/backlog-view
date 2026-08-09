// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { fixture, key, makeView, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';
import { resolveSettings } from '../../src/domain/settings';

useViewHarness();

/** A plain left click on the row's body — the gesture both options are about. */
function click(row: HTMLElement, modifiers: Partial<MouseEventInit> = {}): void {
	row.dispatchEvent(new MouseEvent('click', { bubbles: true, ...modifiers }));
}

/** The view config Bases would hand back for a hand-written `.base`. */
const config = (values: Record<string, unknown>) => ({ get: (key: string) => values[key], getAsPropertyId: () => null }) as never;

describe('what a click on an item does', () => {
	it('opens in the current tab by default', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		click(rowByTitle(containerEl, 'Feature B1'));

		expect(vault.opened).toEqual([{ path: 'Feature B1.md', mode: false }]);
	});

	it('folds the row and opens nothing when clicking is configured to fold', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { clickAction: 'fold' });
		expect(titlesOf(containerEl)).toContain('Feature B1');

		click(rowByTitle(containerEl, 'Epic B'));

		expect(titlesOf(containerEl)).not.toContain('Feature B1');
		expect(vault.opened).toEqual([]);
		// And back: one gesture, both directions, like the chevron it stands in for.
		click(rowByTitle(containerEl, 'Epic B'));
		expect(titlesOf(containerEl)).toContain('Feature B1');
	});

	/**
	 * The modifier is Obsidian's gesture, not this view's, so no setting may take it —
	 * and folding a row it cannot reach is not what a user asking for a new tab meant.
	 */
	it('still opens on a modified click while folding is configured', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { clickAction: 'fold' });

		click(rowByTitle(containerEl, 'Epic B'), { ctrlKey: true });

		expect(vault.opened).toEqual([{ path: 'Epic B.md', mode: 'tab' }]);
		expect(titlesOf(containerEl)).toContain('Feature B1');
	});

	/**
	 * A leaf row has no fold to do. It must not fall through to opening either: the
	 * same gesture meaning "fold" on a parent and "open" on its child is unpredictable
	 * on both, and the note is a menu entry away.
	 */
	it('opens nothing when a row with no children is clicked in fold mode', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { clickAction: 'fold' });

		click(rowByTitle(containerEl, 'Feature B1'));

		expect(vault.opened).toEqual([]);
	});

	/**
	 * The chevron's own guard, restated on the row: `isCollapsed` reports false while a
	 * filter runs, so a flip here would look inert and then take effect once the filter
	 * cleared. Not opening either — the click still means fold, it just cannot.
	 */
	it('folds nothing while the quick filter is narrowing the tree', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, { clickAction: 'fold' });
		view.setFilter('Feature');

		click(rowByTitle(containerEl, 'Epic B'));

		expect(titlesOf(containerEl)).toContain('Feature B1');
		expect(vault.opened).toEqual([]);
	});

	/** `Enter` is the keyboard's way to the note, and folding does not take it. */
	it('opens the selection on Enter whatever clicking is configured to do', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { clickAction: 'fold' });
		click(rowByTitle(containerEl, 'Feature B1'));
		key(treeOf(containerEl), 'Enter');

		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B1.md']);
	});
});

describe('where an opened note goes', () => {
	it('opens in a new tab when the target is a tab', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { openIn: 'tab' });

		click(rowByTitle(containerEl, 'Feature B1'));

		expect(vault.opened).toEqual([{ path: 'Feature B1.md', mode: 'tab' }]);
	});

	/**
	 * Pinning is the point of the side target rather than a nicety: the default target
	 * REPLACES the current tab, which is the backlog's own, so a view meant to stay put
	 * while notes come and go has to say so before the first note lands beside it.
	 */
	it('pins the backlog leaf when the target is a split', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { openIn: 'split' }, { base: 'Backlog.base' });

		click(rowByTitle(containerEl, 'Feature B1'));

		expect(vault.opened).toEqual([{ path: 'Feature B1.md', mode: 'split' }]);
		expect(vault.leaves[0].pinned).toBe(true);
	});

	/**
	 * `getLeaf('split')` splits whatever is ACTIVE, and the backlog is active on every
	 * click — so a split per click would fill the window by the fourth item.
	 */
	it('reuses the side pane it already made', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { openIn: 'split' }, { base: 'Backlog.base' });

		click(rowByTitle(containerEl, 'Feature B1'));
		click(rowByTitle(containerEl, 'Feature B2'));

		expect(vault.opened.map((o) => o.mode)).toEqual(['split', 'split']);
		// One leaf made, not two: the backlog's own plus the single side pane.
		expect(vault.leaves).toHaveLength(2);
	});

	it('splits again once the side pane has been closed', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { openIn: 'split' }, { base: 'Backlog.base' });

		click(rowByTitle(containerEl, 'Feature B1'));
		vault.leaves.splice(1, 1);
		click(rowByTitle(containerEl, 'Feature B2'));

		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B1.md', 'Feature B2.md']);
		expect(vault.leaves).toHaveLength(2);
	});

	/** The menu's two entries are absolute: neither is redirected by the target. */
	it('keeps the menu entries meaning what they say', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { openIn: 'tab' });
		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Open to the right')?.click();

		expect(vault.opened).toEqual([{ path: 'Feature B1.md', mode: 'split' }]);
	});

	/**
	 * The pin belongs to the SETTING. One deliberate menu action must leave the
	 * workspace's pins as it found them, or it would silently change what an ordinary
	 * click does afterwards: `getLeaf(false)` cannot replace a pinned leaf, so the
	 * default target would stop opening in the tab it says it opens in.
	 */
	it('does not pin the backlog when the menu opens one note to the right', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, {}, { base: 'Backlog.base' });
		rowByTitle(containerEl, 'Feature B1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Open to the right')?.click();

		expect(vault.opened).toEqual([{ path: 'Feature B1.md', mode: 'split' }]);
		expect(vault.leaves[0].pinned).toBe(false);
	});
});

/**
 * Both keys are persisted in a `.base` a user can hand-edit, so the allowed list is
 * what decides — not the presence of a string. An unrecognised value falls back rather
 * than reaching a branch that has no arm for it.
 */
describe('a value no version of this plugin declared', () => {
	it('falls back to the defaults', () => {
		const settings = resolveSettings(config({ clickAction: 'toggle', openIn: 42 }));

		expect(settings.clickAction).toBe('open');
		expect(settings.openIn).toBe('active');
	});

	/**
	 * `constructor` is a value of every object, so `raw in offered` — and
	 * `offered[raw]` — would accept it and hand back a string the type says cannot
	 * exist. Same rule, same bug, as the type table `byName` was written for.
	 */
	it('falls back on a name inherited from Object.prototype', () => {
		const settings = resolveSettings(config({ clickAction: 'constructor', openIn: 'toString' }));

		expect(settings.clickAction).toBe('open');
		expect(settings.openIn).toBe('active');
	});

	it('reads the declared values back', () => {
		const settings = resolveSettings(config({ clickAction: 'fold', openIn: 'split' }));

		expect(settings.clickAction).toBe('fold');
		expect(settings.openIn).toBe('split');
	});
});
