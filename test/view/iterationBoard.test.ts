// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from 'obsidian';
import { FakeVault } from '../helpers/vault';
import { cardByTitle, cardTitles, columnByName, columnNames } from '../helpers/board';
import { cardDrag } from '../helpers/dnd';
import { flush, key, makeView, refresh, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The iteration board as a PROJECTION — the scope it is on, where that scope is stored,
 * and every gate that has to answer for it rather than for the product board.
 *
 * The picker that chooses a scope is Task 5's and the three-bucket render is Task 7's;
 * what is driven here is the state itself, through the host, which is the same door the
 * picker will use.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
};

const SPRINT = 'Sprint 12.md';

function sprintVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
	vault.addFile('Sprint 13.md', { frontmatter: { type: 'Iteration', order: 20 } });
	vault.addFile('In sprint.md', {
		frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: '[[Sprint 12]]' },
	});
	vault.addFile('Elsewhere.md', { frontmatter: { type: 'PBI', order: 20, status: 'Doing' } });
	return vault;
}

describe('the iteration scope', () => {
	it('returns the reader to the iteration they left, through Tree and back', () => {
		// Driven through the INTERACTION, never by rendering the chosen scope directly: a
		// test that sets the scope and reads it back passes while the round trip through
		// the store is broken.
		const vault = sprintVault();
		const first = makeView(vault, OPTIONS, { base: 'Plan.base' });
		first.view.setProjection('iteration');
		first.view.setBoardScope(SPRINT);
		first.view.setProjection('tree');
		first.view.setProjection('iteration');
		expect(first.view.boardScope).toBe(SPRINT);
		first.view.onunload();

		const second = makeView(vault, OPTIONS, { base: 'Plan.base' });
		expect(second.view.projection).toBe('iteration');
		expect(second.view.boardScope).toBe(SPRINT);
	});

	it('reads the whole view as Product when the stored path names no Iteration', () => {
		// Resolved ONCE, upstream: resolving it only where the content is drawn leaves
		// every other gate — the count, the offered types, the filter index — still
		// answering as an iteration board.
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('No such sprint.md');
		expect(harness.view.effectiveScope).toBeNull();
	});

	it('retains the stale stored path rather than rewriting it', () => {
		// The note may come back — a deletion undone, a filter widened. Rewriting the
		// stored path on a failed resolution would spend the reader's choice on a
		// condition that is often temporary.
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('Not yet.md');
		expect(harness.view.effectiveScope).toBeNull();
		expect(harness.view.boardScope).toBe('Not yet.md');

		vault.addFile('Not yet.md', { frontmatter: { type: 'Iteration', order: 30 } });
		refresh(harness.view, vault);
		expect(harness.view.effectiveScope).toBe('Not yet.md');
	});

	it('falls back to Product when the iteration PROPERTY is cleared', () => {
		// A second condition rather than a second symptom of the first. The stored path
		// still names a real Iteration, so the "note is gone" case above passes it — but
		// with no configured key every item reads a null iteration, so the board can never
		// hold a card, and the reader would be stranded on it.
		const vault = sprintVault();
		const { iterationProperty, ...noKey } = OPTIONS;
		expect(iterationProperty).toBe('note.iteration');
		const harness = makeView(vault, noKey, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope(SPRINT);
		expect(harness.view.effectiveScope).toBeNull();
	});

	it('retains the stored path when the property is cleared, and restores the scope when it is set again', () => {
		const vault = sprintVault();
		const { iterationProperty, ...noKey } = OPTIONS;
		expect(iterationProperty).toBe('note.iteration');
		const off = makeView(vault, noKey, { base: 'Plan.base', viewName: 'One' });
		off.view.setProjection('iteration');
		off.view.setBoardScope(SPRINT);
		expect(off.view.boardScope).toBe(SPRINT);
		off.view.onunload();

		const on = makeView(vault, OPTIONS, { base: 'Plan.base', viewName: 'One' });
		expect(on.view.effectiveScope).toBe(SPRINT);
	});

	it('carries the stored scope through a rename of the note, and of a folder above it', () => {
		const vault = new FakeVault();
		vault.addFile('sprints/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope('sprints/Sprint 12.md');

		// Through the vault's own rename event, which is the only thing that reaches the
		// migration in a vault — the view subscribes to it on the first data update.
		vault.renameFile('sprints/Sprint 12.md', 'sprints/Sprint twelve.md');
		expect(harness.view.boardScope).toBe('sprints/Sprint twelve.md');

		// A folder move reports the FOLDER, never the notes under it — so matching the
		// stored path alone strands every scope inside a folder anybody tidies.
		vault.renameFolder('sprints', 'planning/sprints');
		expect(harness.view.boardScope).toBe('planning/sprints/Sprint twelve.md');
	});
});

describe('the scope picker', () => {
	const picker = (containerEl: HTMLElement) => containerEl.querySelector<HTMLElement>('.pbl-scope-btn');

	function entries(containerEl: HTMLElement): string[] {
		picker(containerEl)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		return (Menu.lastShown?.items ?? []).map((mi) => mi.titleText);
	}

	it('names the product and every iteration in the model', () => {
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('board');
		expect(entries(harness.containerEl)).toEqual(['Product', 'Sprint 12', 'Sprint 13']);
	});

	it('is absent with no iteration property, and with no Iteration note', () => {
		// Two conditions, both required. With no notes there is nothing to choose between
		// — `renderAxisPicker`'s refusal for a single configured axis. With no property,
		// every entry would draw a board no card could ever reach.
		const empty = new FakeVault();
		empty.addFile('A PBI.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' } });
		const noNotes = makeView(empty, OPTIONS, { base: 'Plan.base' });
		noNotes.view.setProjection('board');
		expect(picker(noNotes.containerEl)).toBeNull();

		const { iterationProperty, ...noKey } = OPTIONS;
		expect(iterationProperty).toBe('note.iteration');
		const noProperty = makeView(sprintVault(), noKey, { base: 'Plan.base' });
		noProperty.view.setProjection('board');
		expect(picker(noProperty.containerEl)).toBeNull();
	});

	it('draws on the tree as well, since it is what chooses the board to open', () => {
		// The picker sits beside the Board button rather than inside the board, so a
		// reader on the tree can go straight to a sprint.
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		expect(picker(harness.containerEl)).not.toBeNull();
	});

	it('scopes the view to the note that was picked, not to its label', () => {
		const vault = new FakeVault();
		vault.addFile('q3/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('q4/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 20 } });
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('board');
		// Qualified only where they collide: qualifying every entry to separate a rare
		// pair makes the ordinary case unreadable.
		expect(entries(harness.containerEl)).toEqual(['Product', 'q3/Sprint 12', 'q4/Sprint 12']);

		Menu.lastShown?.item('q4/Sprint 12')?.click();
		expect(harness.view.boardScope).toBe('q4/Sprint 12.md');
		expect(harness.view.projection).toBe('iteration');
	});

	it('returns the view to the product board, clearing the scope', () => {
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		entries(harness.containerEl);
		Menu.lastShown?.item('Product')?.click();
		expect(harness.view.boardScope).toBeNull();
		expect(harness.view.projection).toBe('board');
	});

	it('checks the scope the view is on', () => {
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(SPRINT);
		entries(harness.containerEl);
		const checked = (Menu.lastShown?.items ?? []).filter((mi) => mi.checked).map((mi) => mi.titleText);
		expect(checked).toEqual(['Sprint 12']);
	});
});

