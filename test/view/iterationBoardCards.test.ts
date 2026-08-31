// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { cardByTitle, cardTitles, columnByName, columnNames } from '../helpers/board';
import { cardDrag } from '../helpers/dnd';
import { flush, itemAt, key, makeView, submitPrompt, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * What an iteration board DRAWS and what its three inputs write — the columns, the goal
 * line, both empty states, one move per input, and a card created into the scope.
 *
 * Split from `iterationBoard.test.ts` at its line budget: that file is the scope, its
 * store and the gates that answer for it; this one is the board itself.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
};

const SPRINT = 'Sprint 12.md';

describe('the three-bucket board', () => {
	const OPEN = 'Open';
	const RESOLVED = 'Resolved';

	function boardVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10, goal: 'Ship the importer' } });
		vault.addFile('Ready one.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
		});
		vault.addFile('Working.md', {
			frontmatter: { type: 'PBI', order: 20, status: 'Doing', iteration: '[[Sprint 12]]' },
		});
		vault.addFile('Finished.md', {
			frontmatter: { type: 'PBI', order: 30, status: 'Done', iteration: '[[Sprint 12]]' },
		});
		vault.addFile('Not in it.md', { frontmatter: { type: 'PBI', order: 40, status: 'New' } });
		return vault;
	}

	function onBoard(
		extra: Record<string, unknown> = {},
		vault = boardVault(),
		{ hideCompleted }: { hideCompleted?: boolean } = {},
	) {
		const harness = makeView(
			vault,
			{ ...OPTIONS, iterationGoalProperty: 'note.goal', ...extra },
			{ base: 'Plan.base', hideCompleted },
		);
		harness.view.setBoardScope(SPRINT);
		return { ...harness, vault };
	}

	it('draws three columns over the product workflow, holding this iteration only', () => {
		const { containerEl } = onBoard();
		expect(columnNames(containerEl)).toEqual([OPEN, 'In progress', RESOLVED]);
		expect(cardTitles(columnByName(containerEl, OPEN))).toEqual(['Ready one']);
		expect(cardTitles(columnByName(containerEl, 'In progress'))).toEqual(['Working']);
		expect(cardTitles(columnByName(containerEl, RESOLVED))).toEqual(['Finished']);
	});

	it('lists no child on a card unless the child is in the iteration too', () => {
		// Nothing is inherited down the tree, and that rule has to hold at the one surface
		// that does not go through `iterationResults`: a carrier's card lists its children
		// on its face. With the plan's own membership, a child naming no iteration — or
		// naming another — was listed there. Found by review (Codex, PR #154).
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Sprint 13.md', { frontmatter: { type: 'Iteration', order: 20 } });
		vault.addFile('Carrier.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
		});
		vault.addFile('In sprint too.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
			parentLink: 'Carrier',
		});
		vault.addFile('Loose child.md', {
			frontmatter: { type: 'PBI', order: 20, status: 'New' },
			parentLink: 'Carrier',
		});
		vault.addFile('Other sprint child.md', {
			frontmatter: { type: 'PBI', order: 30, status: 'New', iteration: '[[Sprint 13]]' },
			parentLink: 'Carrier',
		});
		// A child retyped to a MARKER keeps its parent and its link. The population refuses
		// it a card; membership has to refuse it too, or it is listed on its parent's face
		// and its title can keep that parent on screen through a filter match. One rule,
		// one statement (`inIteration`) — this was reported twice before it was shared.
		vault.addFile('Retyped marker.md', {
			frontmatter: { type: 'Milestone', order: 40, iteration: '[[Sprint 12]]' },
			parentLink: 'Carrier',
		});
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		const card = cardByTitle(harness.containerEl, 'Carrier');
		// The list draws behind the card's own disclosure, which starts shut.
		card.querySelector<HTMLElement>('.pbl-card-kids-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const listed = Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid-title')).map((el) => el.textContent);
		expect(listed).toEqual(['In sprint too']);
		// And the count on the disclosure counts the same one.
		expect(card.querySelector('.pbl-card-kids-count')?.textContent).toContain('1');
	});

	/**
	 * The other side of the rule above, and the reach of the walk that traverses through a
	 * row this projection does not draw. `Loose child` names no sprint, so the board draws
	 * no card for it and does not list it — unchanged. `Deep work` below it names THIS
	 * sprint on its own merit, so it is a row this board draws whose nearest DRAWN ancestor
	 * is the carrier, and the carrier's face is where it belongs.
	 *
	 * Nothing is inherited either way: membership is still asked of each note, and the
	 * loose row between them is passed through rather than promoted onto the face. The
	 * list is asserted whole, so a walk that carried `Loose child` up as well fails here.
	 */
	it('lists a child of a loose child where that child is in the iteration', () => {
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Carrier.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
		});
		vault.addFile('Loose child.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' }, parentLink: 'Carrier' });
		vault.addFile('Deep work.md', {
			frontmatter: { type: 'Task', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
			parentLink: 'Loose child',
		});
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		const card = cardByTitle(harness.containerEl, 'Carrier');
		card.querySelector<HTMLElement>('.pbl-card-kids-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const listed = Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid-title')).map((el) => el.textContent);
		expect(listed).toEqual(['Deep work']);
	});

	it('draws an empty Open as a column, not as the no-state drop strip', () => {
		// The DEFAULT configuration reaches this: with `iterationOpenStates` unset, Open's
		// representative is the key removal — a `state: null` that takes a drop — so with
		// nothing unstarted, every term of the product board's empty-no-state test was
		// true of it, and one of three promised columns drew as a nameless 44px sliver
		// labelled "dropping here clears the state". These three are named stages drawn
		// structurally, so no bucket is ever that strip.
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Working.md', {
			frontmatter: { type: 'PBI', order: 20, status: 'Doing', iteration: '[[Sprint 12]]' },
		});
		const { containerEl } = onBoard({ iterationOpenStates: '' }, vault);
		const open = columnByName(containerEl, OPEN);
		expect(open.classList.contains('pbl-board-strip')).toBe(false);
		// The header keeps what the strip withholds: its count and its disclosure.
		expect(open.querySelector('.pbl-board-col-count')).not.toBeNull();
		expect(open.querySelector('.pbl-chevron')).not.toBeNull();
	});

	it('keeps finished work on screen, whatever the completed toggle says', () => {
		// The Resolved column IS the finished work, so hiding a done subtree would empty
		// the column this board exists to show.
		const { containerEl } = onBoard({}, undefined, { hideCompleted: true });
		expect(cardTitles(columnByName(containerEl, RESOLVED))).toEqual(['Finished']);
	});

	it('draws the goal above the columns, as text and not a control', () => {
		const { containerEl } = onBoard();
		const goal = containerEl.querySelector<HTMLElement>('.pbl-iteration-goal');
		expect(goal?.textContent).toBe('Ship the importer');
		expect(goal?.querySelector('button, a, input, [tabindex]')).toBeNull();
	});

	it('draws no goal line when there is no goal, and none on Product', () => {
		const noGoal = new FakeVault();
		noGoal.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		expect(onBoard({}, noGoal).containerEl.querySelector('.pbl-iteration-goal')).toBeNull();

		const product = onBoard();
		product.view.setBoardScope(null);
		expect(product.containerEl.querySelector('.pbl-iteration-goal')).toBeNull();
	});

	it('says the iteration is empty rather than that everything is done', () => {
		// Never the product board's "All N items are done and hidden", which cannot tell an
		// empty base from an empty scope.
		const empty = new FakeVault();
		empty.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		empty.addFile('Elsewhere.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' } });
		const { containerEl } = onBoard({}, empty);
		expect(containerEl.textContent).toContain('No items in this iteration yet');
	});

	it('offers the product board’s workflow guidance with no state property', () => {
		const vault = boardVault();
		const { stateProperty, ...noWorkflow } = OPTIONS;
		expect(stateProperty).toBe('note.status');
		const harness = makeView(vault, noWorkflow, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		expect(harness.containerEl.querySelector('.pbl-board-col')).toBeNull();
	});
});

