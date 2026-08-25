// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, titlesOf, useViewHarness } from '../helpers/view';
import { makeRoadmap, shelfTitles } from '../helpers/roadmap';
import { BOARD_WORKFLOW, cardByTitle, cardTitles, makeBoard } from '../helpers/board';

useViewHarness();

/** The iteration board's own options — `iterationBoardCards.test.ts`'s `OPTIONS`. */
const SPRINT_BOARD = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
};

/**
 * Where a `Release` is a row, and where it is not — asked of the READERS rather than of
 * the filter, because every defect this file covers was a reader that never heard the
 * population had changed.
 *
 * **The rule was two clauses and is now one.** It used to read: no axis of the roadmap
 * places a release (`onThisRoadmap`, `domain/roadmap.ts`), and no projection draws a
 * release the Base EXCLUDED (`inPlan`, `domain/model.ts`). On 2026-08-24 `inPlan` began
 * refusing every release, excluded or not, so **a release is a row of no projection of this
 * view at all** — not the tree, not either board, not the roadmap. The release view draws
 * them, and reads `model.releases` rather than this forest, so nothing here reaches it.
 *
 * Every test names the READER rather than the filter. The readers this file reaches are the
 * toolbar's count, the roadmap's row source under a focus, a CARD's listed children and the
 * denominator its disclosure subtracts from, the tree's context row, and the empty state's
 * creation type. One more — the bucket header's `+`, whose type follows the same focus — is
 * asserted where it already lived, in `roadmapMoves.test.ts`; the tree's own three offering
 * surfaces are in `releaseTreeExit.test.ts`, which is where the type's exit from this view
 * is stated.
 *
 * The `describe` groups below do NOT stand one to one against that list, which is why no
 * total is written here: one group asks several readers, and the last is not a reader at
 * all — it is the shared DESCENT. The figure that stood here counted five, was one short
 * the day a sixth reader joined a group, and was two short by the commit after that.
 */

/** The count label's own text — the readout that has to agree with the advisory. */
function countText(containerEl: HTMLElement): string {
	return containerEl.querySelector<HTMLElement>('.pbl-count-label')?.textContent ?? '';
}

/** A vault holding one release and nothing else. */
function releaseOnly(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', order: 10 } });
	return vault;
}

describe('a release on the roadmap', () => {
	/**
	 * The toolbar counts what the projection can DRAW. A base holding one release draws
	 * no roadmap row at all, so the advisory says the roadmap is empty — and a count
	 * measured over `model.results` said there was one item in it, on the same screen.
	 */
	it('counts nothing where the roadmap draws nothing', () => {
		const { containerEl } = makeRoadmap(releaseOnly());

		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No backlog items');
		expect(countText(containerEl)).toBe('0 items');
	});

	/**
	 * A `Release` focus is a state the roadmap's own picker does not offer, so the
	 * roadmap does not honour it: the model is rebuilt unfocused on the way in.
	 *
	 * Without that, `roadmapRows` filtered the FOCUS ROOTS — `model.roots` is a forest
	 * where `model.results` is a flat walk, so the same one-line filter dropped a row in
	 * one branch and a root plus its whole subtree in the other. The hand-nested `PBI`
	 * below the release was drawn nowhere, while `eligibleResults` counted it, and the
	 * roadmap announced that all the work was done and hidden.
	 */
	it('ignores a focus it does not offer, and keeps the work under it', () => {
		const vault = releaseOnly();
		vault.addFile('Hand nested.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'R' });
		const { containerEl } = makeRoadmap(vault, {}, { focus: 'Release' });

		expect(shelfTitles(containerEl)).toEqual(['Hand nested']);
		// Nothing is hidden, so nothing may say so — that notice offers Show completed
		// items, which would not have brought the row back.
		expect(containerEl.querySelector('.pbl-empty-filter')).toBeNull();
		expect(countText(containerEl)).toBe('1 item');
	});

	/**
	 * **The clause in `projectionMember` is what every other roadmap reader inherits**, and
	 * this is the assertion under that sentence. `listedChildren` asks `isRowHidden`, which
	 * asks that predicate — so a release hand-hung under an epic is off the card's face for
	 * the same reason it is off the frame, rather than because anything here remembered it.
	 *
	 * The disclosure's LABEL is the reading, not the count: two children of different types
	 * have no common name and degrade to `2 children`, so the number and the type name move
	 * together and either alone would pass on the broken code.
	 */
	it('is no listed child on a card, which is where the shared predicate is felt', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 20 }, parentLink: 'Epic' });
		const { containerEl } = makeRoadmap(vault);

		const toggle = cardByTitle(containerEl, 'Epic').querySelector('.pbl-card-kids-toggle');
		expect(toggle?.textContent).toContain('1 pbi');
	});

	/**
	 * The empty state's creation type follows the focus, and the focus is what the
	 * projection honours — so a roadmap that honours no `Release` focus cannot offer
	 * `New Release` from it. The button used to create a note the same roadmap filtered
	 * out on the pass that made it, while the toolbar's own creator and the focus picker
	 * beside it were already withholding that type.
	 */
	it('offers no New Release from its empty state', () => {
		const { containerEl } = makeRoadmap(releaseOnly(), {}, { focus: 'Release' });

		expect(containerEl.querySelector('.pbl-empty button')?.textContent).toBe('New Epic');
	});
});

