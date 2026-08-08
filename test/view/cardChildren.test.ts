// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { refresh, titlesOf, useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';
import { childrenLabel, listedChildren } from '../../src/view/childrenList';
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

/**
 * Like `boardVault`, but Epic B's children carry no explicit `type` — the common case,
 * where each child's badge names the level the ladder implies rather than a declared
 * name. The label has to agree with that badge.
 */
function untypedChildrenVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
	vault.addFile('Feature B1.md', { frontmatter: { order: 10, status: 'Done' }, parentLink: 'Epic B' });
	vault.addFile('Feature B2.md', { frontmatter: { order: 20 }, parentLink: 'Epic B' });
	return vault;
}

describe('children on the card', () => {
	it('names the visible direct children, by their shared type', () => {
		const { containerEl } = makeBoard(boardVault());
		expect(disclosure(cardByTitle(containerEl, 'Epic B'))?.textContent).toContain('2 features');
	});

	// The common case: nothing on these notes declares a type, so `childrenLabel` has
	// to name them by the level the ladder gives them — the same thing their badges
	// read — rather than seeing `typeName === null` and degrading to "2 children".
	it('names untyped children by the level their badges show, not a bare count', () => {
		const { containerEl } = makeBoard(untypedChildrenVault());
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

	it('styles a done child by ITS OWN workflow, not the requirements one', () => {
		// A Deliverable is offered as a child under an Epic, a Feature and a PBI, and it is
		// tracked by its own workflow everywhere else — the board it has, the chip, the
		// menu, the timeline bar. Asking `child.done` here dims one whose requirements
		// state happens to read done and leaves a finished one undimmed, which is the same
		// type-dispatch rule failing at one more surface.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Shipped.md', {
			frontmatter: { type: 'Deliverable', order: 10, status: 'New', docStatus: 'Published' },
			parentLink: 'Epic',
		});
		vault.addFile('Open.md', {
			frontmatter: { type: 'Deliverable', order: 20, status: 'Done', docStatus: 'Draft' },
			parentLink: 'Epic',
		});
		const { containerEl } = makeBoard(vault, {
			deliverableStateProperty: 'note.docStatus',
			deliverableStateValues: 'Draft, Published',
			deliverableDoneValues: 'Published',
		});
		const card = cardByTitle(containerEl, 'Epic');
		disclosure(card)?.click();

		const done = Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid.pbl-done'));
		expect(done.map((el) => el.querySelector('.pbl-card-kid-title')?.textContent)).toEqual(['Shipped']);
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

	// `disabled` on a <button> stops a click dispatched at the button itself, but not one
	// that lands on a CHILD element and bubbles — the chevron and count spans are both
	// inside the toggle. Without the guard this write is invisible on screen (`isCollapsed`
	// reads false under the filter regardless, whatever the write set), and only shows up
	// once the filter clears — reproducing exactly that: expand for real first (a card
	// opens collapsed by default, so an unguarded write from THAT state could land on the
	// same value it started at and prove nothing), then let a filtered click try to flip it.
	it('writes nothing when a click lands on the chevron inside a disabled toggle', () => {
		const { containerEl, view } = makeBoard(boardVault());
		disclosure(cardByTitle(containerEl, 'Epic B'))?.click();
		expect(view.isCollapsed('Epic B.md')).toBe(false);

		// Re-fetched: `setFilter` re-renders the board, so the card handle above is
		// now detached.
		view.setFilter('Feature B');
		const toggle = disclosure(cardByTitle(containerEl, 'Epic B'));
		expect(toggle?.disabled).toBe(true);
		const chevron = toggle?.querySelector<HTMLElement>('.pbl-card-kids-chevron');

		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(view.isCollapsed('Epic B.md')).toBe(false);
		// Clearing the filter is what would surface a stray write — confirm none landed.
		view.setFilter('');
		expect(view.isCollapsed('Epic B.md')).toBe(false);
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

	// FOCUSED on Epic, and that is load-bearing rather than incidental. On an unfocused
	// board `Feature B1` has a card of its own, and `hiddenMatches` already skips every
	// path in `cardPaths` — so the match list would omit it before this change, and the
	// test would pass green against the unfixed code while appearing to prove the
	// dedup. Focus removes the child's card, which is the only state where the
	// disclosure and the match list can both reach for the same item.
	it('does not name a matched child twice on one card', () => {
		const { containerEl, view } = makeBoard(boardVault(), {}, { focus: 'Epic' });
		view.setFilter('Feature B1');
		const card = cardByTitle(containerEl, 'Epic B');

		// The disclosure lists it (the filter forces every card open) …
		expect(kidTitles(card)).toContain('Feature B1');
		// … so the match list must not name it as well.
		const matches = Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-match')).map(
			(el) => el.textContent,
		);
		expect(matches).not.toContain('Feature B1');
	});

	it('still names a match the disclosure cannot reach', () => {
		const { containerEl, view } = makeBoard(nestedVault(), {}, { focus: 'Epic' });
		view.setFilter('Task B1a');
		const card = cardByTitle(containerEl, 'Epic B');

		// A grandchild: one level down is not what the disclosure shows, and with the
		// board focused on Epics it has no card of its own either. The match list is the
		// only thing that can reach it, so the dedup must not have taken it.
		const matches = Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-match')).map(
			(el) => el.textContent,
		);
		expect(matches).toContain('Task B1a');
	});

	// The keyboard path for the same dedup: `addMatchSection` is a second reader of
	// `undisclosedMatches`, and nothing else in this suite drives it — the card-face
	// tests above assert `.pbl-card-match` in the DOM, which the menu never touches.
	it('does not name a matched child twice in the card menu either', () => {
		const { containerEl, view } = makeBoard(boardVault(), {}, { focus: 'Epic' });
		view.setFilter('Feature B1');
		const card = cardByTitle(containerEl, 'Epic B');
		card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		// The disclosure's entry …
		expect(titles).toContain('Open child "Feature B1"');
		// … so the match section must not offer it too.
		expect(titles).not.toContain('Open match "Feature B1"');
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
