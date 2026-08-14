// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Harness, flush, useViewHarness } from '../helpers/view';
import { cardDrag, gridDrag, pannedGrid } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';
import { barFor, gripOf, laneHead, laneRoadmap as bareLaneRoadmap, shelfOf } from '../helpers/roadmap';
import { resourceVault } from '../helpers/resources';

useViewHarness();

/** The default zoom's day width, the same number every geometry assertion here rests on. */
const DAY_PX = 4;

/** A roadmap open on the resources axis with the shelf open, this file's every fixture. */
function laneRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	return bareLaneRoadmap(vault, extra, { shelf: true });
}

/**
 * The axis's second dimension: a release on a band says which row AND which day, and the
 * two are one write. The date arithmetic itself is `test/view/timelineDrag.test.ts`'s
 * subject and is not re-asserted here — what these drive is which answers a release
 * combines, and that the pair lands as one batch. The band alone, and the inputs a drag
 * cannot take, are `test/view/resourceMoves.test.ts`'s; this file is that one's second
 * half, split off it when it reached its line budget.
 *
 * Every gesture here goes through `pannedGrid`, and it has to: jsdom lays nothing out, so
 * an unstubbed drop reads every rect as zero, lands inside the sticky lead column and
 * plans no dates at all — which is exactly what the band-only drags in that file rely on,
 * and why a date test that forgot the stub would pass while asserting nothing.
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

		cardDrag(gripOf(containerEl, 'Alice dated', 'end'), shelfOf(containerEl) as HTMLElement);
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