describe('a release the Base excluded', () => {
	/**
	 * `Releases as their own type` 4a: a filtered release appears as no row anywhere, a
	 * context row included. Its child still names it, so the edge stays — cutting it
	 * would strand the subtree from the rollup walk, which traverses THROUGH a row it
	 * does not count. The row goes; the child is promoted and keeps its place.
	 */
	it('is no context row in the tree, and its child stays', () => {
		const vault = new FakeVault();
		vault.addFile('Rel.md', { frontmatter: { type: 'Release', order: 10 } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Rel' });
		const { containerEl } = makeView(vault, {}, { only: ['Child.md'] });

		expect(titlesOf(containerEl)).toEqual(['Child']);
	});

	/**
	 * The same clause asked of a CARD's face, which is where `isRowUndrawn` is read. That
	 * question is MEMBERSHIP alone and a context row is not exempt from it: a release the
	 * Base excluded is a row of no projection, so the walk goes THROUGH it — and finds
	 * nothing to carry up, because `inPlan` refusing that release is exactly what made
	 * `projectionForest` promote `Deep` to a card of its own.
	 *
	 * **The reading that moves is the DENOMINATOR, not the list.** `isRowUndrawn` with
	 * `&& !item.outsideFilter` on it — "a context row is always drawn" — passes every other
	 * test in this repository, and it cannot change what the face LISTS: `listedChildren`
	 * subtracts `isRowHidden`, which refuses that release by its own first clause either
	 * way. What it changes is `drawn`, the count the disclosure's tooltip subtracts from,
	 * so the card claims one child is hidden by the current view when the view is hiding
	 * nothing — the shape `render/cardChildren.ts`'s own comment warns about, one
	 * membership question over.
	 *
	 * `Work` is the second child for that reason: with `1.0` the only one, the face lists
	 * nothing, no disclosure is drawn at all and there is no tooltip to be wrong.
	 */
	it('counts no hidden child for one, which is what the tooltip subtracts', () => {
		const vault = new FakeVault();
		vault.addFile('Ship it.md', { frontmatter: { type: 'Feature', order: 10, horizon: 'Now' } });
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10 }, parentLink: 'Ship it' });
		vault.addFile('Deep.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: '1.0' });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 20 }, parentLink: 'Ship it' });
		const { containerEl } = makeRoadmap(vault, {}, { only: ['Ship it.md', 'Deep.md', 'Work.md'] });

		const card = cardByTitle(containerEl, 'Ship it');
		const toggle = card.querySelector<HTMLElement>('.pbl-card-kids-toggle');
		expect(toggle?.textContent).toContain('1 pbi');
		expect(toggle?.dataset.tooltip).toBe('Show what is under "Ship it"');
	});
});

