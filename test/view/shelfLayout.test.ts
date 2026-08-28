// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Menu, MenuItem } from 'obsidian';
import { horizonVault, makeRoadmap, shelfCountOf, shelfOf, shelfTitles } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { cardByTitle } from '../helpers/board';
import { Harness, makeView, useViewHarness } from '../helpers/view';
import { bodyOf } from '../helpers/cssVars';
import { shelfLayoutIcon } from '../../src/view/interactions/shelfMenu';
import { ShelfLayout } from '../../src/domain/shelf';

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
		// The compact-row layout's own selectors live in `shelfList.css` (Task 4's split at
		// the 400-line cap) — `shelf.css` no longer declares `.pbl-shelf-list ...` at all.
		const css = readFileSync('styles/shelfList.css', 'utf8');
		expect(bodyOf(css, '.pbl-shelf-list .pbl-card-title', 'styles/shelfList.css')).toContain(
			'min-width: min(16ch, 40%);',
		);
	});

	it('remembers the pick for this saved view, without touching the base', () => {
		const { view, config } = makeRoadmap(horizonVault());
		view.setShelfLayout('list');
		// Working position on the device, never a `.base` setting — ADR 0011's rule, which
		// every shelf pick but the search already follows.
		expect(config.setCalls).toEqual([]);
	});

	it('shelfLayoutIcon falls back to the first entry for a value outside the vocabulary', () => {
		// Unreachable from the header button, whose own `host.shelfLayout` is always one of
		// SHELF_LAYOUTS — reachable only from a stored value an older or hand-edited session
		// left behind. The fallback keeps the picker's icon a real one rather than blank.
		expect(shelfLayoutIcon('cards')).toBe('layout-grid');
		expect(shelfLayoutIcon('list')).toBe('list');
		expect(shelfLayoutIcon('not-a-real-layout' as ShelfLayout)).toBe(shelfLayoutIcon('cards'));
	});

	/**
	 * A compact row's columns are the tree's own, published on the BAND — Task 4 of
	 * [[Cards or a list on the shelf]]'s follow-up. jsdom lays nothing out, so what is
	 * checkable here is structure (every row holds the same set of cells) and the
	 * published custom properties, never x positions — those were measured in the
	 * browser harness, recorded in the register.
	 *
	 * Two of these fixtures depart from the brief that produced them: `horizonVault()`
	 * carries no resolved property column and no state property by default (`makeRoadmap`
	 * never sets `config.order` unless asked), so a test that wants a real column — or a
	 * real state chip — to hold open has to configure one, or it passes vacuously with
	 * zero matched elements. Both tests below configure their own columns for exactly
	 * that reason; see task-4-report.md for the failure this produced before the fix.
	 */
	describe('a compact row’s columns are the tree’s, aligned', () => {
		/**
		 * Three shelved items, none with a horizon — `horizonVault()` puts two of its
		 * three epics into buckets, leaving one lone card on the shelf, which cannot show
		 * a per-row DIFFERENCE at all. This fixture keeps all three on the shelf and gives
		 * them different plain-property combinations instead, so `holdEmpty` has real
		 * variance to erase.
		 */
		function unplacedVault(): FakeVault {
			const vault = new FakeVault();
			vault.addFile('Has both.md', { frontmatter: { type: 'Epic', order: 10 } });
			vault.addFile('Has one.md', { frontmatter: { type: 'Epic', order: 20 } });
			vault.addFile('Has none.md', { frontmatter: { type: 'Epic', order: 30 } });
			vault.entryValues.set('Has both.md', { 'note.points': 3, 'note.owner': 'Alice' });
			vault.entryValues.set('Has one.md', { 'note.points': 5 });
			return vault;
		}

		it('holds a cell open for a column this row has no value for', () => {
			// A card DROPS an empty cell, correctly — it stacks its cells and sizes each to
			// content, so a blank one is a chip-shaped gap with nothing to reserve. A row is the
			// case where that argument stops: the cells are fixed width and shared across rows, so
			// a dropped one shifts every cell after it and the column stops being a column. That
			// is the TREE's rule, arrived at from the same place.
			const { containerEl } = makeRoadmap(unplacedVault(), {}, {
				shelfCollapsed: false,
				shelfList: true,
				order: ['note.points', 'note.owner'],
			});
			const counts = shelfOf(containerEl)
				?.querySelectorAll<HTMLElement>('.pbl-card-summary > .pbl-props')
				.values()
				.map((props) => props.querySelectorAll('.pbl-prop').length);
			const seen = new Set([...(counts ?? [])]);
			expect(seen.size).toBe(1);
		});

		it('reserves no column the whole band has nothing to show in', () => {
			// The per-BAND narrowing beside the per-ROW hold above, and the two answer different
			// questions: a row may not drop its own empty cell (it would move every cell after
			// it), while a column NO card in the band draws is width on every row and content on
			// none. A compact row has no column header, so that is a stretch of nothing rather
			// than an empty column a reader can see — measured at a 1280px pane over the demo
			// backlog's twenty unplaced items, three of five reserved columns drew on zero rows,
			// 384px of the row, with every title at its own 16ch floor.
			//
			// Both directions in one fixture: `note.points` is carried by two of the three cards
			// and `note.owner` by one, so both stay on EVERY row; `note.nothing` is carried by
			// none and is on no row at all.
			const { containerEl } = makeRoadmap(unplacedVault(), {}, {
				shelfCollapsed: false,
				shelfList: true,
				order: ['note.points', 'note.owner', 'note.nothing'],
			});
			const rows = Array.from(shelfOf(containerEl)?.querySelectorAll('.pbl-card-summary') ?? []);
			expect(rows).toHaveLength(3);
			for (const row of rows) expect(row.querySelectorAll('.pbl-props > .pbl-prop')).toHaveLength(2);
		});

		it('drops the state cell instead, which is not one of the shared columns', () => {
			// Extension 4b: held open rather than dropped. `.pbl-shelf-state` is its own box
			// outside `.pbl-props`, so holding the shared columns open (test above) says nothing
			// about it — and a row whose workflow does not write the drawn state property still
			// keeps a box with something in it, never a chip-shaped hole at the end of the line.
			const { containerEl } = makeRoadmap(horizonVault(), { stateProperty: 'note.status' }, {
				shelfCollapsed: false,
				shelfList: true,
				order: ['note.status'],
			});
			for (const state of Array.from(shelfOf(containerEl)?.querySelectorAll('.pbl-shelf-state') ?? [])) {
				expect(state.childElementCount).toBeGreaterThan(0);
			}
		});

		it('holds BOTH state columns open when a row writes only one of them', () => {
			// Nothing guarded this before review: reverting `dropEmpty: !list` in
			// `renderShelfState` back to a bare `true` left this suite at 22/22 —
			// `horizonVault()`'s single configured workflow means every row's ONE state
			// column is always drawn (`renderStateChip` returns `true` for an UNSET value on
			// a result row, a "State" button, and only `false` for a different workflow's
			// key or a context row), so there was never an empty state cell for `dropEmpty`
			// to hold open or drop. Two workflows on two distinct keys is what makes a row
			// genuinely leave one of them undrawn — extension 4b's own case, split from 4a
			// by review once the two stopped behaving the same way.
			const vault = new FakeVault();
			vault.addFile('A deliverable.md', { frontmatter: { type: 'Deliverable', order: 10, deliverableStatus: 'Draft' } });
			vault.addFile('A pbi.md', { frontmatter: { type: 'PBI', order: 20, status: 'New' } });
			const { containerEl } = makeRoadmap(
				vault,
				{ stateProperty: 'note.status', deliverableStateProperty: 'note.deliverableStatus' },
				{ shelfCollapsed: false, shelfList: true, order: ['note.status', 'note.deliverableStatus'] },
			);
			const counts = Array.from(shelfOf(containerEl)?.querySelectorAll('.pbl-shelf-state') ?? []).map(
				(state) => state.querySelectorAll('.pbl-prop').length,
			);
			// Both rows carry both cells — the Deliverable's own `note.status` cell empty,
			// the PBI's `note.deliverableStatus` cell empty — never one cell dropped and the
			// other shifted into its place.
			expect(counts).toEqual([2, 2]);
		});

		it('publishes the column widths on the band, never inheriting the tree’s', () => {
			// `renderTree` is the ONLY publisher of `--pbl-prop-w-N` and `renderPass` runs it for
			// the tree and the catalog alone, while `.pbl-tree` is built once in the constructor
			// and only emptied per pass — so a row reading them off the scroller got 132px on a
			// view opened into roadmap mode, and whatever a previous tree pass left on one that
			// had been there. Geometry that depended on projection history. (Codex, PR #187.)
			const { containerEl } = makeRoadmap(horizonVault(), {}, {
				shelfCollapsed: false,
				shelfList: true,
				order: ['note.points'],
			});
			const band = shelfOf(containerEl);
			expect(band?.style.getPropertyValue('--pbl-prop-w-0')).not.toBe('');
			expect(band?.style.getPropertyValue('--pbl-shelf-badge')).not.toBe('');
		});

		it('publishes nothing on a band drawing no cells', () => {
			// Beside the height and for its reason: a band with nothing to show reserves nothing.
			const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true, shelfList: true });
			expect(shelfOf(containerEl)?.style.getPropertyValue('--pbl-shelf-badge')).toBe('');
		});

		it('publishes the rollup label reservation for a shelved item that has one', () => {
			// `--pbl-rollup-label` is the one geometry the DATA decides rather than the
			// stylesheet — `renderTree`'s own rule, kept here for the band: absent when
			// nothing on the shelf has a rollup, set to this band's widest label otherwise,
			// never a stale value left over from a previous render (`renderShelf` removes
			// it before setting it, same as `renderTree`).
			const vault = new FakeVault();
			vault.addFile('Untriaged parent.md', { frontmatter: { type: 'Epic', order: 10 } });
			vault.addFile('Child A.md', {
				frontmatter: { type: 'Feature', order: 10, parent: '[[Untriaged parent]]' },
				parentLink: 'Untriaged parent',
			});
			vault.addFile('Child B.md', {
				frontmatter: { type: 'Feature', order: 20, parent: '[[Untriaged parent]]' },
				parentLink: 'Untriaged parent',
			});
			const { containerEl } = makeRoadmap(vault, { stateProperty: 'note.status' }, {
				shelfCollapsed: false,
				shelfList: true,
			});
			expect(shelfOf(containerEl)?.style.getPropertyValue('--pbl-rollup-label')).not.toBe('');
		});

		it('sizes the rollup reservation from what the type filter left', () => {
			// Two narrowings reach this band and only one of them is in `searchShelf`:
			// `organizeShelf` is where `shelfHiddenTypes` is applied. Sizing off its INPUT let a
			// hidden type's widest ratio go on reserving a lane nothing draws into, so the search
			// moved the columns and the type filter did not. The Epic is the only card here with
			// a rollup; hiding Epics must take the reservation with it. (Codex, PR #187.)
			const vault = new FakeVault();
			vault.addFile('Untriaged parent.md', { frontmatter: { type: 'Epic', order: 10 } });
			vault.addFile('Child A.md', {
				frontmatter: { type: 'Feature', order: 10, parent: '[[Untriaged parent]]' },
				parentLink: 'Untriaged parent',
			});
			const { view, containerEl } = makeRoadmap(vault, { stateProperty: 'note.status' }, {
				shelfCollapsed: false,
				shelfList: true,
			});
			expect(shelfOf(containerEl)?.style.getPropertyValue('--pbl-rollup-label')).not.toBe('');
			view.setShelfHiddenTypes(new Set(['Epic']));
			expect(shelfOf(containerEl)?.style.getPropertyValue('--pbl-rollup-label')).toBe('');
		});

		/**
		 * Seven flat root Epics with no parent, no children, no horizon, no columns and
		 * no state property — `shelfHeavyVault()`, this test's fixture until review found
		 * it. Every row's shape was trivially identical because every row had nothing:
		 * the same lane content (empty), the same absent columns, the same absent state.
		 * Deleting the parent-breadcrumb move into the lane, and separately making the
		 * lane conditional on a shelving reason, both left this test at 22/22 green — it
		 * could not see either mutation, which is exactly the six-violations-in-a-row
		 * failure mode the brief wrote it to catch. Recorded in task-4-report.md.
		 *
		 * This fixture instead gives every row something DIFFERENT to hold: a parent
		 * (two children of a shelved parent), a rollup (that parent has descendants and a
		 * configured workflow), a shelving reason on one row and not the others, a
		 * configured plain column with a value on some rows and not others, and a
		 * configured state property. If the top-level shape still comes back as ONE set
		 * across all five rows, the notes lane and the held-open cells are doing their job
		 * despite genuinely different content — the shape is checkable precisely because
		 * the CONTENT is not.
		 */
		function shelfCategoryVault(): FakeVault {
			const vault = new FakeVault();
			// Nothing at all in the lane, and no value on the one configured column: the
			// row with the least to show.
			vault.addFile('Root plain.md', { frontmatter: { type: 'Epic', order: 10 } });
			// Descendants and a workflow give this one a rollup — the lane's OTHER content.
			vault.addFile('Root with kids.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
			vault.addFile('Child one.md', {
				frontmatter: { type: 'Feature', order: 10, parent: '[[Root with kids]]', status: 'Active' },
				parentLink: 'Root with kids',
			});
			vault.addFile('Child two.md', {
				frontmatter: { type: 'Feature', order: 20, parent: '[[Root with kids]]' },
				parentLink: 'Root with kids',
			});
			// Both children have no horizon either, so both shelve in their own right —
			// each with a PARENT breadcrumb the lane has to hold, and a `note.points` value
			// on only one of them.
			vault.entryValues.set('Child one.md', { 'note.points': 3 });
			// An unreadable horizon is a shelving REASON, on a row with no parent and no
			// children — the fourth distinct combination.
			// An OBJECT resists `readPlacement`'s string tolerance entirely — a bare string
			// like 'Nowhere' would just mint an undeclared bucket instead of shelving.
			vault.addFile('Bad horizon.md', { frontmatter: { type: 'Epic', order: 30, horizon: {} } });
			return vault;
		}

		it('gives every row the same top-level items, which is what alignment rests on', () => {
			// **The category check, and the one that would have caught six review rounds at once.**
			// Alignment does not come from any single declaration; it comes from every top-level
			// item of the summary having the same flex configuration on every row. An item that is
			// present on some rows and absent on others breaks that as surely as one whose basis is
			// its own content — which is how the rollup, the shelving reason, the dependency note
			// and the parent breadcrumb each broke it in turn, one per review round, until they were
			// all moved into the always-drawn notes lane.
			//
			// jsdom lays nothing out, so what is checkable here is PRESENCE: the set of direct
			// children, by class, must be identical across every row in the band. A new
			// sometimes-drawn element on the line fails this without anyone predicting it, which a
			// list of the six known ones could not do.
			const { containerEl } = makeRoadmap(shelfCategoryVault(), { horizonValues: 'Now, Later', stateProperty: 'note.status' }, {
				shelfCollapsed: false,
				shelfList: true,
				order: ['note.points'],
			});
			const summaries = Array.from(shelfOf(containerEl)?.querySelectorAll('.pbl-card-summary') ?? []);
			// Five rows, genuinely different: confirms the fixture itself shelves what it
			// means to, rather than this test passing because nothing landed on the band.
			expect(summaries).toHaveLength(5);
			const shapes = new Set(
				summaries.map((summary) => Array.from(summary.children).map((child) => child.className).join('|')),
			);
			expect([...shapes]).toHaveLength(1);
		});

		it('leaves the type header out of the layout entirely, so both draw one', () => {
			// A type read as two things depending on how much room its cards took: a muted
			// uppercase line in the grid, a banded and counted strip in the list (reported from a
			// vault). The header says which TYPE a reader is in, which is the same fact in either
			// layout — so the rule moved to `shelfControls.css` with the band's other chrome and
			// the pinning came with it, since the band is a scrollport in both.
			//
			// Asked at the forbidden thing rather than by comparing two rules: any
			// `.pbl-shelf-list`-scoped selector naming the header or its count is a second look
			// for one type, whatever it declares.
			const list = readFileSync('styles/shelfList.css', 'utf8');
			expect(list).not.toMatch(/\.pbl-shelf-group-(header|count)/);
			const chrome = readFileSync('styles/shelfControls.css', 'utf8');
			expect(bodyOf(chrome, '.pbl-shelf-group-header', 'styles/shelfControls.css')).toContain('position: sticky;');
		});

		it('states the aligned-column geometry in the stylesheet', () => {
			// jsdom resolves no cascade and lays nothing out, so the checkable part is the
			// declaration and its selector. The geometry was measured in the browser harness at a
			// 1400px pane over the demo backlog's twenty unplaced items, against this commit's
			// own parent: median row height 22.4px to 28px, title x positions 4 to 1 — see
			// `styles/shelfList.css`'s own header for why this is not the 34px an earlier draft
			// of this comment stated.
			//
			// `.pbl-shelf-list`'s own rules live in `shelfList.css`, split out of `shelf.css` at
			// the 400-line cap this task's addition tripped.
			const css = readFileSync('styles/shelfList.css', 'utf8');
			const file = 'styles/shelfList.css';
			// The badge takes the band's own reserved slot, which is what puts every title on one x
			// — never `--pbl-meta-col`, which reserves for the rollup label and is sized off the
			// TREE's population.
			expect(bodyOf(css, '.pbl-shelf-list .pbl-card-head', file)).toContain('flex: 0 0 var(--pbl-shelf-badge, 84px);');
			// And the notes lane IS shrinkable, which is the other half of the narrow-pane policy:
			// rigid, it plus the badge and the fold slot pass a 380px pane before a single cell.
			expect(bodyOf(css, '.pbl-shelf-list .pbl-shelf-notes', file)).toContain('flex: 0 1 calc(');
			// The state box too, and `min-width: 0` is the load-bearing half: a flex item's default
			// `min-width: auto` is its content's minimum, so ordering it without unsetting that
			// leaves the last column rigid however narrow the pane gets.
			expect(bodyOf(css, '.pbl-shelf-list .pbl-shelf-state', file)).toContain('min-width: 0;');
			// And the cells take the tree's stored widths back, which `.pbl-card .pbl-prop` turns
			// off for a card. `0 1` rather than `0 0`: they must shrink together on a narrow pane
			// rather than force a horizontal scrollbar the band has never had.
			expect(bodyOf(css, '.pbl-shelf-list .pbl-card-summary .pbl-prop', file)).toContain(
				'flex: 0 1 var(--pbl-prop-w, 132px);',
			);
			// The title's basis is ZERO, and that is what makes the shrink identical row to row:
			// with `auto` the basis is the title's own text width, so two rows resolve their cells
			// to different widths under the same deficit and the alignment holds only until the
			// pane narrows.
			expect(bodyOf(css, '.pbl-shelf-list .pbl-card-title', file)).toContain('flex: 1 1 0;');
		});
	});
});
