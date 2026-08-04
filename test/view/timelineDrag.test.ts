// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { flush, makeView, treeOf, useViewHarness } from '../helpers/view';
import { cardByTitle } from '../helpers/board';
import { gridDrag, overlayOf, pannedGrid } from '../helpers/dnd';
import { gripNames, gripOf, shelfOf } from '../helpers/roadmap';
import { addDays, cellSpan, dayAt, scaleFor } from '../../src/domain/timeline';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };

function scheduleVault() {
	const vault = new FakeVault();
	vault.addFile('Planned.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' } });
	vault.addFile('Unplanned.md', { frontmatter: { type: 'PBI', order: 20 } });
	return vault;
}

function datedView(vault: FakeVault, values: Record<string, unknown> = DATE_AXIS) {
	const harness = makeView(vault, values, { collapsed: true });
	harness.view.setProjection('roadmap');
	// EVERY pointer case is driven against a panned grid at a nonzero viewport offset:
	// a fixture at the origin with no scroll passes whether or not the pointer is
	// converted at all. `at(offset)` is the viewport X of a grid offset under that
	// geometry — the two are NOT the same number, and writing the event coordinate as
	// the offset is how a placing test silently asserts against the wrong day.
	const at = pannedGrid(harness.containerEl, { rectLeft: 220, scrollLeft: 640 });
	return { ...harness, vault, at };
}

