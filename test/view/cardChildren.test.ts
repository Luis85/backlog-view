// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { boardVault, BOARD_WORKFLOW, cardByTitle, makeBoard } from '../helpers/board';
import { makeView, refresh, rowByTitle, titlesOf, useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';
import { childrenLabel, listedChildren } from '../../src/view/childrenList';
import { TIMELINE_SCOPE } from '../../src/view/viewState';
import { Menu } from '../helpers/obsidian-mock';
import { makeRoadmap, roadmapView, rowFor } from '../helpers/roadmap';

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
 * `boardVault` plus a `Test case` under Epic B — a child on the OTHER ladder, which the
 * plan's projections do not draw at all. Feature B1 is still Done, so the same fixture
 * carries one child the plan hides and one it does not have.
 */
function catalogChildVault(): FakeVault {
	const vault = boardVault();
	vault.addFile('Case B1.md', { frontmatter: { type: 'Test case', order: 30 }, parentLink: 'Epic B' });
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

	// A count taken by subtracting a filtered list from a RAW one is the shape this branch
	// has now got wrong seven times: `listedChildren` drops a catalog child on membership,
	// and the subtraction then reports it as a plan row the view is choosing to hide. The
	// note says "hidden by the current view"; absent from this ladder is not that.
	it('does not count a catalog child as a row the plan is hiding', () => {
		const { containerEl } = makeBoard(catalogChildVault());
		expect(disclosure(cardByTitle(containerEl, 'Epic B'))?.dataset.tooltip).not.toContain('hidden');
	});

	// The control, in the SAME fixture, because a fix that silenced the note entirely would
	// pass the test above and delete the feature: Feature B1 is Done and hidden, so the note
	// must still appear — and say one, not the two a raw subtraction would count.
	it('still counts a completed child the view is hiding, and only that one', () => {
		const { containerEl } = makeBoard(catalogChildVault(), { showCompleted: false });
		expect(disclosure(cardByTitle(containerEl, 'Epic B'))?.dataset.tooltip).toContain(
			'1 more is hidden by the current view',
		);
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

	it('keeps its own bit, independent of the tree row for the same item', () => {
		const vault = boardVault();
		const { containerEl, view } = makeBoard(vault);
		expect(view.isCardCollapsed('Epic B.md')).toBe(true);
		expect(view.isCollapsed('Epic B.md')).toBe(true);

		disclosure(cardByTitle(containerEl, 'Epic B'))?.click();

		// The card opened; the tree row for the same note did not.
		expect(view.isCardCollapsed('Epic B.md')).toBe(false);
		expect(view.isCollapsed('Epic B.md')).toBe(true);

		// And the reverse: opening the tree row neither reopens nor recloses the card.
		view.setCollapsed('Epic B.md', false);
		expect(view.isCollapsed('Epic B.md')).toBe(false);
		expect(view.isCardCollapsed('Epic B.md')).toBe(false);
	});

	it('carries a pre-split entry into the card’s own scope rather than opening every card shut', () => {
		// What an installed version stored: one bit per note, which was the bit the tree
		// row and the card both read. Splitting them must copy it across — otherwise the
		// first open after the upgrade finds the card's scope unsettled and applies the
		// default to all of it, closing every card the reader had left open.
		const vault = boardVault();
		vault.localStorage.set('product-backlog:view-state', {
			'Backlog.base#Backlog': {
				base: 'Backlog.base',
				folds: { collapsed: [], expanded: ['Epic B.md'], lanes: [] },
				prefs: {},
			},
		});

		const { containerEl, view } = makeView(vault, { ...BOARD_WORKFLOW }, { base: 'Backlog.base' });
		view.setProjection('board');

		expect(kidTitles(cardByTitle(containerEl, 'Epic B'))).toEqual(['Feature B1', 'Feature B2']);
	});

	// Before this split, a card's disclosure on the DATED axis routed through the same
	// key as the row's own chevron (`TIMELINE_SCOPE`), never the bare path — with no
	// bare key stored for this note at all (it was never seen anywhere else), the
	// card's only recorded state is that one.
	it('carries a dated-axis card’s real expand into the new scope, with no bare key to fall back to', () => {
		const vault = new FakeVault();
		vault.addFile('Shelf item.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Shelf child.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Shelf item' });
		vault.localStorage.set('product-backlog:view-state', {
			'Backlog.base#Backlog': {
				base: 'Backlog.base',
				folds: { collapsed: [], expanded: [`${TIMELINE_SCOPE}Shelf item.md`], lanes: [] },
				prefs: {},
			},
		});

		const { containerEl } = roadmapView(
			vault,
			{ startProperty: 'note.start', targetProperty: 'note.due', horizonProperty: '' },
			{ base: 'Backlog.base' },
		);

		expect(kidTitles(cardByTitle(containerEl, 'Shelf item'))).toEqual(['Shelf child']);
	});

	// The other direction: `collapseNewParents` settles every parent collapsed in EVERY
	// scope on every data update, whether or not the dated roadmap was ever opened — so
	// a stored `TIMELINE_SCOPE` key proves nothing by merely existing, and an
	// installation that never touched the dated axis has one, collapsed, for this note
	// anyway. Preferring it over a genuinely expanded bare key would silently re-close a
	// board card the reader had left open.
	it('keeps a board card’s real expand even though its dated-axis bit is only the untouched default', () => {
		const vault = boardVault();
		vault.localStorage.set('product-backlog:view-state', {
			'Backlog.base#Backlog': {
				base: 'Backlog.base',
				folds: { collapsed: [`${TIMELINE_SCOPE}Epic B.md`], expanded: ['Epic B.md'], lanes: [] },
				prefs: {},
			},
		});

		const { containerEl, view } = makeView(vault, { ...BOARD_WORKFLOW }, { base: 'Backlog.base' });
		view.setProjection('board');

		expect(kidTitles(cardByTitle(containerEl, 'Epic B'))).toEqual(['Feature B1', 'Feature B2']);
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
	// inside the toggle. Without the guard this write is invisible on screen
	// (`isCardCollapsed` reads false under the filter regardless, whatever the write set),
	// and only shows up once the filter clears — reproducing exactly that: expand for real
	// first (a card opens collapsed by default, so an unguarded write from THAT state could
	// land on the same value it started at and prove nothing), then let a filtered click
	// try to flip it.
	it('writes nothing when a click lands on the chevron inside a disabled toggle', () => {
		const { containerEl, view } = makeBoard(boardVault());
		disclosure(cardByTitle(containerEl, 'Epic B'))?.click();
		expect(view.isCardCollapsed('Epic B.md')).toBe(false);

		// Re-fetched: `setFilter` re-renders the board, so the card handle above is
		// now detached.
		view.setFilter('Feature B');
		const toggle = disclosure(cardByTitle(containerEl, 'Epic B'));
		expect(toggle?.disabled).toBe(true);
		const chevron = toggle?.querySelector<HTMLElement>('.pbl-card-kids-chevron');

		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(view.isCardCollapsed('Epic B.md')).toBe(false);
		// Clearing the filter is what would surface a stray write — confirm none landed.
		view.setFilter('');
		expect(view.isCardCollapsed('Epic B.md')).toBe(false);
	});

	// The card menu's toggle has to write the same bit the card's own disclosure reads —
	// `isCardCollapsed`, never `isCollapsed` — or the two would disagree about whether
	// the card is open. `addChildrenSection` serves both a card's toggle and a dated-axis
	// bar's from one function, so this is the case that proves it picked the card's pair.
	it('the menu’s Show/Hide children toggle writes the card’s own bit, not the tree row’s', () => {
		const { containerEl, view } = makeBoard(boardVault());
		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		expect(Menu.lastShown?.items.map((i) => i.titleText)).toContain('Show children');
		Menu.lastShown?.item('Show children')?.clickHandler?.();

		expect(view.isCardCollapsed('Epic B.md')).toBe(false);
		expect(view.isCollapsed('Epic B.md')).toBe(true);
	});

	// The menu key is the case the section exists for — and it reaches buildItemMenu
	// through showContextMenuFor, never through the render's wiring. A discriminator
	// that lived on the pointer path would pass the test above and fail here.
	it('offers the toggle on the menu key too', () => {
		const { containerEl, view } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		card.click();
		view.showContextMenuFor(
			// The selected item, by the same path the card carries.
			view.model!.items.find((i) => i.file.path === card.dataset.path)!,
		);

		expect(Menu.lastShown?.items.map((i) => i.titleText)).toContain('Show children');
	});

	it('offers nothing on a card that drew no disclosure', () => {
		const { containerEl } = makeBoard(boardVault());
		cardByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles).not.toContain('Show children');
		expect(titles).not.toContain('Hide children');
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

	// The menu's side of the same question. It must name the child ONCE — the disclosure's
	// own entries are `tabindex="-1"`, so a matched child the face lists needs a menu
	// entry — and never twice. Both sections can reach for it here: it matches, and it has
	// no card under this focus. The match walk subtracts what the disclosure lists, so the
	// child section is the one that owns it, and there is only one walk to disagree with.
	it('names a matched child in the card menu exactly once', () => {
		const { containerEl, view } = makeBoard(boardVault(), {}, { focus: 'Epic' });
		view.setFilter('Feature B1');
		const card = cardByTitle(containerEl, 'Epic B');
		card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		// The face lists it …
		expect(kidTitles(card)).toContain('Feature B1');
		// … and the menu names it, once, under whichever section owns it.
		const titles = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(titles.filter((t) => t.endsWith('"Feature B1"'))).toEqual(['Open child "Feature B1"']);
	});

	// The per-child entries, back where nothing else can reach the child and gone where
	// something can. Focus is what separates the two: unfocused, every result has a card
	// of its own, which is the state the clutter these were removed for was reported in.
	const BOTH = ['Open child "Feature B1"', 'Open child "Feature B2"'];
	it.each([
		['board under a focus', (v: FakeVault) => makeBoard(v, {}, { focus: 'Epic' }), BOTH],
		['board unfocused', (v: FakeVault) => makeBoard(v), []],
		// A FOLD is the second way a child loses its card, and it needs no focus: the Done
		// column starts shut over `Feature B1` alone, so that card is in the model and not
		// on screen while its stateless sibling still has one — which is why this case
		// expects ONE entry and is worth its own row. It composes with no code of its own
		// because `renderBoard` publishes the DRAWN board as the snapshot, folded columns
		// emptied, and `cardedPaths` reads that rather than the model.
		['board with the child’s column folded', (v: FakeVault) => makeBoard(v, {}, { foldedColumns: true }), [BOTH[0]]],
		// The HORIZON board is exempt from the whole section since 2026-08-17 (asked for
		// directly): its card menu names no children, focused or not — the boundary
		// `test/view/horizonMenu.test.ts` owns, so a focused uncarded child here expects
		// nothing where the board rows above expect BOTH.
		['roadmap under a focus', (v: FakeVault) => makeRoadmap(v, {}, { focus: 'Epic' }), []],
		['roadmap unfocused', (v: FakeVault) => makeRoadmap(v), []],
	] as const)('offers Open child only where the child has no card of its own — %s', (_name, mount, offered) => {
		const vault = boardVault();
		const { containerEl } = mount(vault);
		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		const menu = Menu.lastShown;
		const titles = menu?.items.map((i) => i.titleText) ?? [];
		// The whole list, not a membership test: the card face lists BOTH children, and a
		// child that HAS a card must not be named here as well as there.
		expect(titles.filter((t) => t.startsWith('Open child'))).toEqual(offered);
		// And the entry opens the CHILD — the whole of what it is for. Asked of the vault
		// rather than of the title, since a wrong item would still be a plausible name.
		if (offered.length === 0) return;
		menu?.items.find((i) => i.titleText === 'Open child "Feature B1"')?.click();
		expect(vault.opened.at(-1)?.path).toBe('Feature B1.md');
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
		expect(titles).not.toContain('Show children');
		expect(titles).not.toContain('Hide children');
	});

	it('keeps a shelf card’s disclosure with the AXIS, not with the tree', () => {
		// The scope is the PROJECTION's, not the control's: everything on the dated axis
		// — its rows and the shelf beside them — is one working position, kept apart from
		// the backlog's. A shelf card is on that screen, so its disclosure goes with it.
		const { containerEl, view } = makeRoadmap(datedVault(), DATED_AXIS);
		disclosure(cardByTitle(containerEl, 'Feature X'))?.click();
		expect(kidTitles(cardByTitle(containerEl, 'Feature X'))).toEqual(['Task X1']);

		view.setProjection('tree');
		// Opened one level by hand, so what is asked is the FEATURE's own bit: the shelf
		// card's expand must not have opened the same node in the backlog.
		rowByTitle(containerEl, 'Dated epic').querySelector<HTMLElement>('.pbl-chevron')?.click();
		expect(titlesOf(containerEl)).toEqual(['Dated epic', 'Feature X']);
	});

	it('still offers the toggle on a shelf card in the same projection', () => {
		const { containerEl } = makeRoadmap(datedVault(), DATED_AXIS);
		cardByTitle(containerEl, 'Feature X').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		expect(Menu.lastShown?.items.map((i) => i.titleText)).toContain('Show children');
	});
});
