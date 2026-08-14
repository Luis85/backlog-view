// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { Harness, flush, key, makeView, refresh, treeOf, useViewHarness } from '../helpers/view';
import { announced, cardDrag, gridDrag, pannedGrid } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';
import { barFor, gripOf, laneOrder, lanesOf, shelfOf, shelfTitles } from '../helpers/roadmap';
import { resourceVault } from '../helpers/resources';

useViewHarness();

/** The default zoom's day width, the same number every geometry assertion here rests on. */
const DAY_PX = 4;

/**
 * Every input to a resource move — the drag, the Alt+Up/Down ladder, the row menu's Set
 * assignee — and what each of them writes, keeps and says. `test/view/roadmapMoves.test.ts`
 * is this file's shape over the horizon axis; what the axis DRAWS is
 * `test/view/resourceLanes.test.ts`'s subject and is not repeated here.
 */

const RESOURCES = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	assigneeProperty: 'note.assignee',
};

/** A roadmap open on the resources axis, with Alice and Bob declared. */
function laneRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob', ...extra }, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	harness.view.setShelfCollapsed(false);
	return harness;
}

/** The header for a resource, which is one element of that resource's band. */
function laneHead(containerEl: HTMLElement, name: string): HTMLElement {
	const head = lanesOf(containerEl).find((el) => el.querySelector('.pbl-lane-name')?.textContent === name);
	if (!head) throw new Error(`no row for ${name}`);
	return head;
}

function shelf(containerEl: HTMLElement): HTMLElement {
	const el = shelfOf(containerEl);
	if (!el) throw new Error('the shelf is not rendered');
	return el;
}

describe('the one method a resource move lands on', () => {
	it('writes the name into the assignee property and touches nothing else', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob');

		expect(moved).toBe(true);
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		// A row is who and a date is when: the bar's own dates are not a side effect of
		// which row it lands in.
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('removes the key rather than blanking it, and undo puts it back', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, null);
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);

		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('re-picking the name the note already holds writes nothing and keeps the undo', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob');
		expect(vault.writeLog).toHaveLength(1);

		// Case-insensitively, the same matching that put `Cased` in Alice's row.
		const moved = await view.performResourceMove(view.model?.byPath.get('Cased.md') as never, 'ALICE');

		expect(moved).toBe(false);
		expect(vault.writeLog).toHaveLength(1);
		// The slot still holds the first move, not the no-op.
		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('3c — the write lands on a dateless card, and says why nothing entered a row', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// The assignee changes and nothing visibly moves: `Undated` has no date to be
		// positioned at, so it stays on the shelf under its new owner. Said out loud rather
		// than left looking like a drop that missed.
		const moved = await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, 'Bob');

		expect(moved).toBe(true);
		expect(vault.fm('Undated.md')['assignee']).toBe('Bob');
		expect(Notice.messages).toContain(
			'"Undated" is assigned to Bob. Add a start or target date to place it in the row.',
		);
	});

	it('1e — a shelved card dropped on the resource it already names says so anyway', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// Nothing is written and the undo slot is untouched, exactly as 1a — but unlike a
		// bar that stayed where the cursor found it, a shelved card that stays shelved
		// gives the reader no other way to tell the drop landed on an unchanged value.
		const moved = await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, 'Alice');

		expect(moved).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toContain(
			'"Undated" is assigned to Alice. Add a start or target date to place it in the row.',
		);
	});

	it('says nothing at all when a placed bar is dropped on its own row', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Alice');

		expect(moved).toBe(false);
		// 1a: a bar that stayed exactly where the cursor found it already answers the
		// question, so the shelved card's notice must not fire here.
		expect(Notice.messages).toEqual([]);
	});
});