/**
 * **RETIRED 2026-08-24 — `a release row in the tree`, one test: "draws no horizon chip,
 * where an epic beside it draws one".**
 *
 * What it asserted: a release ROW in the tree drew the horizon column and no chip in it,
 * because `canPlaceHorizon` (`view/interactions/plan.ts`) refuses the type — a control
 * whose menu could only write a key the roadmap refuses to read.
 *
 * Why it no longer holds: there is no release row in the tree to draw a column on.
 * `inPlan` refuses one, so the fixture's `R.md` is not rendered and `rowByTitle` throws
 * before any assertion runs. Nothing about `canPlaceHorizon` changed and it was not
 * wrong — it lost its input.
 *
 * **What that costs, stated rather than left implied:** `canPlaceHorizon`'s release clause
 * and `computeHorizonWrites`' matching refusal now have no reachable caller in this view,
 * since both remaining callers of the first hold a ROW. The planner's half stays checked at
 * the pure level (`test/domain/writePlanAxis.test.ts`, "plans nothing for a release"); the
 * chip's half has no check under it any more, and cannot have one from here. Whether the
 * clause should go with the row is a decision, not an omission, and it is outside the
 * change that retired this test.
 */

/**
 * **A release BELOW a drawn row.** Until 2026-08-24 `inPlan` held an included release, so
 * `projectionForest` drew it and only the roadmap's own `onThisRoadmap` refused it — the
 * one input the shared DESCENT (`drawnDescent`, `view/rowVisibility.ts`) had on this
 * projection, and the reason four of this group's tests existed.
 *
 * `inPlan` refuses one now, so `projectionForest` PROMOTES the work below it instead and
 * there is nothing left for the walk to traverse through here. Four tests were retired for
 * that reason, each recorded below; one was rewritten onto the iteration board, which is
 * where an undrawn-but-drawn-by-the-forest row still exists; and one was replaced by the
 * assertion that the boards moved, which is the ruled change this increment made.
 */