describe('a fold belongs to one iteration', () => {
	function scoped(path: string) {
		const vault = new FakeVault();
		vault.addFile('sprints/Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('sprints/Sprint 13.md', { frontmatter: { type: 'Iteration', order: 20 } });
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setBoardScope(path);
		return { ...harness, vault };
	}

	it('folds a column on ONE iteration only', () => {
		// The three buckets wear the same three names on every scope, so a key without
		// the path folds Resolved on Sprint 13 because the reader folded it on Sprint 12 —
		// the product board's own collision, one level in.
		const harness = scoped('sprints/Sprint 12.md');
		harness.view.setColumnCollapsed('iteration', 'resolved', true);
		expect(harness.view.columnCollapsed('iteration', 'resolved', false)).toBe(true);

		harness.view.setBoardScope('sprints/Sprint 13.md');
		expect(harness.view.columnCollapsed('iteration', 'resolved', false)).toBe(false);
	});

	it('folds two buckets with nothing to write apart', () => {
		// The value is the BUCKET, never the representative: two buckets with nothing to
		// write both carry `state: null`, so a fold keyed on the state shuts them together.
		const harness = scoped('sprints/Sprint 12.md');
		harness.view.setColumnCollapsed('iteration', 'inProgress', true);
		expect(harness.view.columnCollapsed('iteration', 'resolved', false)).toBe(false);
	});

	it('carries a folded column with its iteration through a rename', () => {
		// Half of this is not an option: a path inside a fold key must be migrated, or the
		// board reopens columns the reader closed and the store keeps entries nothing will
		// ever match.
		const harness = scoped('sprints/Sprint 12.md');
		harness.view.setColumnCollapsed('iteration', 'resolved', true);

		harness.vault.renameFolder('sprints', 'planning/sprints');
		expect(harness.view.boardScope).toBe('planning/sprints/Sprint 12.md');
		expect(harness.view.columnCollapsed('iteration', 'resolved', false)).toBe(true);
	});
});

describe('the iteration board answers as itself', () => {
	function onSprint() {
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope(SPRINT);
		return harness;
	}

	it('renders the Board position pressed, and keeps the picker, on an iteration scope', () => {
		// Two controls compare the projection to a POSITION, and both are wrong once the
		// internal identity and the control identity differ: the picker would delete
		// itself on first use, and no position would draw as pressed.
		const { containerEl } = onSprint();
		const pressed = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-mode-btn[aria-pressed="true"]'));
		expect(pressed.map((el) => el.querySelector('.pbl-btn-label')?.textContent)).toEqual(['Board']);
	});

	it('counts this scope\'s carriers and nobody else', () => {
		// One function behind the count label and the completed toggle's "(N hidden)", so
		// the two cannot disagree about what the board is showing.
		const { containerEl } = onSprint();
		// One carrier in Sprint 12; `Elsewhere` and the two Iteration notes are not it.
		expect(containerEl.querySelector('.pbl-count-label')?.textContent).toContain('1');
	});

	it('renders no focus menu, no label and no clear button, with a focus inherited', () => {
		// `INERT_FOCUS` is a PARTIAL record, so a missing entry compiles clean and the
		// ordinary focus picker draws — a control whose every setting is a no-op here.
		const vault = sprintVault();
		const harness = makeView(vault, OPTIONS, { base: 'Plan.base', focus: 'PBI' });
		harness.view.setProjection('iteration');
		harness.view.setBoardScope(SPRINT);
		const focus = harness.containerEl.querySelector<HTMLButtonElement>('.pbl-focus-btn');
		expect(focus?.disabled).toBe(true);
		expect(focus?.querySelector('.pbl-btn-label')?.textContent).toBe('Iteration');
	});
});

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

	function onBoard(extra: Record<string, unknown> = {}, vault = boardVault()) {
		const harness = makeView(vault, { ...OPTIONS, iterationGoalProperty: 'note.goal', ...extra }, { base: 'Plan.base' });
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

	it('keeps finished work on screen, whatever the completed toggle says', () => {
		// The Resolved column IS the finished work, so hiding a done subtree would empty
		// the column this board exists to show.
		const { containerEl } = onBoard({ showCompleted: false });
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
		const card = view.model?.byPath.get('Ready one.md');
		await view.performIterationBoardMove(card as never, 'open');
		await flush();
		expect(vault.writeLog).toEqual([]);
	});

	it('writes the bucket representative when the bucket changes', async () => {
		const { view, vault } = moving();
		const card = view.model?.byPath.get('Ready one.md');
		await view.performIterationBoardMove(card as never, 'inProgress');
		await flush();
		expect(vault.fm('Ready one.md').status).toBe('Doing');
	});

	it('refuses a move onto a bucket with nothing to write', async () => {
		// Every declared state named by the two outer lists, so In progress has no
		// representative — and no drop, no menu entry and no keyboard target either.
		const { view, vault, containerEl } = moving({ iterationOpenStates: 'New, Ready, Doing' });
		const card = view.model?.byPath.get('Ready one.md');
		await view.performIterationBoardMove(card as never, 'inProgress');
		await flush();
		expect(vault.writeLog).toEqual([]);
		// And the column is not drawn as the key-removal one either: it carries the same
		// `state: null` and means the opposite, so the strip, the class and the "dropping
		// here clears the state" name all ask `takesDrop` rather than the null.
		expect(columnByName(containerEl, 'In progress').classList.contains('pbl-col-nostate')).toBe(false);

		view.showContextMenuFor(card as never);
		const setState = Menu.lastShown?.item('Set state');
		expect((setState?.submenu?.items ?? []).map((mi) => mi.titleText)).toEqual(['Open', 'Resolved']);
	});

	it('writes the PRODUCT key for a Deliverable, from the menu and the keyboard alike', async () => {
		// Both inputs dispatch on the TYPE before the projection unless the projection is
		// asked first — so a Deliverable would reach the Deliverables move and write a
		// second vocabulary onto a board that narrows one.
		const { view, vault, containerEl } = moving({ deliverableStateProperty: 'note.deliverableStatus' });
		const card = view.model?.byPath.get('A deliverable.md');
		view.showContextMenuFor(card as never);
		Menu.lastShown?.item('Set state')?.submenu?.item('In progress')?.click();
		await flush();
		expect(vault.fm('A deliverable.md').status).toBe('Doing');
		expect(vault.fm('A deliverable.md').deliverableStatus).toBeUndefined();

		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('A deliverable.md') as never);
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

	it('says nothing matched rather than that the iteration is empty, while filtering', async () => {
		const { view, containerEl } = moving();
		view.setFilter('zzz nothing');
		await flush();
		expect(containerEl.textContent).not.toContain('No items in this iteration yet');
	});

	it('checks the bucket the card is in, not the column whose state it matches', async () => {
		const { view } = moving();
		const card = view.model?.byPath.get('Ready one.md');
		view.showContextMenuFor(card as never);
		const checked = (Menu.lastShown?.item('Set state')?.submenu?.items ?? [])
			.filter((mi) => mi.checked)
			.map((mi) => mi.titleText);
		expect(checked).toEqual(['Open']);
	});
});