describe('what a resource move announces', () => {
	it('names the rows on screen, in both directions', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob');
		expect(await announced()).toBe('Moved "Alice dated" from Alice to Bob');

		await view.performResourceMove(view.model?.byPath.get('Stray.md') as never, null);
		expect(await announced()).toBe('Moved "Stray" from Zoe to Unplaced');
	});

	it('says both halves of a two-dimensional move in ONE sentence', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// The gesture a band drop hands over, driven at the one method it lands on: a live
		// region is read in order, and two messages about one gesture are two events for a
		// reader who made one.
		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob', {
			plan: { start: '2026-08-08', target: '2026-08-17' },
			ends: ['start', 'target'],
			from: { start: '2026-08-01', target: '2026-08-10' },
		});

		expect(await announced()).toBe('Moved "Alice dated" from Alice to Bob, 2026-08-08 to 2026-08-17');
	});

	it('says the dated axis’s own sentence where only the dates moved', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// A slide inside one row: there is no row change to frame the span with, so the
		// sentence is the one the dated axis already says for the identical write.
		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Alice', {
			plan: { start: '2026-08-08', target: '2026-08-17' },
			ends: ['start', 'target'],
			from: { start: '2026-08-01', target: '2026-08-10' },
		});

		expect(await announced()).toBe('Moved "Alice dated" from 2026-08-01 to 2026-08-10 to 2026-08-08 to 2026-08-17');
	});

	it('names a row in the casing on screen, never the casing on the note', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// `Cased` says `alice`; the row it renders in says `Alice`.
		await view.performResourceMove(view.model?.byPath.get('Cased.md') as never, 'Bob');
		expect(await announced()).toBe('Moved "Cased" from Alice to Bob');
	});

	it('names a resource no row draws, rather than calling the note silent', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// `Undated` names Alice and has no date to sit at, so this axis mints no row for
		// it — but the note plainly says Alice, and "from Unplaced" would be a lie about
		// it. This is where the two axes' labels differ, and why they had to.
		await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, 'Bob');
		expect(await announced()).toBe('Moved "Undated" from Alice to Bob');
	});

	it('names an empty key rather than reporting a real cleanup as no change', async () => {
		vi.useFakeTimers();
		const vault = new FakeVault();
		// The stub the ✨ backfill leaves: the key is there and says nothing, and removing
		// it is a real, undo-consuming write.
		vault.addFile('Stub.md', { frontmatter: { type: 'Epic', order: 10, assignee: '' } });
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Stub.md') as never, null);

		expect(moved).toBe(true);
		expect(await announced()).toBe('Moved "Stub" from an empty assignee to Unplaced');
	});
});

