// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap, shelfGroupHeaders, shelfOf, shelfTitles } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { key, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * Folding one TYPE group inside the shelf. Its own file rather than `shelfUx.test.ts`'s
 * tail: that file is at its line budget, and this is a fold rather than a display pick.
 *
 * The fold is the board column's own (`ColumnScope`'s `shelf`), so what is asserted here
 * is what folding MEANS on this surface — the cards go, the count stays, the keyboard
 * cannot reach what is not drawn — and that the pick survives the view. That it is stored
 * at all is `test/storage/viewStateStore.test.ts`'s, beside every other fold.
 */
describe('folding a shelf type group', () => {
	/** Two unplaced types, so a fold can be asserted against a group it must not touch. */
	function mixedShelf(): FakeVault {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		return vault;
	}

	const foldOf = (containerEl: HTMLElement, type: string) =>
		Array.from(shelfOf(containerEl)?.querySelectorAll<HTMLElement>('.pbl-shelf-group') ?? [])
			.find((group) => group.querySelector('.pbl-shelf-group-name')?.textContent === type)
			?.querySelector<HTMLButtonElement>('.pbl-chevron') ?? null;

	const groupOf = (containerEl: HTMLElement, type: string) =>
		Array.from(shelfOf(containerEl)?.querySelectorAll<HTMLElement>('.pbl-shelf-group') ?? []).find(
			(group) => group.querySelector('.pbl-shelf-group-name')?.textContent === type,
		) ?? null;

	it('opens every group, since a type nobody has ruled on is not a finished one', () => {
		const { containerEl } = makeRoadmap(mixedShelf());
		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
		expect(shelfTitles(containerEl)).toEqual(['Untriaged', 'A Task']);
		expect(foldOf(containerEl, 'Epic')?.getAttribute('aria-expanded')).toBe('true');
	});

	/**
	 * The fold takes the cards and keeps the header, the count and the group itself —
	 * which is the whole difference from the type filter beside it, where the group goes
	 * and only the shelf's own total says anything was there.
	 */
	it('takes one type away and leaves its count and its neighbour', () => {
		const { containerEl } = makeRoadmap(mixedShelf());

		foldOf(containerEl, 'Epic')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(shelfGroupHeaders(containerEl)).toEqual(['Epic', 'Task']);
		expect(shelfTitles(containerEl)).toEqual(['A Task']);
		const folded = groupOf(containerEl, 'Epic');
		expect(folded?.querySelector('.pbl-shelf-group-count')?.textContent).toBe('1');
		expect(folded?.querySelector('.pbl-shelf-cards')).toBeNull();
		// Said in the NAME, because the count deliberately survives the fold: a group that
		// stayed silent would announce a card it is not drawing.
		expect(folded?.getAttribute('aria-label')).toBe('Epic, collapsed, 1 item');

		foldOf(containerEl, 'Epic')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(shelfTitles(containerEl)).toEqual(['Untriaged', 'A Task']);
	});

	/**
	 * A card that is not drawn must not be selectable: `roadmap.cards` is the keyboard's
	 * linear walk and what the pane's `listbox`/`region` role is decided from, so a folded
	 * group has to contribute nothing to it rather than merely skip the DOM.
	 */
	it('takes its cards out of the keyboard walk', () => {
		const vault = new FakeVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl, view } = makeRoadmap(vault);
		const pane = containerEl.querySelector<HTMLElement>('.pbl-tree');

		foldOf(containerEl, 'Epic')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(view.roadmap?.cards ?? []).toEqual([]);
		// The whole roadmap is this one shelved card, so folding it leaves a plain region
		// — the same state hiding the last visible type produces.
		expect(containerEl.querySelector('.pbl-tree')?.getAttribute('role')).toBe('region');
		key(containerEl.querySelector<HTMLElement>('.pbl-tree') ?? pane!, 'ArrowDown');
		expect(view.selectedPath).toBeNull();
	});

	it('reopens the view with the same groups folded, without writing the .base', () => {
		const vault = mixedShelf();
		const first = makeView(vault, { horizonProperty: 'note.horizon' }, { base: 'Backlog.base', collapsed: true });
		first.view.setProjection('roadmap');
		first.view.setShelfCollapsed(false);
		foldOf(first.containerEl, 'Task')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(shelfTitles(first.containerEl)).toEqual(['Untriaged']);
		first.view.onunload();
		expect(first.config.setCalls).toEqual([]);

		const second = makeView(vault, { horizonProperty: 'note.horizon' }, { base: 'Backlog.base', collapsed: true });
		expect(shelfGroupHeaders(second.containerEl)).toEqual(['Epic', 'Task']);
		expect(shelfTitles(second.containerEl)).toEqual(['Untriaged']);
	});
});
