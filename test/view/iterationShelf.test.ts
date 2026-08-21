// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { cardDrag } from '../helpers/dnd';
import { cardByTitle, cardTitles, columnByName } from '../helpers/board';
import { shelfOf, shelfTitles } from '../helpers/roadmap';
import { flush, key, makeView, refresh, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The iteration board's shelf: the work the sprint can still pull in, above its columns.
 *
 * What is driven here is the population, the two directions of the gesture, and the one
 * rule the pull rests on — a card arriving from the shelf joins the iteration AND lands
 * in the bucket it was dropped on, in ONE write, so one undo takes both back.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
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
	vault.addFile('Committed elsewhere.md', {
		frontmatter: { type: 'PBI', order: 20, status: 'New', iteration: '[[Sprint 13]]' },
	});
	vault.addFile('Uncommitted.md', { frontmatter: { type: 'PBI', order: 30, status: 'New' } });
	vault.addFile('Finished.md', { frontmatter: { type: 'PBI', order: 40, status: 'Done' } });
	return vault;
}

function onSprint(vault: FakeVault) {
	const harness = makeView(vault, OPTIONS, { base: 'Plan.base' });
	harness.view.setProjection('iteration');
	harness.view.setBoardScope(SPRINT);
	return harness;
}

describe('the iteration shelf', () => {
	it('holds the work in NO iteration, and nothing else', () => {
		// In no iteration, never "not in this one": work committed to another fortnight is
		// committed, and offering it here would make a pull a silent removal from somebody
		// else's sprint. Finished work is out by its own workflow, and the two `Iteration`
		// notes are the boxes rather than what goes in them.
		const { containerEl } = onSprint(sprintVault());
		expect(shelfTitles(containerEl)).toEqual(['Uncommitted']);
	});

	it('draws above the columns, which is the direction a card travels', () => {
		const { containerEl } = onSprint(sprintVault());
		const shelf = shelfOf(containerEl);
		const cols = containerEl.querySelector('.pbl-board-cols');
		expect(shelf).not.toBeNull();
		// `DOCUMENT_POSITION_FOLLOWING`: the columns come after the shelf in the frame.
		expect(shelf?.compareDocumentPosition(cols as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('is not drawn on the product board, which is scoped to no iteration at all', () => {
		const harness = makeView(sprintVault(), OPTIONS, { base: 'Plan.base' });
		harness.view.setProjection('board');
		expect(shelfOf(harness.containerEl)).toBeNull();
	});

	it('pulls a card in: it joins the iteration AND lands in the bucket, in one write', async () => {
		const vault = sprintVault();
		const { containerEl } = onSprint(vault);

		cardDrag(cardByTitle(containerEl, 'Uncommitted'), columnByName(containerEl, 'In progress'));
		await flush();

		expect(vault.fm('Uncommitted.md')['iteration']).toBe('[[Sprint 12]]');
		expect(vault.fm('Uncommitted.md')['status']).toBe('Doing');
		// ONE record on one file — one gesture, one edit of that note, one captured
		// inverse — rather than a join write and a state write landing separately.
		expect(vault.writeLog).toHaveLength(1);
	});

	it('takes both halves back on one undo', async () => {
		const vault = sprintVault();
		const { containerEl } = onSprint(vault);

		cardDrag(cardByTitle(containerEl, 'Uncommitted'), columnByName(containerEl, 'In progress'));
		await flush();
		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();

		expect('iteration' in vault.fm('Uncommitted.md')).toBe(false);
		expect(vault.fm('Uncommitted.md')['status']).toBe('New');
	});

	it('lands a pull whose state already reads into the bucket', async () => {
		// The bucket guard is about a card ALREADY on this board. A shelf card holding
		// `New` dropped on Open changes no state and still has to join.
		const vault = sprintVault();
		const { containerEl } = onSprint(vault);

		cardDrag(cardByTitle(containerEl, 'Uncommitted'), columnByName(containerEl, 'Open'));
		await flush();

		expect(vault.fm('Uncommitted.md')['iteration']).toBe('[[Sprint 12]]');
		expect(vault.fm('Uncommitted.md')['status']).toBe('New');
	});

	it('is narrowed by neither the roadmap shelf’s search nor its hidden types', () => {
		// This header carries no search box and no type filter, so a narrowing made on the
		// roadmap would take cards off this shelf with nothing on screen to say why and
		// nothing here to clear it with. A narrowing belongs to the control that shows it.
		const { containerEl, view } = onSprint(sprintVault());
		view.setShelfSearch('nothing matches this');
		view.setShelfHiddenTypes(new Set(['PBI']));
		expect(shelfTitles(containerEl)).toEqual(['Uncommitted']);
	});

	it('folds and reopens from its own disclosure, and starts open', () => {
		// Open until a reader shuts it: a shelf they have to find before they can pull
		// from it answers nothing. The fold is a COLUMN fold (`ColumnScope` 'backlog'),
		// so it lands in the same store every other fold does.
		const { containerEl, view } = onSprint(sprintVault());
		const disclosure = () => shelfOf(containerEl)?.querySelector<HTMLElement>('.pbl-shelf-disclosure');
		expect(shelfTitles(containerEl)).toEqual(['Uncommitted']);

		disclosure()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.columnCollapsed('backlog', null, false)).toBe(true);
		expect(shelfTitles(containerEl)).toEqual([]);
		// The pressed button is gone with the frame it rebuilt, so focus follows the part
		// it played rather than the node — onto its own replacement, which is the only way
		// back into a shut shelf.
		expect(containerEl.ownerDocument.activeElement).toBe(disclosure());

		disclosure()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(shelfTitles(containerEl)).toEqual(['Uncommitted']);
	});

	it('drops a card on the shelf to take it out of the iteration', async () => {
		const vault = sprintVault();
		const { containerEl } = onSprint(vault);
		const shelf = shelfOf(containerEl);

		cardDrag(cardByTitle(containerEl, 'In sprint'), shelf as HTMLElement);
		await flush();

		// The link and nothing else: leaving a sprint is not a state change.
		expect('iteration' in vault.fm('In sprint.md')).toBe(false);
		expect(vault.fm('In sprint.md')['status']).toBe('New');
	});

	it('shows the card it just pulled in on the board, and drops it off the shelf', async () => {
		const vault = sprintVault();
		const { containerEl, view } = onSprint(vault);

		cardDrag(cardByTitle(containerEl, 'Uncommitted'), columnByName(containerEl, 'In progress'));
		await flush();
		refresh(view, vault);

		expect(cardTitles(columnByName(containerEl, 'In progress'))).toEqual(['Uncommitted']);
		expect(shelfTitles(containerEl)).toEqual([]);
	});
});