describe('moving between resources by drag', () => {
	it('dropping a bar on another row’s header writes that resource, and nothing else', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		// Dragging between rows changes only who it is assigned to.
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('the whole band takes the drop, not only its header', async () => {
		// A header, its bars and the excluded notes it places are siblings over one shared
		// day grid — there is no container to wire, so every element of the band is a
		// target of its own and a drop on a NEIGHBOUR'S bar row means that neighbour.
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		const aliceRow = barFor(containerEl, 'Cased').closest<HTMLElement>('.pbl-timeline-row');

		cardDrag(barFor(containerEl, 'Stray'), aliceRow as HTMLElement);
		await flush();

		expect(vault.fm('Stray.md')['assignee']).toBe('Alice');
	});

	it('the element under the drag highlights, and the highlight dies with the gesture', () => {
		const { containerEl } = laneRoadmap(resourceVault());
		const bob = laneHead(containerEl, 'Bob');

		cardDrag(barFor(containerEl, 'Alice dated'), bob);

		expect(bob.hasClass('pbl-drop-over')).toBe(false);
	});

	it('drags off the shelf into a row, the same single write', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		expect(shelfTitles(containerEl).sort()).toEqual(['Nobody', 'Undated']);

		cardDrag(cardByTitle(containerEl, 'Nobody'), laneHead(containerEl, 'Bob'));
		await flush();

		expect(vault.fm('Nobody.md')['assignee']).toBe('Bob');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('drops on the shelf to un-assign, and undo puts the name back', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), shelf(containerEl));
		await flush();
		// Removed, not blanked: an empty value would read as a row named nothing.
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);
		// This strip un-places on the axis it draws, and that axis is WHO. When the work
		// happens is not a fact the drop was asked about, so the dates stand.
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');

		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('a minted row is a target like any other — observed vocabulary is writable', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Zoe'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Zoe');
	});

	it('renders in its new row on the write’s own refresh', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'));
		await flush();
		refresh(view, vault);

		// Where a bar renders is the note's own frontmatter and nothing else, which is
		// what makes that one write the whole of the move.
		expect(laneOrder(containerEl)).toEqual(['lane:Alice', 'Cased', 'lane:Bob', 'Alice dated', 'lane:Zoe', 'Stray']);
	});

	it('config problems block a resource move, exactly as every other write', async () => {
		const vault = resourceVault();
		// Parent and order share a key: the gate must refuse everything.
		const { containerEl } = laneRoadmap(vault, { orderProperty: 'note.parent' });

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('offers date grips and still registers no grid-wide target for one', () => {
		// The grips come back with the second dimension, and the OVERLAY still must not:
		// the targets here are the rows, each reading the same pointer X for the same date,
		// and a layer taking pointer events across the whole day area while a drag is live
		// would swallow every one of them. `pbl-timeline-flat` is the other half of that —
		// it stops the today line, the one absolutely positioned mark that keeps its pointer
		// events, from doing the same thing on a smaller scale.
		const { containerEl } = laneRoadmap(resourceVault());

		expect(containerEl.querySelectorAll('.pbl-bar-grip')).not.toHaveLength(0);
		expect(containerEl.querySelector('.pbl-timeline-drop')).toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-content')?.classList.contains('pbl-timeline-flat')).toBe(true);
	});

	it('leaves the dated axis’s own overlay alone', () => {
		// The control beside the case above: the overlay is per axis, and the axis with no
		// rows to mean anything still needs the one target that means a position.
		const { view, containerEl } = laneRoadmap(resourceVault());

		view.setAxisPick('dates');

		expect(containerEl.querySelectorAll('.pbl-bar-grip')).not.toHaveLength(0);
		expect(containerEl.querySelector('.pbl-timeline-drop')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-content')?.classList.contains('pbl-timeline-flat')).toBe(false);
	});
});

/**
 * The axis's second dimension: a release on a band says which row AND which day, and the
 * two are one write. The date arithmetic itself is `test/view/timelineDrag.test.ts`'s
 * subject and is not re-asserted here — what these drive is which answers a release
 * combines, and that the pair lands as one batch.
 *
 * Every gesture here goes through `pannedGrid`, and it has to: jsdom lays nothing out, so
 * an unstubbed drop reads every rect as zero, lands inside the sticky lead column and
 * plans no dates at all — which is exactly what the band-only drags above rely on, and
 * why a date test that forgot the stub would pass while asserting nothing.
 */
describe('scheduling inside a resource’s row', () => {
	/** The grid at a real viewport offset, and the viewport X of a given day offset. */
	function grid(containerEl: HTMLElement): (gridOffset: number) => number {
		return pannedGrid(containerEl, { rectLeft: 300, scrollLeft: 0 });
	}

	it('a body drag across rows writes who and when as ONE batch, taken back by one undo', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);
		const at = grid(containerEl);

		// Seven days right, and down into Bob's band: one gesture, both answers.
		gridDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'), { from: at(0), clientX: at(7 * DAY_PX) });
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-08');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-17');
		// ONE write, because it is one thing to take back: two records naming this file
		// would capture two inverses and leave an undo able to return the row and keep the
		// dates — a state the gesture cannot describe and the user cannot reach again.
		expect(vault.writeLog).toHaveLength(1);

		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');
	});

	it('a slide inside its own row writes the dates alone', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		const at = grid(containerEl);
		const ownRow = barFor(containerEl, 'Alice dated').closest<HTMLElement>('.pbl-timeline-row');

		gridDrag(barFor(containerEl, 'Alice dated'), ownRow as HTMLElement, { from: at(0), clientX: at(7 * DAY_PX) });
		await flush();

		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-08');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-17');
		// The row it landed in is the row it came from, so `computeAssigneeWrites` plans
		// nothing — a re-pick of a value the note already holds is not a change.
		expect(vault.writeLog).toHaveLength(1);
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('a purely vertical drag writes the row alone, displacing no date', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		const at = grid(containerEl);

		// Released clear of the lead column, so the day is readable — and at the very X it
		// started from, so the gesture displaced nothing and no date is planned.
		gridDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'), { from: at(40), clientX: at(40) });
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');
	});

	it('an end grip resizes and never reassigns, released in whosever band', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		const at = grid(containerEl);

		// Dragged into a neighbour's band on purpose: resizing something into the space
		// beside a colleague's bar is not handing it to them.
		gridDrag(gripOf(containerEl, 'Alice dated', 'end'), laneHead(containerEl, 'Bob'), {
			from: at(0),
			clientX: at(7 * DAY_PX),
		});
		await flush();

		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-17');
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('a grip released over the lead column writes nothing at all', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		const at = grid(containerEl);

		// The mirror of the body's own case, and the opposite outcome: a body release there
		// still names the row it landed on, while a grip has nothing BUT the day to say — so
		// with the day refused there is no write left to make.
		gridDrag(gripOf(containerEl, 'Alice dated', 'end'), laneHead(containerEl, 'Bob'), {
			from: at(0),
			clientX: at(-100),
		});
		await flush();

		expect(vault.writeLog).toHaveLength(0);
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('a grip released on the shelf is refused, exactly as on the dated axis', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);

		cardDrag(gripOf(containerEl, 'Alice dated', 'end'), shelf(containerEl));
		await flush();

		// A resize that overshot is not a request to un-assign.
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
		expect(vault.writeLog).toHaveLength(0);
	});

	it('a shelf card dropped in a row is assigned AND placed by one write', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		const at = grid(containerEl);

		// The gesture that most needed the second dimension: before it, this card was
		// assigned and then stayed shelved for want of a date.
		gridDrag(cardByTitle(containerEl, 'Nobody'), laneHead(containerEl, 'Bob'), { clientX: at(7 * DAY_PX) });
		await flush();

		expect(vault.fm('Nobody.md')['assignee']).toBe('Bob');
		expect(vault.fm('Nobody.md')['start']).toBe('2026-07-08');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('a release over the sticky lead column names the row and guesses no day', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		const at = grid(containerEl);

		// Aiming at a row BY ITS TITLE is how the row is aimed at, so the row is exactly
		// what it means — while the day under a column that covers the grid is not one the
		// reader pointed at, and is not guessed. `overLeadColumn` is what refuses the date
		// half; nothing refuses the half the gesture was unambiguous about.
		gridDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'), { from: at(0), clientX: at(-100) });
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');
	});

	it('previews the dates a release would write, from the plan it would submit', () => {
		const { containerEl } = laneRoadmap(resourceVault());
		const at = grid(containerEl);

		const gesture = gridDrag.start(barFor(containerEl, 'Alice dated'), { clientX: at(0) });
		gesture.over(laneHead(containerEl, 'Bob'), { clientX: at(7 * DAY_PX) });

		// Drawn in the dragged item's OWN row, exactly as the dated axis draws it — the
		// band's drop highlight is what says which row the release lands in, so the ghost's
		// job is the dates alone.
		const ghost = containerEl.querySelector<HTMLElement>('.pbl-drop-ghost-dates');
		expect(ghost?.textContent).toBe('2026-08-08 → 2026-08-17');
		gesture.cancel();
	});
});