describe('a release below a drawn row, which nothing traverses through any more', () => {
	/** The hand-written marker edge the plugin supports: `Feature -> Release -> PBI`. */
	function nestedUnderRelease(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Ship it.md', { frontmatter: { type: 'Feature', order: 10, horizon: 'Now' } });
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10 }, parentLink: 'Ship it' });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: '1.0' });
		return vault;
	}

	/** The disclosure's toggle, or null when the card drew none. */
	function disclosure(card: HTMLElement): HTMLButtonElement | null {
		return card.querySelector<HTMLButtonElement>('.pbl-card-kids-toggle');
	}

	function kidTitles(card: HTMLElement): string[] {
		return Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid-title')).map((el) => el.textContent ?? '');
	}

	/**
	 * **RETIRED 2026-08-24 — two tests: "lists the work below it on the card, and draws the
	 * release nowhere" and "names the same work in the card menu, which is the keyboard
	 * path".**
	 *
	 * What they asserted: under a `Feature` focus the roadmap drew one card, and the `PBI`
	 * hand-nested under a release appeared on that card's FACE (`listedChildren`) and in its
	 * menu (`menuChildren`) — the shared descent carrying work up through a row this
	 * projection does not draw, asked of both callers because the menu is the keyboard's
	 * only route to a face that holds `tabindex="-1"` buttons.
	 *
	 * Why they no longer hold: `inPlan` refuses the release, so `projectionForest` promotes
	 * `Work` to a root of the plan's own forest and the roadmap gives it a CARD. The frame
	 * is `['Work', 'Ship it']` rather than `['Ship it']`, and a promoted root is nobody's
	 * listed child — which is `drawnDescent`'s own stop working, not failing. The mechanism
	 * they covered is unchanged and still checked, on the projection that still has an
	 * undrawn-but-forested row: `iterationBoardCards.test.ts` ("lists a child of a loose
	 * child where that child is in the iteration") for the face, `cardChildren.test.ts`
	 * ("offers Open child only where the child has no card of its own") for the menu.
	 *
	 * The recursion half of the third one is NOT retired — it is rewritten below, because
	 * two undrawn levels in a row is a claim nothing else in the suite makes.
	 */

	/**
	 * **REWRITTEN 2026-08-24 from "carries on through a second release".** The walk is
	 * recursive, and a single-level descent passes every other test of it and fails here —
	 * a reader cannot tell the two implementations apart without this one.
	 *
	 * Two releases in a row were the fixture; the iteration board's out-of-sprint link is
	 * the same shape and is the one this view still has. Neither `Loose` names the sprint,
	 * so `projectionMember` refuses both, while `inPlan` holds both — so the forest promotes
	 * nothing and the walk has two levels to carry `Deep work` up through.
	 *
	 * The FRAME is the fixture guard, and it reads as it does because this board shelves
	 * work that names no sprint: both `Loose` rows are drawn as shelf cards, which is what
	 * says they are rows the walk went THROUGH rather than rows it listed. `1 task` is the
	 * label rather than a count, so it says both that one row is listed and which one.
	 */
	it('carries on through a second row the sprint does not draw', () => {
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Carrier.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
		});
		vault.addFile('Loose.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'Carrier' });
		vault.addFile('Loose too.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'Loose' });
		vault.addFile('Deep work.md', {
			frontmatter: { type: 'Task', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
			parentLink: 'Loose too',
		});
		const { view, containerEl } = makeView(vault, SPRINT_BOARD, { base: 'Plan.base' });
		view.setBoardScope('Sprint 12.md');

		const card = cardByTitle(containerEl, 'Carrier');
		expect(cardTitles(containerEl)).toEqual(['Loose', 'Loose too', 'Carrier', 'Deep work']);
		expect(disclosure(card)?.textContent).toContain('1 task');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Deep work']);
	});

	/**
	 * **REPLACES "leaves the board where it was: the release is the listed child there"
	 * (2026-08-24).** That test asserted the opposite of this one, and deliberately: the
	 * requirements board drew a release because `inPlan` held one, so the release WAS the
	 * listed child there and the `PBI` below it was not. It came from `Releases as their own
	 * type`, the increment that added the type, and it encoded that increment's decision
	 * rather than an accident.
	 *
	 * `Releases own their creation` overturns that decision by ruling: a release is a marker
	 * with a view of its own, `inPlan` already refuses `Iteration` — the other such marker —
	 * and so a release is now drawn by no projection of this view. The board moved. This
	 * asserts that it did, on the same fixture, so the reversal has a check rather than only
	 * a deletion.
	 */
	it('is on no board card either, which is the decision this increment reversed', () => {
		const { containerEl } = makeBoard(nestedUnderRelease());

		// The whole frame: the release has no card, and `Work` has one of its own because
		// the forest promoted it — which is also why the Feature's face lists nothing.
		expect(cardTitles(containerEl)).toEqual(['Ship it', 'Work']);
		expect(disclosure(cardByTitle(containerEl, 'Ship it'))).toBeNull();
	});

	/**
	 * **RETIRED 2026-08-24 — "keeps a context row placing work through it, and says nothing
	 * is hidden".**
	 *
	 * What it asserted: `rowHidden`'s own last clause — a context row is kept only while
	 * something below it is VISIBLE, and that question is the DRAWN DESCENT rather than
	 * `item.children`. A context `Epic` over an included release read the release as a child
	 * that is not visible, called itself an empty scaffold and went, taking the eligible
	 * `PBI` beneath it off a focused roadmap while `eligibleResults` went on counting it.
	 *
	 * Why it no longer holds: with `inPlan` refusing the release, `projectionForest` promotes
	 * `Work` to a root of the forest and the `Epic` is placing nothing — so the correct
	 * answer flips to "the scaffold goes", which is what the test immediately below already
	 * asserts on the same shape. Keeping both would be one claim twice.
	 *
	 * The clause itself is unchanged and still checked, on the projection that still has an
	 * undrawn-but-forested row to place work through: `iterationBoardCards.test.ts`, "draws
	 * the ancestor as a card of its own, beside the carrier below it", whose own header
	 * calls that board the second projection the scaffold clause reaches.
	 */

	/**
	 * **The other side of that scaffold, and the check under the reason for sharing the
	 * walk.** With the release itself excluded, `inPlan` refuses it in every projection, so
	 * `projectionForest` promotes `Work` to a root of the drawn forest — and a promoted root
	 * is nobody's listed child. The `Epic` above it is then placing nothing and goes with the
	 * scaffold rule, leaving `Work` as the only card.
	 *
	 * It is here because the naive descent — this walk without its stop — is what the
	 * commit's central claim is about, and nothing failed on it: the fixture one test up
	 * passes either way. Here the two answers differ, and the wrong one is visible as an
	 * empty context card beside the very row it claims to place.
	 */
	it('drops the scaffold where the work below it was promoted to a root', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: '1.0' });
		const { containerEl } = makeRoadmap(vault, {}, { focus: 'Epic', only: ['Work.md'] });

		expect(cardTitles(containerEl)).toEqual(['Work']);
	});

	/**
	 * **The completed toggle does not move.** `rowHidden` is true for three different
	 * reasons and this walk asks `isRowUndrawn`, which is the FIRST of them alone — a walk
	 * that descended through any hidden child would treat `Finished` as a row this
	 * projection does not draw.
	 *
	 * The list is the shape of the claim and the TOOLTIP is what can move, which is why
	 * both are asserted here. A hidden done subtree is done all the way down, so descending
	 * into one reaches nothing to draw and the face looks identical — but the DENOMINATOR
	 * comes off the same walk, so `Finished` stops being counted as a row the view is
	 * choosing to hide and the card silently stops saying so. Watched failing against
	 * exactly that mutation.
	 *
	 * `Open work` is in the same fixture on purpose: a fix that emptied the list entirely
	 * would pass an assertion that only said `Task` was absent.
	 */
	it('does not descend through a child the completed toggle hid', () => {
		const vault = new FakeVault();
		vault.addFile('Ship it.md', { frontmatter: { type: 'Feature', order: 10, horizon: 'Now', status: 'New' } });
		vault.addFile('Finished.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done' }, parentLink: 'Ship it' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10, status: 'Done' }, parentLink: 'Finished' });
		vault.addFile('Open work.md', { frontmatter: { type: 'PBI', order: 20, status: 'New' }, parentLink: 'Ship it' });
		const cfg = { ...BOARD_WORKFLOW, showCompleted: false };
		const { containerEl } = makeRoadmap(vault, cfg, { focus: 'Feature' });

		const card = cardByTitle(containerEl, 'Ship it');
		expect(disclosure(card)?.textContent).toContain('1 pbi');
		expect(disclosure(card)?.dataset.tooltip).toContain('1 more is hidden by the current view');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Open work']);
	});
});

/**
 * **The same descent, asked of the TREE** — the other projection whose rows ARE
 * `projectionForest`'s output, and the one `drawsForestFrom` (`src/view/projection.ts`)
 * had no check under until 2026-08-23.
 *
 * The fixture is the roadmap's promoted-scaffold case one describe up, rendered as a tree
 * instead: the excluded `1.0` is refused by `inPlan` in every projection, so `Work` is
 * promoted to a root of the forest the tree renders and the `Epic` above it is placing
 * nothing. Answering false for the tree draws that empty scaffold beside the very row it
 * claims to place.
 */
describe('the descent on the tree, which renders the same forest', () => {
	it('drops the scaffold where the work below it was promoted to a root', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: '1.0' });
		const { containerEl } = makeView(vault, {}, { focus: 'Epic', only: ['Work.md'] });

		expect(titlesOf(containerEl)).toEqual(['Work']);
	});
});
