// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { fixture, key, makeView, rowByTitle, titlesOf, treeOf, useViewHarness } from '../helpers/view';
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { resolveSettings } from '../../src/domain/settingsResolve';

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
		const { containerEl } = makeView(vault, {}, { folds: true });
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
		const { containerEl } = makeView(vault, {}, { folds: true });

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
		const { containerEl } = makeView(vault, {}, { folds: true });

		click(rowByTitle(containerEl, 'Feature B1'));

		expect(vault.opened).toEqual([]);
	});

	/**
	 * The option is the TREE's, and the option says so in its own name. A card is not a
	 * row with a fold — its disclosure lists children on the card's own face, and a card
	 * with nothing under it draws none at all — so folding on card activation would mean
	 * a different thing per projection and leave the commonest card inert.
	 */
	it('leaves card activation opening the note', () => {
		const vault = boardVault();
		// Epic B is a PARENT card, the one that has children to have folded.
		const { containerEl } = makeBoard(vault, {}, { folds: true });
		click(cardByTitle(containerEl, 'Epic B'));

		expect(vault.opened.map((o) => o.path)).toEqual(['Epic B.md']);
	});

	/** `Enter` is the keyboard's way to the note, and folding does not take it. */
	/**
	 * The pane wires activation once and resolves the row per event, so a gesture that
	 * began on no row — the tree's own background below the last row — must resolve to
	 * no item rather than to whichever row was wired last.
	 */
	it('activates nothing from the pane background', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		click(treeOf(containerEl));
		treeOf(containerEl).dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));

		expect(vault.opened).toEqual([]);
		expect(view.selectedPath).toBeNull();
	});

	/**
	 * The other half of resolving per event: a row element whose path the CURRENT model
	 * does not hold — the shape a stale element has after the note behind it leaves the
	 * results — resolves to no item, rather than crashing or acting on a memory.
	 */
	it('activates nothing from a row the model no longer knows', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const ghost = treeOf(containerEl).createDiv({ cls: 'pbl-row' });
		ghost.dataset.path = 'Gone.md';

		click(ghost);

		expect(vault.opened).toEqual([]);
	});

	it('opens the selection on Enter whatever clicking is configured to do', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, {}, { folds: true });
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
	 * Reuse belongs to the SETTING too. Two deliberate **Open to the right** picks are
	 * two placements — the menu path split afresh before this option existed and still
	 * does — so sharing the configured target's pane would make the second one replace
	 * the first note the user had just put on screen.
	 */
	it('splits afresh for each note the menu opens to the right', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, {}, { base: 'Backlog.base' });
		for (const title of ['Feature B1', 'Feature B2']) {
			rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
			Menu.lastShown?.item('Open to the right')?.click();
		}

		expect(vault.opened.map((o) => o.mode)).toEqual(['split', 'split']);
		// The backlog's own leaf, plus one per deliberate placement.
		expect(vault.leaves).toHaveLength(3);
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
 * The key is persisted in a `.base` a user can hand-edit, so the allowed list is what
 * decides — not the presence of a string. An unrecognised value falls back rather than
 * reaching a branch that has no arm for it.
 */
describe('a value no version of this plugin declared', () => {
	it('falls back to the defaults', () => {
		expect(resolveSettings(config({ openIn: 42 })).openIn).toBe('active');
	});

	/**
	 * `constructor` is a value of every object, so `raw in offered` — and
	 * `offered[raw]` — would accept it and hand back a string the type says cannot
	 * exist. Same rule, same bug, as the type table `byName` was written for.
	 */
	it('falls back on a name inherited from Object.prototype', () => {
		expect(resolveSettings(config({ openIn: 'toString' })).openIn).toBe('active');
	});

	it('reads the declared values back', () => {
		expect(resolveSettings(config({ openIn: 'split' })).openIn).toBe('split');
	});

	/**
	 * `clickAction` was this group's other option until 2026-08-11 and is now working
	 * position in the view-state store. A `.base` written before the move still holds the
	 * key, and nothing may read it back — a stale `fold` silently changing what a click
	 * does is the one way this move can be noticed by someone who never asked for it.
	 */
	it('ignores a clickAction key left in a base written before the move', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { clickAction: 'fold' });

		click(rowByTitle(containerEl, 'Epic B'));

		expect(vault.opened).toEqual([{ path: 'Epic B.md', mode: false }]);
		expect(titlesOf(containerEl)).toContain('Feature B1');
	});
});