describe('moving between resources without a drag', () => {
	it('Alt+Down advances the selected card one row, writing the drop’s own value', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);
		key(treeOf(containerEl), 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('Alt+Up off the first row un-assigns, and off the shelf does nothing', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);
		const tree = treeOf(containerEl);

		// The shelf leads the ladder, the horizon axis's own rule: it is where un-placing
		// lives and where an untriaged card enters the axis from.
		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);
		key(tree, 'ArrowUp', { altKey: true });
		await flush();
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);

		// And there is nowhere further up: the edges hold rather than wrap.
		view.selectItem(view.model?.byPath.get('Nobody.md') as never);
		key(tree, 'ArrowUp', { altKey: true });
		await flush();
		expect(vault.writeLog.map((w) => w.path)).toEqual(['Alice dated.md']);
	});

	it('holds at the last row rather than wrapping', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		// Zoe is the last row drawn.
		view.selectItem(view.model?.byPath.get('Stray.md') as never);
		key(treeOf(containerEl), 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.fm('Stray.md')['assignee']).toBe('Zoe');
		expect(vault.writeLog).toEqual([]);
	});

	it('reaches a card whose note names a resource NO row draws', async () => {
		// This axis mints a row only where a BAR lands, so a card naming somebody with no
		// date to sit beside names a resource that has no stop on the ladder at all — it is
		// drawn on the shelf without being ON it, and taking that name off is a real,
		// undoable write the drag and the menu can both express. The keyboard is the third
		// input to one move, so it has to reach it too. `Quinn` is neither declared nor
		// carried by any dated result, which is what makes the index genuinely absent —
		// `Undated` would not do, since Alice's own row is drawn by her two bars.
		const vault = resourceVault();
		vault.addFile('Quinn work.md', { frontmatter: { type: 'Epic', order: 60, assignee: 'Quinn' } });
		const { view, containerEl } = laneRoadmap(vault);
		expect(shelfTitles(containerEl)).toContain('Quinn work');

		view.selectItem(view.model?.byPath.get('Quinn work.md') as never);
		key(treeOf(containerEl), 'ArrowUp', { altKey: true });
		await flush();

		expect('assignee' in vault.fm('Quinn work.md')).toBe(false);
	});

	it('writes nothing on Alt+Left, Alt+Right, or Alt with a second modifier', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);

		// Left/Right on this grid is reserved: resources sit ON the dated axis, and only
		// one dimension can have those keys. A chord aimed at Obsidian or the OS must not
		// land as a frontmatter write either.
		key(tree, 'ArrowLeft', { altKey: true });
		key(tree, 'ArrowRight', { altKey: true });
		key(tree, 'ArrowDown', { altKey: true, shiftKey: true });
		key(tree, 'ArrowDown', { altKey: true, ctrlKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('leaves Alt+Up/Down inert on the horizon axis, where rows are not what moves', async () => {
		// The control beside the case above: the ladder is per axis, and the horizon
		// axis's own is Left/Right. Neither may quietly answer the other's keys.
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const harness = makeView(vault, { horizonProperty: 'note.horizon' }, { collapsed: true });
		harness.view.setProjection('roadmap');
		harness.view.selectItem(harness.view.model?.byPath.get('Item.md') as never);

		key(treeOf(harness.containerEl), 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
	});
});

describe('Set assignee on this axis', () => {
	it('leads with the rows on screen, declared-and-empty included', () => {
		const { view } = laneRoadmap(resourceVault());

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		const submenu = Menu.lastShown?.item('Set assignee')?.submenu;

		// Every row a drop can reach, in the order the frame draws them — Bob has a row
		// and appears on no result, so a list built from the observed names alone would
		// leave the menu the one input to this move that goes quiet.
		expect(submenu?.items.map((i) => i.titleText)).toEqual([
			'Alice',
			'Bob',
			'Zoe',
			'New assignee...',
			'Clear assignee',
		]);
		expect(submenu?.item('Alice')?.checked).toBe(true);
	});

	it('routes a pick through the one method, so a pick and a drop say one sentence', async () => {
		vi.useFakeTimers();
		const { view } = laneRoadmap(resourceVault());
		const spy = vi.spyOn(view, 'performResourceMove');

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Bob')?.clickHandler?.();

		expect(spy).toHaveBeenCalledOnce();
		expect(await announced()).toBe('Moved "Alice dated" from Alice to Bob');
	});

	it('clears the key from the menu, the shelf drop’s own write', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Clear assignee')?.clickHandler?.();
		await flush();

		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);
	});

	it('goes straight through the gate off this axis, where there is no frame to announce into', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);
		const spy = vi.spyOn(view, 'performResourceMove');

		view.setProjection('tree');
		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Zoe')?.clickHandler?.();

		// `announced` drives the live region's own timer, which flushes the write with it —
		// `flush()` waits on a real timeout and would hang against the fake clock.
		expect(await announced()).toBe('');
		expect(spy).not.toHaveBeenCalled();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Zoe');
	});
});