/**
 * The context-row rule on this board, which is the second projection the scaffold clause
 * reaches. An excluded ancestor is drawn only while it is placing work that is on this
 * screen, and "on this screen" is the DRAWN DESCENT: a result carrying no link to this
 * sprint is a row this board does not draw, so the walk goes through it to the carrier
 * below.
 *
 * Asked here as well as on the roadmap because the change arrives differently: on the
 * roadmap it brought a context card BACK that the clause had wrongly dropped, and here it
 * adds one that never appeared, on a board where nothing was ever lost. Correct by the
 * context-row rule — the ancestor is what places the card — and unnamed until this test.
 */
describe('a context row placing work through a row the sprint does not draw', () => {
	it('draws the ancestor as a card of its own, beside the carrier below it', () => {
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('Story.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'New' },
			parentLink: 'Epic',
		});
		vault.addFile('Job.md', {
			frontmatter: { type: 'Task', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
			parentLink: 'Story',
		});
		const { view, containerEl } = makeView(vault, OPTIONS, {
			base: 'Plan.base',
			only: [SPRINT, 'Story.md', 'Job.md'],
		});
		view.setBoardScope(SPRINT);

		// The whole frame, in the order it is drawn: `Story` is a SHELF card — the work in no
		// iteration — and is on no column either way, so the walk through it to `Job` is the
		// whole of what puts `Epic` among the columns. It read `Story` as a child that is not
		// visible before 2026-08-22 and drew no `Epic` at all.
		expect(cardTitles(containerEl)).toEqual(['Story', 'Job', 'Epic']);
	});

	/**
	 * **The scaffold clause's own focus-root term, on a board that promotes nothing.** The
	 * walk `rowHidden` runs to decide whether this `Epic` is still placing anything takes
	 * the same stop the card faces take, and it must answer FALSE here for the reason
	 * `drawsForestFrom` (`src/view/projection.ts`) states: this board's population is
	 * `iterationResults` over `realRoots`, so a `focusRoot` stamp on a row it draws was
	 * made by the plan's forest and says nothing about this screen.
	 *
	 * `Rel` is an excluded `Release`, which `inPlan` refuses in every projection — so
	 * `projectionForest` stamped `Job` when it built the plan's forest, and this board drew
	 * neither the release nor a root. Passing `true` for the stop here reads that stamp as
	 * its own: `Epic` calls itself an empty scaffold and goes, while `Job` — the one card
	 * the ancestor is placing — stays on the board with nothing above it.
	 */
	it('keeps the ancestor where the plan promoted the card below it', () => {
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('Rel.md', { frontmatter: { type: 'Release', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Job.md', {
			frontmatter: { type: 'Task', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
			parentLink: 'Rel',
		});
		const { view, containerEl } = makeView(vault, OPTIONS, { base: 'Plan.base', only: [SPRINT, 'Job.md'] });
		view.setBoardScope(SPRINT);

		expect(cardTitles(containerEl)).toEqual(['Job', 'Epic']);
	});
});

describe('one move, three inputs, all through the bucket', () => {
	function movingVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		// `Ready` and `New` both read as Open, which is the whole point: a move planned
		// from the column's STATE would rewrite one as the other.
		vault.addFile('Ready one.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'Ready', iteration: '[[Sprint 12]]' },
		});
		vault.addFile('A deliverable.md', {
			frontmatter: { type: 'Deliverable', order: 20, status: 'New', iteration: '[[Sprint 12]]' },
		});
		return vault;
	}

	function moving(extra: Record<string, unknown> = {}) {
		const vault = movingVault();
		const harness = makeView(
			vault,
			{ ...OPTIONS, stateValues: 'New, Ready, Doing, Done', iterationOpenStates: 'New, Ready', ...extra },
			{ base: 'Plan.base' },
		);
		harness.view.setBoardScope(SPRINT);
		return { ...harness, vault };
	}

	it('writes nothing when the card is already in the target bucket', async () => {
		const { view, vault } = moving();
		const card = itemAt(view, 'Ready one.md');
		await view.performIterationBoardMove(card, 'open');
		await flush();
		expect(vault.writeLog).toEqual([]);
	});

	it('writes the bucket representative when the bucket changes', async () => {
		const { view, vault } = moving();
		const card = itemAt(view, 'Ready one.md');
		await view.performIterationBoardMove(card, 'inProgress');
		await flush();
		expect(vault.fm('Ready one.md').status).toBe('Doing');
	});

	it('refuses a move onto a bucket with nothing to write', async () => {
		// Every declared state named by the two outer lists, so In progress has no
		// representative — and no drop, no menu entry and no keyboard target either.
		const { view, vault, containerEl } = moving({ iterationOpenStates: 'New, Ready, Doing' });
		const card = itemAt(view, 'Ready one.md');
		await view.performIterationBoardMove(card, 'inProgress');
		await flush();
		expect(vault.writeLog).toEqual([]);
		// And the column is not drawn as the key-removal one either: it carries the same
		// `state: null` and means the opposite, so the strip, the class and the "dropping
		// here clears the state" name all ask `takesDrop` rather than the null.
		expect(columnByName(containerEl, 'In progress').classList.contains('pbl-col-nostate')).toBe(false);

		view.showContextMenuFor(card);
		const setState = Menu.lastShown?.item('Set state');
		expect((setState?.submenu?.items ?? []).map((mi) => mi.titleText)).toEqual(['Open', 'Resolved']);
	});

	it('writes the PRODUCT key for a Deliverable, from the menu and the keyboard alike', async () => {
		// Both inputs dispatch on the TYPE before the projection unless the projection is
		// asked first — so a Deliverable would reach the Deliverables move and write a
		// second vocabulary onto a board that narrows one.
		const { view, vault, containerEl } = moving({ deliverableStateProperty: 'note.deliverableStatus' });
		const card = itemAt(view, 'A deliverable.md');
		view.showContextMenuFor(card);
		Menu.lastShown?.item('Set state')?.submenu?.item('In progress')?.click();
		await flush();
		expect(vault.fm('A deliverable.md').status).toBe('Doing');
		expect(vault.fm('A deliverable.md').deliverableStatus).toBeUndefined();

		const tree = treeOf(containerEl);
		view.selectItem(itemAt(view, 'A deliverable.md'));
		key(tree, 'ArrowRight', { altKey: true });
		await flush();
		expect(vault.fm('A deliverable.md').status).toBe('Doing');
		expect(vault.fm('A deliverable.md').deliverableStatus).toBeUndefined();
	});

	// What DISTINGUISHES the keyboard's routing is the Deliverable above, and only that:
	// for every other card, `performBoardMove(card, col.state)` and the bucket move plan
	// the same write, because three buckets over three columns make the representative and
	// the column's state the same string. A test asserting the no-op case cannot reach it
	// either — the card sits in the first column, where the edge guard returns before any
	// routing runs. So the claim is narrow and stated as such: the keyboard reaches the
	// bucket method, proven where the two routes write different KEYS.

	it('writes the bucket a card is DROPPED on, and refuses the bucket with nothing to write', async () => {
		// The third input. A drop carries the COLUMN rather than its state, which is what
		// lets a bucket be moved to at all — two of them can hold `state: null`.
		const { vault, containerEl } = moving();
		cardDrag(cardByTitle(containerEl, 'Ready one'), columnByName(containerEl, 'In progress'));
		await flush();
		expect(vault.fm('Ready one.md').status).toBe('Doing');

		// And an unwritable bucket is not wired as a target at all — the refusal is at the
		// gesture rather than after it.
		const claimed = moving({ iterationOpenStates: 'New, Ready, Doing' });
		cardDrag(cardByTitle(claimed.containerEl, 'Ready one'), columnByName(claimed.containerEl, 'In progress'));
		await flush();
		expect(claimed.vault.writeLog).toEqual([]);
	});

	it('checks the bucket the card is in, not the column whose state it matches', async () => {
		const { view } = moving();
		const card = itemAt(view, 'Ready one.md');
		view.showContextMenuFor(card);
		const checked = (Menu.lastShown?.item('Set state')?.submenu?.items ?? [])
			.filter((mi) => mi.checked)
			.map((mi) => mi.titleText);
		expect(checked).toEqual(['Open']);
	});
});

