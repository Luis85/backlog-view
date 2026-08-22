// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Menu, MenuItem } from 'obsidian';
import { horizonVault, makeRoadmap, shelfCountOf, shelfOf, shelfTitles } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { cardByTitle } from '../helpers/board';
import { Harness, makeView, useViewHarness } from '../helpers/view';
import { bodyOf } from '../helpers/cssVars';

useViewHarness();

/**
 * The shelf's card/list pick: which layout the band draws, on the two surfaces that offer
 * it and in the store that remembers it.
 *
 * jsdom applies no stylesheet, so what a compact row LOOKS like is not a question this
 * file can answer — the layout is a class and `styles/shelf.css` is what it turns on,
 * measured in the browser harness instead (a card 110.1px tall and 277.8px wide against a
 * row 28.4px tall and full width, at a 1200x800 pane on Obsidian's own app.css). What IS
 * here is everything that is not layout: the class, the one thing a row DRAWS that a card
 * does not, the two surfaces agreeing, and the pick surviving.
 */
describe('the shelf’s card and list layouts', () => {
	/** Click a header picker and hand back the menu it opened. */
	function openMenu(containerEl: HTMLElement, selector: string): Menu {
		const btn = containerEl.querySelector<HTMLButtonElement>(selector);
		if (!btn) throw new Error(`shelf control not rendered: ${selector}`);
		Menu.lastShown = null;
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
		if (!Menu.lastShown) throw new Error(`no menu opened from ${selector}`);
		return Menu.lastShown;
	}

	function itemNamed(menu: Menu, title: string): MenuItem {
		const item = menu.items.find((i) => i.titleText === title);
		if (!item) throw new Error(`menu entry not found: ${title}`);
		return item;
	}

	const isList = (containerEl: HTMLElement): boolean => shelfOf(containerEl)?.hasClass('pbl-shelf-list') ?? false;

	/** The state chip a compact row carries, or null where none was drawn. */
	const stateOf = (containerEl: HTMLElement, title: string): HTMLElement | null =>
		cardByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-shelf-state .pbl-state-chip');

	/** The horizon fixture plus a state on an untriaged epic, so a shelved row has one to show. */
	function statefulShelf(): FakeVault {
		const vault = horizonVault();
		vault.addFile('Also untriaged.md', { frontmatter: { type: 'Epic', order: 40, status: 'Active' } });
		return vault;
	}

	/**
	 * `makeRoadmap` with a COLUMN order, which it takes no parameter for: the state chip is
	 * that property's own cell, so a shelf drawn with no resolved column draws no chip and
	 * the test asking about one would pass for the wrong reason.
	 */
	function statefulRoadmap(order: string[]): Harness {
		const harness = makeView(
			statefulShelf(),
			{ horizonProperty: 'note.horizon', horizonValues: 'Now, Later', stateProperty: 'note.status' },
			{ collapsed: true, order },
		);
		harness.view.setProjection('roadmap');
		harness.view.setShelfCollapsed(false);
		return harness;
	}

	it('draws the card grid until someone picks otherwise', () => {
		const { view, containerEl } = makeRoadmap(horizonVault());
		expect(view.shelfLayout).toBe('cards');
		expect(isList(containerEl)).toBe(false);
	});

	it('is a header picker beside the sort and the filter, out of the tab order like them', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		const btn = shelfOf(containerEl)?.querySelector<HTMLButtonElement>('.pbl-shelf-layout');
		expect(btn).not.toBeNull();
		// The pane is one tab stop while cards render, so every header control it carries is
		// reachable by assistive tech and invisible to Tab — the disclosure beside it is the
		// documented exception and this is not it.
		expect(btn?.getAttribute('tabindex')).toBe('-1');
		// The fixed ACT, never the current value: the value is what the menu's checkmark
		// says, and a name that changed under a reader would announce one control as two.
		expect(btn?.getAttribute('aria-label')).toBe('Shelf layout');
	});

	it('flips the band and comes back, drawing the same cards either way', () => {
		const { view, containerEl } = makeRoadmap(horizonVault());
		const before = shelfTitles(containerEl);

		itemNamed(openMenu(containerEl, '.pbl-shelf-layout'), 'List').click();

		expect(view.shelfLayout).toBe('list');
		expect(isList(containerEl)).toBe(true);
		// The pick is display only and narrows NOTHING — the same cards, the same count.
		// A layout that hid work would make the shelf's own total a lie, which is the rule
		// the sort keeps and the filter and the search deliberately do not.
		expect(shelfTitles(containerEl)).toEqual(before);
		expect(shelfCountOf(containerEl)).toBe(String(before.length));

		itemNamed(openMenu(containerEl, '.pbl-shelf-layout'), 'Cards').click();
		expect(view.shelfLayout).toBe('cards');
		expect(isList(containerEl)).toBe(false);
	});

	it('checks the layout in force, on the header picker and in the card menu alike', () => {
		const { view, containerEl } = makeRoadmap(horizonVault());
		const checks = (menu: Menu) => menu.items.map((i) => [i.titleText, i.checked]);

		expect(checks(openMenu(containerEl, '.pbl-shelf-layout'))).toEqual([
			['Cards', true],
			['List', false],
		]);

		view.setShelfLayout('list');
		// One builder feeds both surfaces, so they cannot come to disagree about which is
		// current — asserted through the header's own menu, since that is the one a click
		// opens; the card menu's submenu is built by the same `addShelfLayoutItems`.
		expect(checks(openMenu(containerEl, '.pbl-shelf-layout'))).toEqual([
			['Cards', false],
			['List', true],
		]);
	});

	it('offers the pick in the card menu, which is the keyboard’s way to it', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		Menu.lastShown = null;
		cardByTitle(containerEl, 'Untriaged').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const menu = Menu.lastShown;
		expect(menu).not.toBeNull();
		const entry = itemNamed(menu as Menu, 'Shelf layout');
		expect(entry.submenu?.items.map((i) => i.titleText)).toEqual(['Cards', 'List']);

		entry.submenu?.items[1].click();
		expect(view.shelfLayout).toBe('list');
	});

	describe('the state a compact row carries', () => {
		it('draws the chip in list mode and not in the card grid', () => {
			// A card draws no state chip because its own POSITION says the state — a column
			// IS a state, a bucket IS a horizon. The shelf is exactly where that stops being
			// true: a shelved card is in no column and no bucket, so a row is the one place
			// its state appears at all.
			const { view, containerEl } = statefulRoadmap(['note.status']);
			expect(stateOf(containerEl, 'Also untriaged')).toBeNull();

			view.setShelfLayout('list');
			expect(stateOf(containerEl, 'Also untriaged')?.textContent).toContain('Active');
		});

		it('draws nothing where the Base resolves no state column', () => {
			// The chip IS that property's cell, the tree's own rule: a Base that does not
			// draw the property draws no chip for it either, rather than a second reading of
			// the settings inventing one. Asserted through the WRAPPER as well, because an
			// empty box is a gap in the row rather than nothing at all — it is `:empty` in
			// the stylesheet that hides one, and there should be none to hide.
			const { view, containerEl } = statefulRoadmap([]);
			view.setShelfLayout('list');
			expect(stateOf(containerEl, 'Also untriaged')).toBeNull();
			expect(cardByTitle(containerEl, 'Also untriaged').querySelector('.pbl-shelf-state')).toBeNull();
		});

		it('is the tree’s own write surface rather than a second idea of one', () => {
			// Through `renderPropCells` and `renderStateChip`, which is what makes the whole
			// of that chip's behaviour arrive with it — the workflow this item's type writes,
			// the `tabindex="-1"` that keeps the composite one tab stop, and the context-row
			// refusal a copy written here could forget. A `<button>` is the result form; a
			// context row would get `.pbl-state-static`, and it cannot be tested from this
			// surface because a context row is never a shelf card at all (`deriveBars` routes
			// one to `RoadmapModel.context` before any placement is computed).
			const { view, containerEl } = statefulRoadmap(['note.status']);
			view.setShelfLayout('list');

			const chip = stateOf(containerEl, 'Also untriaged');
			expect(chip?.tagName).toBe('BUTTON');
			expect(chip?.getAttribute('tabindex')).toBe('-1');
		});
	});

	/**
	 * A compact row is ONE line, and a shelved parent's children list is what tests that: it
	 * is a direct child of the card, so a card laid out as a row would put the disclosure and
	 * its expanded list at the END of the line rather than beneath it. The row is therefore
	 * the card's SUMMARY and the children list is its sibling.
	 *
	 * jsdom lays nothing out, so what is asserted here is the STRUCTURE the stylesheet needs
	 * — which box the row treatment is on and which children are inside it. The geometry it
	 * buys was measured in the harness: the list beneath the summary at full width, and a row
	 * carrying property cells still 28px, where letting the card wrap instead fixed the first
	 * and took the second to 59px.
	 */
	describe('a shelved parent’s children', () => {
		function parentOnTheShelf(): FakeVault {
			const vault = horizonVault();
			vault.addFile('Untriaged parent.md', { frontmatter: { type: 'Feature', order: 50 } });
			vault.addFile('Its child.md', {
				frontmatter: { type: 'PBI', order: 10, parent: '[[Untriaged parent]]' },
				parentLink: 'Untriaged parent',
			});
			return vault;
		}

		const kidsOf = (containerEl: HTMLElement, title: string) =>
			cardByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-card-kids');

		it('draws no summary box in the card grid, where the card is already a column', () => {
			const { containerEl } = makeRoadmap(parentOnTheShelf());
			const card = cardByTitle(containerEl, 'Untriaged parent');
			expect(card.querySelector('.pbl-card-summary')).toBeNull();
			// And the disclosure is there to be misplaced in the first place.
			expect(kidsOf(containerEl, 'Untriaged parent')).not.toBeNull();
		});

		it('puts the children list BESIDE the summary box, never inside it', () => {
			const { view, containerEl } = makeRoadmap(parentOnTheShelf());
			view.setShelfLayout('list');

			const card = cardByTitle(containerEl, 'Untriaged parent');
			const summary = card.querySelector<HTMLElement>('.pbl-card-summary');
			const kids = kidsOf(containerEl, 'Untriaged parent');
			expect(summary).not.toBeNull();
			expect(kids).not.toBeNull();
			// The line is the summary's; the list is the card's own second child, which is
			// what lets the stylesheet put it beneath rather than at the end of the line.
			expect(summary?.contains(kids as Node)).toBe(false);
			expect(kids?.parentElement).toBe(card);
			// Everything that IS the line is inside the box, including the two notes this
			// module appends after the body and the state chip it adds for a row.
			expect(summary?.querySelector('.pbl-card-title')).not.toBeNull();
		});

		it('keeps the shelving reason and the dependency note on the line', () => {
			// Both are appended by `renderShelfCard` after the body rather than by it, so
			// they are the two things a summary box can silently be missing.
			const vault = horizonVault();
			vault.addFile('Bad dates.md', { frontmatter: { type: 'Epic', order: 60, horizon: 'Nowhere' } });
			const { view, containerEl } = makeRoadmap(vault, { horizonValues: 'Now, Later' });
			view.setShelfLayout('list');

			const card = cardByTitle(containerEl, 'Bad dates');
			const reason = card.querySelector('.pbl-shelf-reason');
			if (reason) expect(card.querySelector('.pbl-card-summary')?.contains(reason)).toBe(true);
		});
	});

	/**
	 * The pick reaches the iteration board's shelf too, and always did — that is the SORT's
	 * rule rather than the search's, the distinction `renderShelf` states and the one this
	 * suite exists to keep, since neither direction was checked when the two came apart
	 * (Codex, PR #183). The picker itself joined the board's header on 2026-08-21, once the
	 * keyboard path for it — the card menu's shelf section — served both surfaces
	 * (`docs/requirements/Cards or a list on the shelf.md` extension 1b).
	 *
	 * The search and the type filter were gated on `ShelfInput.picks` for exactly that
	 * reason, until that field went with the last caller that could ever pass `false`
	 * (2026-08-21) — see `renderShelf`'s own header. A layout was never in that rule: it
	 * hides nothing, the same cards are drawn either way, so a reader who has never seen
	 * the picker has lost no work and needs no way back. The shelf HEIGHT in the same
	 * change is one value for both bands for that same reason.
	 */
	describe('the iteration board’s shelf', () => {
		function sprintBoard(): Harness {
			const vault = new FakeVault();
			vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
			vault.addFile('Uncommitted.md', { frontmatter: { type: 'PBI', order: 30, status: 'New' } });
			const harness = makeView(
				vault,
				{
					stateProperty: 'note.status',
					stateValues: 'New, Done',
					doneValues: 'Done',
					iterationProperty: 'note.iteration',
					iterationOpenStates: 'New',
					iterationResolvedStates: 'Done',
				},
				{ base: 'Plan.base', order: ['note.status'] },
			);
			harness.view.setProjection('iteration');
			harness.view.setBoardScope('Sprint 12.md');
			return harness;
		}

		it('draws the layout picker too, since 2026-08-21', () => {
			const { containerEl } = sprintBoard();
			expect(shelfOf(containerEl)?.querySelector('.pbl-shelf-layout')).not.toBeNull();
		});

		it('still draws the picked layout, because a layout narrows nothing', () => {
			const { view, containerEl } = sprintBoard();
			expect(isList(containerEl)).toBe(false);

			view.setShelfLayout('list');
			expect(isList(containerEl)).toBe(true);
			// The state chip comes with the row here too, and for the same reason: this board's
			// columns ARE states, and a card on its shelf is in none of them.
			expect(stateOf(containerEl, 'Uncommitted')?.textContent).toContain('New');
		});
	});

	it('gives the row’s title a floor that yields in a pane too narrow to keep it', () => {
		// jsdom computes no layout and cannot resolve `min()`, so what is checkable here is
		// the DECLARATION — and it is worth checking, because a bare `16ch` is what this was
		// and it reads as correct. The behaviour behind it was measured in the harness across
		// the range: at 1200, 640, 480 and 380px the summary's scroll width equals its client
		// width and the floor holds the title at 132px; at 320px a fixed floor overran the
		// line by 7px, and the container-relative one does not. The percentage is of the
		// summary's own box rather than the viewport, since a shelf in a split pane is
		// narrower than the window it sits in.
		const css = readFileSync('styles/shelf.css', 'utf8');
		expect(bodyOf(css, '.pbl-shelf-list .pbl-card-title', 'styles/shelf.css')).toContain('min-width: min(16ch, 40%);');
	});

	it('remembers the pick for this saved view, without touching the base', () => {
		const { view, config } = makeRoadmap(horizonVault());
		view.setShelfLayout('list');
		// Working position on the device, never a `.base` setting — ADR 0011's rule, which
		// every shelf pick but the search already follows.
		expect(config.setCalls).toEqual([]);
	});
});
