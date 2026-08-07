// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { refresh, titlesOf, useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';
import { childrenLabel, listedChildren } from '../../src/view/render/cardChildren';
import { Menu } from '../helpers/obsidian-mock';
import { makeRoadmap, rowFor } from '../helpers/roadmap';

useViewHarness();

/** The disclosure's toggle, or null when the card drew none. */
function disclosure(card: HTMLElement): HTMLButtonElement | null {
	return card.querySelector<HTMLButtonElement>('.pbl-card-kids-toggle');
}

function kidTitles(card: HTMLElement): string[] {
	return Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid-title')).map(
		(el) => el.textContent ?? '',
	);
}

/** `boardVault` plus a grandchild, so "direct children only" has something to exclude. */
function nestedVault(): FakeVault {
	const vault = boardVault();
	vault.addFile('Task B1a.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Feature B1' });
	return vault;
}

describe('children on the card', () => {
	it('names the visible direct children, by their shared type', () => {
		const { containerEl } = makeBoard(boardVault());
		expect(disclosure(cardByTitle(containerEl, 'Epic B'))?.textContent).toContain('2 features');
	});

	it('draws nothing on a card with no children', () => {
		const { containerEl } = makeBoard(boardVault());
		expect(disclosure(cardByTitle(containerEl, 'Epic A'))).toBeNull();
	});

	it('opens collapsed, and lists the children once expanded', () => {
		const { containerEl } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		expect(kidTitles(card)).toEqual([]);
		expect(disclosure(card)?.getAttribute('aria-expanded')).toBe('false');

		disclosure(card)?.click();

		expect(kidTitles(card)).toEqual(['Feature B1', 'Feature B2']);
		expect(disclosure(card)?.getAttribute('aria-expanded')).toBe('true');
	});

	it('lists direct children only — a grandchild is not on the epic', () => {
		const { containerEl } = makeBoard(nestedVault());
		const card = cardByTitle(containerEl, 'Epic B');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Feature B1', 'Feature B2']);
	});

	// `listedChildren` and `childrenLabel` are exported so the card menu (a later
	// increment) can build the same list and the same name without re-deriving either
	// — driven directly here, against a real model, rather than only through the DOM.
	it('answers directly: the visible children and the label built from them', () => {
		const { view } = makeBoard(boardVault());
		const epicB = view.model?.byPath.get('Epic B.md');
		if (!epicB) throw new Error('Epic B.md not in model');
		const children = listedChildren(view, epicB);
		expect(children.map((c) => c.title)).toEqual(['Feature B1', 'Feature B2']);
		expect(childrenLabel(children)).toBe('2 features');
	});

	it('excludes a child the view is hiding, and says so in the count', () => {
		// Feature B1 is Done; with completed work hidden it is not a child on screen.
		const { containerEl } = makeBoard(boardVault(), { showCompleted: false });
		const card = cardByTitle(containerEl, 'Epic B');
		expect(disclosure(card)?.textContent).toContain('1 feature');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Feature B2']);
	});

	// The rollup beside it still counts two. That disagreement is deliberate, and a
	// deliberate disagreement nothing explains is indistinguishable from a bug.
	it('explains the omitted child in the tooltip, and only when there is one', () => {
		const hiding = makeBoard(boardVault(), { showCompleted: false });
		expect(disclosure(cardByTitle(hiding.containerEl, 'Epic B'))?.dataset.tooltip).toContain(
			'1 more is hidden by the current view',
		);

		const showing = makeBoard(boardVault());
		expect(disclosure(cardByTitle(showing.containerEl, 'Epic B'))?.dataset.tooltip).not.toContain('hidden');
	});

	// `aria-controls` says the two are related and nothing about what the list holds.
	// A reader landing straight on the list needs the count, which is the toggle's text.
	it('names the list by the disclosure, not merely controls it', () => {
		const { containerEl } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		const toggle = disclosure(card);
		const list = card.querySelector<HTMLElement>('.pbl-card-kids-list');

		expect(toggle?.id).toBeTruthy();
		expect(list?.getAttribute('aria-labelledby')).toBe(toggle?.id);
		expect(toggle?.textContent).toContain('2 features');
	});

	it('styles a done child done', () => {
		const { containerEl } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		disclosure(card)?.click();
		const done = Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid.pbl-done'));
		expect(done.map((el) => el.querySelector('.pbl-card-kid-title')?.textContent)).toEqual([
			'Feature B1',
		]);
	});

	it('opens the child, not the card, on a primary click', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		const card = cardByTitle(containerEl, 'Epic B');
		disclosure(card)?.click();

		card.querySelectorAll<HTMLElement>('.pbl-card-kid')[0].click();

		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B1.md']);
	});

	it('opens the child, not the card, on a middle click', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		const card = cardByTitle(containerEl, 'Epic B');
		disclosure(card)?.click();

		card
			.querySelectorAll<HTMLElement>('.pbl-card-kid')[0]
			.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B1.md']);
	});

	// The toggle is the control whose failure is invisible: the card expands either way,
	// so an opened note is the only evidence the guard is missing.
	it('opens nothing when the toggle itself is clicked', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		disclosure(cardByTitle(containerEl, 'Epic B'))?.click();
		expect(vault.opened).toEqual([]);
	});

	it('opens nothing when the toggle itself is middle-clicked', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		disclosure(cardByTitle(containerEl, 'Epic B'))?.dispatchEvent(
			new MouseEvent('auxclick', { button: 1, bubbles: true }),
		);
		expect(vault.opened).toEqual([]);
	});

	it('keeps an expanded card expanded across a data update', () => {
		const vault = boardVault();
		const { containerEl, view } = makeBoard(vault);
		disclosure(cardByTitle(containerEl, 'Epic B'))?.click();

		refresh(view, vault);

		expect(kidTitles(cardByTitle(containerEl, 'Epic B'))).toEqual(['Feature B1', 'Feature B2']);
	});

	it('shares its bit with the tree row, because it is the same bit', () => {
		const vault = boardVault();
		const { containerEl, view } = makeBoard(vault);
		disclosure(cardByTitle(containerEl, 'Epic B'))?.click();

		view.setProjection('tree');

		expect(titlesOf(containerEl)).toContain('Feature B1');
	});

	it('disables the toggle while the quick filter runs, and lists anyway', () => {
		const { containerEl, view } = makeBoard(boardVault());
		view.setFilter('Feature B');
		const card = cardByTitle(containerEl, 'Epic B');
		// Asserted on the property, not a class: a control disabled only in CSS still
		// answers a keyboard.
		expect(disclosure(card)?.disabled).toBe(true);
		expect(kidTitles(card)).toEqual(['Feature B1', 'Feature B2']);
	});

	it('offers the same children in the card menu, on a right-click', () => {
		const { containerEl } = makeBoard(boardVault());
		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).toContain('Open child "Feature B1"');
		expect(titles).toContain('Open child "Feature B2"');
	});

	// The menu key is the case the section exists for — and it reaches buildItemMenu
	// through showContextMenuFor, never through the render's wiring. A discriminator
	// that lived on the pointer path would pass the test above and fail here.
	it('offers them on the menu key too', () => {
		const { containerEl, view } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		card.click();
		view.showContextMenuFor(
			// The selected item, by the same path the card carries.
			view.model!.items.find((i) => i.file.path === card.dataset.path)!,
		);

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).toContain('Open child "Feature B1"');
	});

	it('opens the child from the menu entry', () => {
		const vault = boardVault();
		const { containerEl } = makeBoard(vault);
		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		Menu.lastShown?.item('Open child "Feature B1"')?.clickHandler?.();

		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B1.md']);
	});

	it('offers nothing on a card that drew no disclosure', () => {
		const { containerEl } = makeBoard(boardVault());
		cardByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles.some((t) => t.startsWith('Open child'))).toBe(false);
	});

	/**
	 * The dated axis, drawing both surfaces at once: `Dated epic` has two dates so it
	 * gets a timeline ROW (the card shell in a bar-grid layout, never `renderCardBody`),
	 * while its undated `Feature X` is unplaceable and lands on the shelf, which draws
	 * ordinary cards. `horizonProperty: ''` clears the horizon axis `makeRoadmap`
	 * configures by default, so `activeAxis` resolves to dates.
	 */
	function datedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Dated epic.md', {
			frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' },
		});
		vault.addFile('Feature X.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Dated epic' });
		vault.addFile('Task X1.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Feature X' });
		return vault;
	}

	const DATED_AXIS = { startProperty: 'note.start', targetProperty: 'note.due', horizonProperty: '' };

	it('offers nothing on a timeline row, which draws no body', () => {
		const { containerEl } = makeRoadmap(datedVault(), DATED_AXIS);
		rowFor(containerEl, 'Dated epic')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles.some((t) => t.startsWith('Open child'))).toBe(false);
	});

	it('still offers them on a shelf card in the same projection', () => {
		const { containerEl } = makeRoadmap(datedVault(), DATED_AXIS);
		cardByTitle(containerEl, 'Feature X').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).toContain('Open child "Task X1"');
	});
});