describe('creating a card on an iteration board', () => {
	function creatingVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile(SPRINT, {
			frontmatter: { type: 'Iteration', order: 10, start: '2026-09-07', due: '2026-09-18' },
		});
		vault.addFile('Existing.md', {
			frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
		});
		return vault;
	}

	// No type folders, so a new note lands where the test can name it.
	const DATED = {
		...OPTIONS,
		startProperty: 'note.start',
		targetProperty: 'note.due',
		homeFolder: '',
		'typeFolder.pbi': '',
		'typeFolder.epic': '',
	};

	async function createOn(harness: { containerEl: HTMLElement }, title = 'New work'): Promise<void> {
		harness.containerEl
			.querySelector<HTMLElement>('.pbl-new-btn')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title });
		await flush();
	}

	it('creates a card into the iteration the board is scoped to, dates and all', async () => {
		// One create, never a create then a write: a note that existed for one pass
		// without the iteration it was made on is a card the very next refresh deletes
		// from the board that made it.
		const vault = creatingVault();
		const harness = makeView(vault, DATED, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		await createOn(harness);
		expect(vault.fm('New work.md')).toEqual({
			'pbl-id': expect.any(Number),
			// Whatever type the primary button makes — the claim is the three keys below it,
			// which is what puts the card on the board that made it.
			type: expect.any(String),
			order: expect.any(Number),
			iteration: '[[Sprint 12]]',
			start: '2026-09-07',
			due: '2026-09-18',
		});
		// And no second write behind it — `writeLog` records `processFrontMatter` alone,
		// which a create never goes through.
		expect(vault.writeLog).toEqual([]);
	});

	it('writes no iteration and no dates on the product board', async () => {
		const vault = creatingVault();
		const harness = makeView(vault, DATED, { base: 'Plan.base' });
		await createOn(harness);
		expect(vault.fm('New work.md').iteration).toBeUndefined();
		expect(vault.fm('New work.md').start).toBeUndefined();
	});

	it('writes nothing unconfigured — no iteration key, no link; no date keys, no dates', async () => {
		const { startProperty, targetProperty, ...noDates } = DATED;
		expect([startProperty, targetProperty]).toEqual(['note.start', 'note.due']);
		const noDateVault = creatingVault();
		const dateless = makeView(noDateVault, noDates, { base: 'Plan.base' });
		dateless.view.setBoardScope(SPRINT);
		await createOn(dateless);
		expect(noDateVault.fm('New work.md').iteration).toBe('[[Sprint 12]]');
		expect(noDateVault.fm('New work.md').start).toBeUndefined();

		const { iterationProperty, ...noKey } = DATED;
		expect(iterationProperty).toBe('note.iteration');
		const keylessVault = creatingVault();
		const keyless = makeView(keylessVault, noKey, { base: 'Plan.base' });
		keyless.view.setBoardScope(SPRINT);
		await createOn(keyless);
		expect(keylessVault.fm('New work.md').iteration).toBeUndefined();
	});

	it('spells the link from the NEW note’s own path', async () => {
		// Two iterations sharing a basename still get distinct links, generated from a
		// path that did not exist when the board was drawn.
		const vault = new FakeVault();
		vault.addFile('q3/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('q4/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 20 } });
		const harness = makeView(vault, { ...DATED, homeFolder: 'q4' }, { base: 'Plan.base' });
		harness.view.setBoardScope('q4/Sprint 12.md');
		await createOn(harness);
		expect(vault.fm('q4/New work.md').iteration).toBe('[[q4/Sprint 12]]');
	});
});