describe('dragging a shelf card onto the grid', () => {
	it('writes the day under the pointer, spanning the zoom’s cell', async () => {
		const vault = scheduleVault();
		const { view, containerEl, at } = datedView(vault);
		const window = view.roadmap?.window;
		if (!window) throw new Error('no window');
		const scale = scaleFor('month');
		const day = dayAt(window, scale, 700);

		gridDrag(cardByTitle(containerEl, 'Unplanned'), overlayOf(containerEl), { clientX: at(700) });
		await flush();

		// Start is the day under the pointer; target is start plus the cell, minus a
		// day — a duration that still decays with distance, without the write's own
		// granularity ever changing. `start === target` would render as a MILESTONE
		// diamond, so a dropped PBI would arrive looking like a deadline.
		expect(vault.fm('Unplanned.md').start).toBe(iso(day));
		// The cell of the month the drop LANDED in, not a hardcoded 30: `dayAt` clamps
		// into the window, so a pointer past its end lands on the last day it draws and
		// the month that day belongs to decides the length. A literal here asserts the
		// fixture's calendar rather than the rule, and fails a correct implementation by
		// one day whenever those disagree.
		expect(vault.fm('Unplanned.md').target).toBe(iso(addDays(day, cellSpan(scaleFor('month'), day) - 1)));
	});

	it('writes a marker’s target alone, at the drop day, with no span offset', async () => {
		// Extension 2e, and the `cellSpan` rule: a duration is supplied only where a
		// SPAN is written; a one-ended plan takes the drop day. Offsetting a lone date
		// by a week because the reader zoomed out is the silent coarsening decision 1
		// refuses — and on a deadline it moves the one date a gesture must never move.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10 } });
		const { view, containerEl, at } = datedView(vault);
		const day = dayAt(view.roadmap!.window!, scaleFor('month'), 700);

		gridDrag(cardByTitle(containerEl, 'Ship'), overlayOf(containerEl), { clientX: at(700) });
		await flush();

		expect(vault.fm('Ship.md').target).toBe(iso(day));
		expect(vault.fm('Ship.md').start).toBeUndefined();
	});

	it('takes the drop day with no offset where only ONE date property is configured', async () => {
		const vault = scheduleVault();
		const { view, containerEl, at } = datedView(vault, { targetProperty: 'note.target' });
		const day = dayAt(view.roadmap!.window!, scaleFor('month'), 700);

		gridDrag(cardByTitle(containerEl, 'Unplanned'), overlayOf(containerEl), { clientX: at(700) });
		await flush();

		expect(vault.fm('Unplanned.md').target).toBe(iso(day));
	});

	it('offers a marker no grip at all where its target key is unconfigured', () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10 } });
		const { containerEl } = datedView(vault, { startProperty: 'note.start' });

		expect(cardByTitle(containerEl, 'Ship').getAttribute('draggable')).not.toBe('true');
	});

	it('writes nothing when the drag ends off both the grid and the shelf', async () => {
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);

		gridDrag(cardByTitle(containerEl, 'Unplanned'), treeOf(containerEl), { clientX: 400 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('previews the dates before the release, and clears them when the pointer leaves', () => {
		const vault = scheduleVault();
		const { containerEl, at } = datedView(vault);
		const overlay = overlayOf(containerEl);

		const finish = gridDrag.start(cardByTitle(containerEl, 'Unplanned'));
		finish.over(overlay, { clientX: at(700) });
		expect(overlay.querySelector('.pbl-drop-ghost')).not.toBeNull();
		expect(overlay.querySelector('.pbl-drop-ghost-dates')?.textContent).toContain('2026-');
		finish.leave(overlay);
		expect(overlay.querySelector('.pbl-drop-ghost')).toBeNull();
		finish.cancel();
	});
});

describe('holding a bar', () => {
	it('slides both stated ends by whole days, never changing the duration', async () => {
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const scale = scaleFor('month');

		gridDrag(gripOf(containerEl, 'Planned', 'body'), overlayOf(containerEl), { from: 1000, clientX: 1000 + 3 * scale.dayPx });
		await flush();

		expect(vault.fm('Planned.md').start).toBe('2026-08-07');
		expect(vault.fm('Planned.md').target).toBe('2026-08-13');
	});

	it('reads the DELTA, so grabbing a one-day bar at quarter zoom previews nothing', async () => {
		// A span shorter than the minimum drawable width is drawn WIDER than it is, so
		// at quarter zoom the end grip of a one-day bar sits days past its target.
		// Reading the pointer absolutely means grabbing the grip already previews a
		// later date — and the smallest twitch writes it.
		const vault = new FakeVault();
		vault.addFile('Day.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-04' } });
		const { view, containerEl } = datedView(vault);
		view.setZoom('quarter');
		pannedGrid(containerEl, { rectLeft: 220, scrollLeft: 640 });

		gridDrag(gripOf(containerEl, 'Day', 'end'), overlayOf(containerEl), { from: 1000, clientX: 1000 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('plans nothing at all when a drag wanders and comes back', async () => {
		// A drag that expressed no change must produce no BATCH — not a batch the
		// writer then decides about. Its job is to judge a REQUESTED date against the
		// live one, and if a hold that moved nowhere submitted the model's own
		// endpoints, an editor who had changed that date meanwhile would have their
		// work quietly reverted.
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const gesture = gridDrag.start(gripOf(containerEl, 'Planned', 'body'), { clientX: 1000 });
		gesture.over(overlayOf(containerEl), { clientX: 1400 });
		gesture.drop(overlayOf(containerEl), { clientX: 1000 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('keeps the scroll baseline when the pointer leaves the overlay and comes back', async () => {
		// A held bar that auto-scrolls, crosses the sticky lead column or the shelf, and
		// re-enters: a baseline latched by the TARGET would re-latch on re-entry and lose
		// every pixel of pan before it. The baseline is the gesture's, so it rides the
		// payload — which is why this passes with no lifetime bookkeeping at all.
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const scroller = containerEl.querySelector<HTMLElement>('.pbl-timeline');
		if (!scroller) throw new Error('no scroller');
		const overlay = overlayOf(containerEl);
		const shelf = shelfOf(containerEl);
		if (!shelf) throw new Error('no shelf');

		const gesture = gridDrag.start(gripOf(containerEl, 'Planned', 'body'), { clientX: 1000 });
		gesture.over(overlay, { clientX: 1000 });
		// Auto-scroll pans four days' worth of grid under a pointer that has not moved.
		scroller.scrollLeft = 640 + 4 * scaleFor('month').dayPx;
		gesture.leave(overlay);
		gesture.over(overlay, { clientX: 1000 });
		gesture.drop(overlay, { clientX: 1000 });
		await flush();

		expect(vault.fm('Planned.md').start).toBe('2026-08-08');
	});

	it('moves one date on an end grip and clamps at equal rather than crossing', async () => {
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const scale = scaleFor('month');

		gridDrag(gripOf(containerEl, 'Planned', 'end'), overlayOf(containerEl), { from: 1000, clientX: 1000 - 30 * scale.dayPx });
		await flush();

		// 2a: a reversed span is unreadable, so no gesture may write one — and it
		// clamps rather than refusing, because the diamond a coincident pair draws is
		// the shape and not the type.
		expect(vault.fm('Planned.md').target).toBe('2026-08-04');
		expect(vault.fm('Planned.md').start).toBe('2026-08-04');
	});

	it('leaves a one-ended bar’s open end open on a body slide', async () => {
		// 1a: shifting an absence would invent a date the note never stated, and equal
		// ends would draw a milestone the note never claimed.
		const vault = new FakeVault();
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04' } });
		const { containerEl } = datedView(vault);

		gridDrag(gripOf(containerEl, 'Open', 'body'), overlayOf(containerEl), { from: 1000, clientX: 1000 + 3 * scaleFor('month').dayPx });
		await flush();

		expect(vault.fm('Open.md').start).toBe('2026-08-07');
		expect(vault.fm('Open.md').target).toBeUndefined();
	});

	it('writes an open end from its own grip, counting days from the stated one', async () => {
		const vault = new FakeVault();
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04' } });
		const { containerEl } = datedView(vault);

		gridDrag(gripOf(containerEl, 'Open', 'end'), overlayOf(containerEl), { from: 1000, clientX: 1000 + 5 * scaleFor('month').dayPx });
		await flush();

		expect(vault.fm('Open.md').target).toBe('2026-08-09');
	});

	it('writes nothing when an open end is released without moving', async () => {
		// Zero days from the borrowed baseline would be a date EQUAL to the stated end —
		// a milestone diamond — and a plan that stated no end still states none. Absent
		// is a value here, and a gesture that did not move must not turn it into one.
		const vault = new FakeVault();
		vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-08-20' } });
		const { containerEl } = datedView(vault);

		gridDrag(gripOf(containerEl, 'Open', 'start'), overlayOf(containerEl), { from: 1000, clientX: 1000 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	it('carries no stale start on a marker’s slide, at any zoom', async () => {
		// 1g, and the category claim: "the plan is narrowed by type" is checked once per
		// gesture, because the next gesture is exactly the one that would break it.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, start: '2026-07-01', target: '2026-09-30' } });
		const { containerEl } = datedView(vault);

		gridDrag(gripOf(containerEl, 'Ship', 'body'), overlayOf(containerEl), { from: 1000, clientX: 1000 + 2 * scaleFor('month').dayPx });
		await flush();

		expect(vault.fm('Ship.md').target).toBe('2026-10-02');
		expect(vault.fm('Ship.md').start).toBe('2026-07-01');
	});

	it('offers no grip where a bar’s end is inferred, and none at all where both are', () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-08-20' }, parentLink: 'Parent' });
		const { containerEl } = datedView(vault);

		expect(gripNames(containerEl, 'Parent')).toEqual(['start']);
	});

	it('writes the day the pointer names when dragged past an inferred opposite end, never the child’s date', async () => {
		// 1c: the opposite end here is INFERRED from the child, not stated by the note —
		// there is no span to reverse, so clamping against it would write a bound taken
		// from the child's own date rather than the one the pointer named.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-08-20' }, parentLink: 'Parent' });
		const { containerEl } = datedView(vault);
		const scale = scaleFor('month');

		// Past 2026-08-20, the child's target — the inferred evidence a real clamp would
		// have wrongly bounced off of.
		gridDrag(gripOf(containerEl, 'Parent', 'start'), overlayOf(containerEl), { from: 1000, clientX: 1000 + 30 * scale.dayPx });
		await flush();

		expect(vault.fm('Parent.md').start).toBe('2026-08-31');
	});

	it('a source wired by one controller is not droppable on another’s target', () => {
		// The `canDrop` contract stated as a test rather than as the comment it is
		// today: two saved views can sit in split panes over the same notes, and the
		// stakes here are the RECEIVING view's date keys.
		const vault = scheduleVault();
		const first = datedView(vault);
		const second = datedView(vault);

		gridDrag(cardByTitle(first.containerEl, 'Unplanned'), overlayOf(second.containerEl), { clientX: 500 });

		expect(vault.writeLog).toHaveLength(0);
	});
});

function iso(date: { year: number; month: number; day: number }): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}
