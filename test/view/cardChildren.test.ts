// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { boardVault, BOARD_WORKFLOW, cardByTitle, cardTitles, makeBoard } from '../helpers/board';
import { makeView, refresh, rowByTitle, titlesOf, useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';
import { childrenLabel, listedChildren } from '../../src/view/childrenList';
import { TIMELINE_SCOPE } from '../../src/view/viewState';
import { Menu } from '../helpers/obsidian-mock';
import { laneRoadmap, makeRoadmap, roadmapView, rowFor } from '../helpers/roadmap';

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

/**
 * The sprint board's own settings bag — a workflow, the iteration link and the two ends
 * of it. Shared by the focus-root cases below, which differ only in where the stamped row
 * hangs.
 */
const ITERATION_WORKFLOW = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
};

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

/**
 * A horizon-axis vault where a PBI with no horizon carries one Task child, both
 * returned by the base. Neither carries a horizon, so both shelve independently — the
 * PBI as a parent with a disclosure, the Task a second time as its own leaf row —
 * modelled on `horizonVault()` in `test/helpers/roadmap.ts`.
 */
function parentOnShelfVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Monthly statement.md', { frontmatter: { type: 'PBI', order: 10 } });
	vault.addFile('Reconcile the ledger.md', {
		frontmatter: { type: 'Task', order: 10 },
		parentLink: 'Monthly statement',
	});
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
		const { containerEl } = makeBoard(boardVault(), {}, { hideCompleted: true });
		const card = cardByTitle(containerEl, 'Epic B');
		expect(disclosure(card)?.textContent).toContain('1 feature');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Feature B2']);
	});

	// The rollup beside it still counts two. That disagreement is deliberate, and a
	// deliberate disagreement nothing explains is indistinguishable from a bug.
	it('explains the omitted child in the tooltip, and only when there is one', () => {
		const hiding = makeBoard(boardVault(), {}, { hideCompleted: true });
		expect(disclosure(cardByTitle(hiding.containerEl, 'Epic B'))?.dataset.tooltip).toContain(
			'1 more is hidden by the current view',
		);

		const showing = makeBoard(boardVault());
		expect(disclosure(cardByTitle(showing.containerEl, 'Epic B'))?.dataset.tooltip).not.toContain('hidden');
	});

	/**
	 * The walk that traverses through a row this projection does not draw STOPS where
	 * `projectionForest` has already re-rooted the subtree. `Epic C` draws no `Test case`,
	 * and the `PBI` hand-dropped below that one is a plan row whose parent the plan does
	 * not draw — so the forest promotes it to a root of its own and it gets a card.
	 *
	 * Carrying it up to `Epic C`'s face as well would contradict the forest, which puts
	 * the two side by side as roots rather than one under the other. This is the case that
	 * keeps the board and the Deliverables board still under a walk written for the
	 * roadmap's release, and there is nothing else in `src/` that stops it. (That walk's
	 * original input is gone — `inPlan` refuses every release since 2026-08-24 — but the
	 * stop it needs is not: this fixture is a catalog row, which is a plan non-member the
	 * forest promotes through in exactly the same way.)
	 *
	 * The second assertion is a FIXTURE guard rather than a second side of the claim: that
	 * `Dropped` has a card of its own is `projectionForest`'s doing, and no mutation of
	 * `drawnChildren` can move it. It says the fixture still poses the question — a
	 * promoted row exists to be carried up — and the first assertion is what says the walk
	 * refuses to carry it.
	 */
	it('stops at a row the forest has already promoted to a root of its own', () => {
		const vault = new FakeVault();
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('Case C1.md', { frontmatter: { type: 'Test case', order: 10 }, parentLink: 'Epic C' });
		vault.addFile('Dropped.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Case C1' });
		const { containerEl } = makeBoard(vault);

		expect(disclosure(cardByTitle(containerEl, 'Epic C'))).toBeNull();
		expect(cardByTitle(containerEl, 'Dropped')).not.toBeNull();
	});

	/**
	 * The other half of that stop: it reads a stamp, and the stamp is not this board's.
	 *
	 * The iteration board reads `realRoots` — the unfocused tree — so a focus level set on
	 * another projection reaches it unrevalidated (ADR 0011: the focus is working position
	 * on the device). `collectFocusRoots` has already stamped `focusRoot` on `Kid`, the
	 * topmost `PBI` of its branch, while `Carrier` is a `Feature` and keeps its child. So
	 * this board meets a focus root nothing here promoted — its population is
	 * `iterationResults`, which re-roots nothing at all.
	 *
	 * Applying the stop takes `Kid` off the carrier's face — and NOT off the board:
	 * `iterationResults` gives `Kid` a card of its own either way, so the cost is a card's
	 * list disagreeing with the board it is drawn on rather than work going missing. "On no
	 * card at all" was true of the ROADMAP's release under a focus, and was written here as
	 * well until 2026-08-22, when it was measured. That example has since gone the way the
	 * release did: `inPlan` refuses one everywhere as of 2026-08-24, so the work below a
	 * release is promoted and carded rather than stranded. The distinction the sentence
	 * draws — a face disagreeing with its board, versus work on no card at all — is what
	 * matters here, not the example that once showed it.
	 *
	 * The DEPTH used to be what separated this from the test above — the stop was asked only
	 * on the way up, and here the stamped row is a direct child. That reading was wrong one
	 * level down and the test below is what says so; what separates the two now is
	 * `drawsForestFrom` (`src/view/projection.ts`), which is a question about the projection
	 * and the walk's origin rather than about the row the walk has reached.
	 */
	it('lists a focus root that is a card’s own direct child, where nothing promoted it', () => {
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Carrier.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
		});
		vault.addFile('Kid.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
			parentLink: 'Carrier',
		});
		const { view, containerEl } = makeView(vault, ITERATION_WORKFLOW, { base: 'Plan.base', focus: 'PBI' });
		view.setBoardScope('Sprint 12.md');

		// The fixture guard: the stamp is what this case turns on, so it is asserted
		// rather than assumed — with `focusRoot` false the test would pass for no reason.
		expect(view.model?.byPath.get('Kid.md')?.focusRoot).toBe(true);

		// The probe under the sentence above, asserted rather than left as a claim: the cost
		// of the stop firing here is a face disagreeing with its board, never work off the
		// board — which is only true while `Kid` has a card of its own.
		expect(cardByTitle(containerEl, 'Kid')).not.toBeNull();
		const card = cardByTitle(containerEl, 'Carrier');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Kid']);
	});

	/**
	 * The same board, the same stamp, one level DEEPER — and the case the `descended` term
	 * read as a promotion. `Rel` is out of the sprint, so this board does not draw it and
	 * the walk goes THROUGH it; `Kid` beneath it carries `focusRoot` from
	 * `collectFocusRoots` alone, exactly as it does at depth 0 above. Nothing on this board
	 * promoted either of them — its population is `iterationResults` over `realRoots` — so
	 * the answer may not move with the depth.
	 *
	 * With the stop asked of `descended && focusRoot`, `Kid` came off the carrier's face
	 * while still drawing its own board card: the harm the test above names, one level down
	 * (Codex, fix round 3). `cardTitles` is asserted for the whole frame so the card and the
	 * face are read together — a list disagreeing with the board it is drawn on is the whole
	 * of the defect.
	 */
	it('lists one two levels down, where the board still promoted nothing', () => {
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Carrier.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
		});
		vault.addFile('Rel.md', { frontmatter: { type: 'Release', order: 10 }, parentLink: 'Carrier' });
		vault.addFile('Kid.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
			parentLink: 'Rel',
		});
		const { view, containerEl } = makeView(vault, ITERATION_WORKFLOW, { base: 'Plan.base', focus: 'PBI' });
		view.setBoardScope('Sprint 12.md');

		// The fixture guard, as above: the stamp is what the case turns on.
		expect(view.model?.byPath.get('Kid.md')?.focusRoot).toBe(true);
		expect(cardTitles(containerEl)).toEqual(['Carrier', 'Kid']);
		const card = cardByTitle(containerEl, 'Carrier');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Kid']);
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
		const { containerEl } = makeBoard(catalogChildVault(), {}, { hideCompleted: true });
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

	/**
	 * The AXIS half of `isRowUndrawn`, which the old denominator had no reading of at all:
	 * it asked `projectionMember` with no axis, so a grid axis's one admission — an
	 * `Iteration`, drawn in the shared marker row — read as a row this projection does not
	 * draw, and the walk descended THROUGH it. Here that would drop `Sprint 12` off the
	 * shelf card's face and list its children instead.
	 *
	 * Asserted as the whole list, since the failure is a row missing rather than a row
	 * added: with the axis withheld, `Task X1` alone comes back.
	 */
	it('lists an iteration child on a grid axis, which is where the axis admits one', () => {
		const vault = datedVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 20 }, parentLink: 'Feature X' });
		const { containerEl } = makeRoadmap(vault, DATED_AXIS);
		const card = cardByTitle(containerEl, 'Feature X');
		disclosure(card)?.click();

		expect(kidTitles(card)).toEqual(['Task X1', 'Sprint 12']);
	});

	/**
	 * **The same origin question asked of `rowHidden`'s scaffold clause**, which is the
	 * OTHER reader of `drawsForestFrom` (`src/view/projection.ts`) and the one a paragraph
	 * stood in for until 2026-08-23.
	 *
	 * `Sprint 12` is left out of the Base, so it is a context row — and a grid axis admits
	 * an `Iteration` all the same (`projectionMember`), so it stays a listed child of
	 * `Feature X` only while something below it is visible. That question is asked with the
	 * ORIGIN's answer: `inPlan` refuses an `Iteration`, so the plan's forest promoted
	 * `Work` — stamped `focusRoot` — because its parent is not a member of it, and reading
	 * the stamp as this roadmap's own promotion empties the scaffold and takes `Sprint 12`
	 * off the face.
	 *
	 * Watched failing against exactly the projection-only answer this call site had before
	 * (`drawsForestFrom: () => projection !== 'iteration' && projection !== 'deliverables'`):
	 * `expected '1 task' to be '2 children'`. The LABEL and the list are both asserted
	 * because either alone is weaker — a mixed pair has no common name and degrades to
	 * `2 children`, so the label says the iteration is one of the two rather than only that
	 * two rows are listed. The `focusRoot` guard is the fixture's own: with no stamp on
	 * `Work` the stop could not fire either way and the test would pass for no reason.
	 */
	it('keeps an excluded iteration on the face while it places drawn work', () => {
		const vault = datedVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 20 }, parentLink: 'Feature X' });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Sprint 12' });
		const only = ['Dated epic.md', 'Feature X.md', 'Task X1.md', 'Work.md'];
		const { view, containerEl } = makeRoadmap(vault, DATED_AXIS, { only });

		expect(view.model?.byPath.get('Work.md')?.focusRoot).toBe(true);
		const card = cardByTitle(containerEl, 'Feature X');
		expect(disclosure(card)?.textContent).toBe('2 children');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Task X1', 'Sprint 12']);
	});

	/**
	 * **The same admission with the `Iteration` as the PARENT, which is the case the stop
	 * read backwards.** A grid axis draws an undated iteration as a shelf CARD, and that
	 * card is a row `projectionForest` never walked: `inPlan` refuses an `Iteration`, so
	 * the plan's forest promoted `Work` — stamped `focusRoot` — precisely BECAUSE its
	 * parent is not a member of it. Read as a promotion the roadmap itself had made, the
	 * stop dropped `Work` from the only face that lists it: no disclosure at all, and no
	 * children entry in the card's menu either.
	 *
	 * `drawsForestFrom` (`src/view/projection.ts`) asks the ORIGIN, so the answer is false
	 * here and true one row down the same walk. Nothing is collapsed first because nothing
	 * collapses it: `collapseNewParents` settles the rows of the model, and an iteration is
	 * in neither forest — so this card opens listed.
	 */
	it.each([
		['dates', (v: FakeVault) => makeRoadmap(v, DATED_AXIS)],
		['resources', (v: FakeVault) => laneRoadmap(v, {}, { shelf: true })],
	] as const)('lists the work under an undated iteration — %s axis', (_axis, mount) => {
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Work.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-09-01' },
			parentLink: 'Sprint 12',
		});
		const { containerEl } = mount(vault);
		const card = cardByTitle(containerEl, 'Sprint 12');

		expect(disclosure(card)?.textContent).toBe('1 pbi');
		expect(kidTitles(card)).toEqual(['Work']);
	});

	it('puts the disclosure on the line in list mode, and the list beneath it', () => {
		// A parent row costs no extra line at rest: the chevron and its count take a leading
		// fold slot, the tree's own idiom and the reason a tree row is one line whether or not
		// it has children. The LIST stays the card's own child, so it falls beneath the line
		// rather than sitting at the end of it — extension 3b, unchanged.
		const { containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false, shelfList: true });
		const card = cardByTitle(containerEl, 'Monthly statement');
		const summary = card.querySelector('.pbl-card-summary');
		expect(summary?.querySelector('.pbl-shelf-fold > .pbl-card-kids-toggle')).not.toBeNull();
		expect(summary?.querySelector('.pbl-card-kids-list')).toBeNull();
		expect(card.querySelector(':scope > .pbl-card-kids > .pbl-card-kids-list')).not.toBeNull();
	});

	it('draws no wrapper at all while the children are shut', () => {
		// Only the `<ul>` is hidden by `.pbl-card-kids-list:empty`; the box around it would still
		// spend its padding and one of the card's flex gaps, so a shut parent would stand taller
		// than a leaf — which this task's same-height requirement forbids. (Codex, PR #187.)
		const { view, containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false, shelfList: true });
		const path = 'Monthly statement.md';
		view.setCardCollapsed(path, true);
		const wrap = cardByTitle(containerEl, 'Monthly statement').querySelector('.pbl-card-kids');
		expect(wrap?.hasClass('pbl-card-kids-shut')).toBe(true);
	});

	it('reserves the fold slot on a row with no children, so the badges stay on one x', () => {
		const { containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false, shelfList: true });
		const leaf = cardByTitle(containerEl, 'Reconcile the ledger');
		const slot = leaf.querySelector('.pbl-card-summary > .pbl-shelf-fold');
		expect(slot).not.toBeNull();
		expect(slot?.childElementCount).toBe(0);
	});

	it('shows the count as a number on the line and keeps the sentence as the name', () => {
		// The slot has room for a number and not for a sentence, and the sentence is what the
		// list is NAMED by (`aria-labelledby` points at this toggle) — so it moves to the
		// toggle's own `aria-label` rather than being dropped. A reader who cannot see the
		// slot hears exactly what they heard before.
		const { containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false, shelfList: true });
		const toggle = cardByTitle(containerEl, 'Monthly statement').querySelector<HTMLElement>('.pbl-card-kids-toggle');
		expect(toggle?.querySelector('.pbl-card-kids-count')?.textContent).toBe('1');
		expect(toggle?.getAttribute('aria-label')).toBe('1 task');
	});

	it('leaves the card grid’s own disclosure exactly where it was', () => {
		// The card stacks, so its disclosure belongs in the wrapper with its list and nothing
		// about this feature is a reason to move it. No fold slot is drawn there at all.
		const { containerEl } = makeRoadmap(parentOnShelfVault(), {}, { shelfCollapsed: false });
		const card = cardByTitle(containerEl, 'Monthly statement');
		expect(card.querySelector('.pbl-shelf-fold')).toBeNull();
		expect(card.querySelector('.pbl-card-kids > .pbl-card-kids-toggle')).not.toBeNull();
	});
});
