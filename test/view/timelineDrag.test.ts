// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Notice } from '../helpers/obsidian-mock';
import { flush, makeView, refresh, treeOf, useViewHarness } from '../helpers/view';
import { cardByTitle } from '../helpers/board';
import { cardDrag, gridDrag, overlayOf, pannedGrid, startCardDrag } from '../helpers/dnd';
import { gripNames, gripOf, rowFor, shelfOf } from '../helpers/roadmap';
import { addDays, cellSpan, dayAt, scaleFor } from '../../src/domain/timeline';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };

/** The header's own CELL-tier day track — where a placement's preview belongs. The
 * header now stacks two tracks (a coarser super tier above the cells), so the
 * selector excludes the super tier explicitly rather than relying on DOM order. */
function headerTrackOf(containerEl: HTMLElement): HTMLElement {
	const track = containerEl.querySelector<HTMLElement>('.pbl-timeline-header .pbl-timeline-track:not(.pbl-timeline-super)');
	if (!track) throw new Error('no header track');
	return track;
}

/** A drawn row's own day track — where that row's move previews. */
function trackOfRow(containerEl: HTMLElement, title: string): HTMLElement {
	const track = rowFor(containerEl, title)?.querySelector<HTMLElement>('.pbl-timeline-track');
	if (!track) throw new Error(`no track for row: ${title}`);
	return track;
}

function scheduleVault() {
	const vault = new FakeVault();
	vault.addFile('Planned.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' } });
	vault.addFile('Unplanned.md', { frontmatter: { type: 'PBI', order: 20 } });
	return vault;
}

function datedView(vault: FakeVault, values: Record<string, unknown> = DATE_AXIS) {
	const harness = makeView(vault, values, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setShelfCollapsed(false);
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

	it('previews a PLACEMENT on the header strip, having no row to draw it in', () => {
		const vault = scheduleVault();
		const { containerEl, at } = datedView(vault);
		const overlay = overlayOf(containerEl);
		const header = headerTrackOf(containerEl);

		const finish = gridDrag.start(cardByTitle(containerEl, 'Unplanned'));
		finish.over(overlay, { clientX: at(700) });
		// On the strip that means "when", because the card is still on the shelf: it has
		// no row, and inventing one would claim a position in an order the drop does not
		// decide. Drawn into the overlay instead, `top: 50%` of a full-grid layer put it
		// at the middle of the WHOLE timeline — the "unrelated to anything" this fixes.
		expect(header.querySelector('.pbl-drop-ghost')).not.toBeNull();
		expect(header.querySelector('.pbl-drop-ghost-dates')?.textContent).toContain('2026-');
		expect(overlay.querySelector('.pbl-drop-ghost')).toBeNull();
		finish.leave(overlay);
		expect(header.querySelector('.pbl-drop-ghost')).toBeNull();
		finish.cancel();
	});

	it('previews a MOVE in the dragged row itself, beside the bar it would replace', () => {
		// Two PLACED items, so "not in the other row" is a real assertion: a shelf card
		// has no row to be wrongly drawn in.
		const vault = new FakeVault();
		vault.addFile('Planned.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' } });
		vault.addFile('Later.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-09-04', target: '2026-09-10' } });
		const { containerEl, at } = datedView(vault);
		const overlay = overlayOf(containerEl);
		const moved = trackOfRow(containerEl, 'Planned');
		const other = trackOfRow(containerEl, 'Later');

		const finish = gridDrag.start(gripOf(containerEl, 'Planned', 'body'));
		finish.over(overlay, { clientX: at(700) });
		// The before and the after read as one sentence: the row still shows its own
		// bar, and the ghost proposing to move it is on the same line.
		expect(moved.querySelector('.pbl-drop-ghost')).not.toBeNull();
		expect(moved.querySelector('.pbl-bar')).not.toBeNull();
		// Nowhere else — not another row, not the header, not the overlay.
		expect(other.querySelector('.pbl-drop-ghost')).toBeNull();
		expect(headerTrackOf(containerEl).querySelector('.pbl-drop-ghost')).toBeNull();
		expect(overlay.querySelector('.pbl-drop-ghost')).toBeNull();
		finish.leave(overlay);
		expect(moved.querySelector('.pbl-drop-ghost')).toBeNull();
		finish.cancel();
	});

	it('writes nothing for a release physically over the sticky lead column, panned', async () => {
		// `.pbl-timeline-drop` is positioned in CONTENT coordinates, so once the grid
		// pans past `TIMELINE_LEAD_PX` its rect has drifted left of the STICKY lead
		// column — `.pbl-timeline-lead`, pinned to the scroller's own edge — and wins
		// hit-testing there. A fixture at the origin cannot exercise this: unscrolled,
		// the overlay's edge and the lead's edge coincide and the bug is invisible.
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);

		// 100 is inside the lead column's viewport footprint (0..220) at ANY scroll —
		// the sticky element never moves — but under the current pan the overlay's own
		// (drifted) rect would still resolve it to a real, in-window day.
		gridDrag(cardByTitle(containerEl, 'Unplanned'), overlayOf(containerEl), { clientX: 100 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});

	describe('the boundary that refusal is measured from is the drawn lead width', () => {
		// `overLeadColumn` reads `parts.leadWidth` — what THIS render drew — and never
		// `TIMELINE_LEAD_PX`. Both halves are needed: pinning the constant back in refuses
		// every drop between the old boundary and a widened one, and admits every drop
		// between a narrowed one and the old boundary, where the reader is looking at grid.
		// The scroller's own rect sits at viewport 0 under `datedView`'s geometry
		// (`rectLeft - TIMELINE_LEAD_PX`), so a `clientX` IS its distance past that edge.

		/** Re-stub after `setLeadWidth`: the write re-renders, so the grid is new. */
		function resizedTo(width: number, harness: ReturnType<typeof datedView>) {
			harness.view.setLeadWidth(width);
			return pannedGrid(harness.containerEl, { rectLeft: 220, scrollLeft: 640 });
		}

		it('refuses a drop the WIDENED column now covers, which the default width would have taken', async () => {
			const vault = scheduleVault();
			const harness = datedView(vault);
			const at = resizedTo(300, harness);

			// Grid offset 680 is viewport X 260 — past the default 220 boundary and inside
			// the 300px column actually on screen.
			expect(at(680)).toBe(260);
			gridDrag(cardByTitle(harness.containerEl, 'Unplanned'), overlayOf(harness.containerEl), { clientX: at(680) });
			await flush();

			expect(vault.writeLog).toHaveLength(0);
		});

		it('takes a drop the NARROWED column no longer covers, which the default width would have refused', async () => {
			const vault = scheduleVault();
			const harness = datedView(vault);
			const at = resizedTo(160, harness);
			const window = harness.view.roadmap?.window;
			if (!window) throw new Error('no window');

			// Viewport X 200: inside the default 220px column, past the 160px one drawn.
			expect(at(620)).toBe(200);
			gridDrag(cardByTitle(harness.containerEl, 'Unplanned'), overlayOf(harness.containerEl), { clientX: at(620) });
			await flush();

			// It lands, and it lands on the day the pointer named rather than anywhere the
			// refusal path would have left it.
			expect(vault.fm('Unplanned.md').start).toBe(iso(dayAt(window, scaleFor('month'), 620)));
		});
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

	it('moves an end grip from its OWN end, not the opposite one, when neither is open', async () => {
		// Both ends are stated here, so a grip that borrowed the wrong one would still
		// produce A date — the clamp-at-equal case above can't tell the two apart because
		// crossing forces the same clamped answer either way. This drag stays clear of the
		// opposite end, so only the correct baseline lands on 2026-08-15.
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const scale = scaleFor('month');

		gridDrag(gripOf(containerEl, 'Planned', 'end'), overlayOf(containerEl), { from: 1000, clientX: 1000 + 5 * scale.dayPx });
		await flush();

		expect(vault.fm('Planned.md').target).toBe('2026-08-15');
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

	it('slides an Iteration by its target alone while bar mode is off, at the writer', async () => {
		// The identical gesture above, for the OTHER marker type `drawsAsPoint` now
		// decides between: bar mode defaults off, so an Iteration is a point exactly as
		// a Milestone is, and `placementEnds` answers `target` alone — extension 5a of
		// [[An iteration draws as a bar or a line]]. The writer resolves the predicate
		// from settings itself, so this proves the narrowing end to end rather than at
		// the plan alone.
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10, start: '2026-09-07', target: '2026-09-20' } });
		const { containerEl } = datedView(vault);

		gridDrag(gripOf(containerEl, 'Sprint 12', 'body'), overlayOf(containerEl), { from: 1000, clientX: 1000 + 2 * scaleFor('month').dayPx });
		await flush();

		expect(vault.fm('Sprint 12.md').target).toBe('2026-09-22');
		expect(vault.fm('Sprint 12.md').start).toBe('2026-09-07');
	});

	it('resizes an Iteration bar from its own end grip while bar mode is on', async () => {
		// The mirror of the two tests above, in the OTHER mode: with bar mode on the
		// sprint is a span, not a point, so it carries its own edge grips — the ones
		// `drawMarkerDiamonds` now wires through `wireBarHolds` beside the body hold —
		// and each moves only its own end, `renderBarRow`'s own grip rule extended to
		// the marker row.
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10, start: '2026-09-07', target: '2026-09-20' } });
		const { containerEl } = datedView(vault, { ...DATE_AXIS, iterationBars: true });
		const scale = scaleFor('month');

		gridDrag(gripOf(containerEl, 'Sprint 12', 'end'), overlayOf(containerEl), { from: 1000, clientX: 1000 + 5 * scale.dayPx });
		await flush();

		expect(vault.fm('Sprint 12.md').target).toBe('2026-09-25');
		expect(vault.fm('Sprint 12.md').start).toBe('2026-09-07');
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

	it('offers no grip at all when the note states neither end — target inferred from a child alone', () => {
		// `barHolds` used to withhold a START grip only for an INFERRED start, and a start
		// that is simply absent — no evidence from children either — is not inferred
		// (`inferredStart` is false whenever the derived start stays null, whether or not
		// anything was ever stated). A parent stating no dates, with a single child
		// supplying only a TARGET, drew a bar with `inferredStart: false` for exactly that
		// reason and still offered a start grip with no baseline anywhere on the note to
		// drag from — dragging it wrote a date anchored to the visible window's own edge,
		// wherever the reader happened to have scrolled. `barHolds` now asks what the note
		// ITSELF states before offering anything: neither end is the note's own here, so
		// the bar still renders (the child's target still fills the axis) but offers
		// NOTHING to grip.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-09-01' }, parentLink: 'Parent' });
		const { containerEl } = datedView(vault);

		expect(gripNames(containerEl, 'Parent')).toEqual([]);
	});

	it('clamps a start grip at equal rather than crossing a stated target', async () => {
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);
		const scale = scaleFor('month');

		gridDrag(gripOf(containerEl, 'Planned', 'start'), overlayOf(containerEl), { from: 1000, clientX: 1000 + 30 * scale.dayPx });
		await flush();

		// The mirror of the end-grip clamp above: dragged past its own target, the
		// start clamps to it rather than crossing into a reversed pair.
		expect(vault.fm('Planned.md').start).toBe('2026-08-10');
		expect(vault.fm('Planned.md').target).toBe('2026-08-10');
	});

	it('previews no ghost when a live refusal on the untouched end would shelve the result', () => {
		// The preview asks the same `placeItem` the write does, against the CURRENT
		// model (`source.item` is re-resolved by path, not the captured snapshot) — so
		// a concurrent edit that makes the untouched end unreadable is seen before the
		// drop, and the grid draws nothing rather than a ghost for a bar that would not
		// exist. `bodySlide` only plans the end being dragged; the other end's value on
		// preview comes from `plannedEnds`' live fallback.
		const vault = scheduleVault();
		const { containerEl, view } = datedView(vault);
		const scale = scaleFor('month');

		const gesture = gridDrag.start(gripOf(containerEl, 'Planned', 'end'), { clientX: 1000 });
		vault.setFrontmatter('Planned.md', { type: 'PBI', order: 10, start: 'not a date', target: '2026-08-10' });
		refresh(view, vault);

		const overlay = overlayOf(containerEl);
		gesture.over(overlay, { clientX: 1000 + 3 * scale.dayPx });
		expect(overlay.querySelector('.pbl-drop-ghost')).toBeNull();
		gesture.cancel();
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

describe('dropping a bar back on the shelf', () => {
	it('removes the date keys rather than blanking them, and undo restores them', async () => {
		const vault = scheduleVault();
		const { view, containerEl } = datedView(vault);

		cardDrag(gripOf(containerEl, 'Planned', 'body'), shelfOf(containerEl)!);
		await flush();

		expect('start' in vault.fm('Planned.md')).toBe(false);
		expect('target' in vault.fm('Planned.md')).toBe(false);
		await view.undoLast();
		expect(vault.fm('Planned.md').start).toBe('2026-08-04');
	});

	it('narrows a marker to its target and leaves a stale start alone', async () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, start: '2026-07-01', target: '2026-09-30' } });
		const { containerEl } = datedView(vault);

		cardDrag(gripOf(containerEl, 'Ship', 'body'), shelfOf(containerEl)!);
		await flush();

		expect('target' in vault.fm('Ship.md')).toBe(false);
		expect(vault.fm('Ship.md').start).toBe('2026-07-01');
	});

	it('refuses a GRIP released over the shelf — a resize is not an unschedule', async () => {
		// `wireDropTarget` admits any source carrying the view's token and hands its
		// callback the resolved item alone, so with the bar holds wired as sources it
		// cannot tell a resize from a body drag: a start grip released over the shelf
		// would fire the full unschedule and delete BOTH keys instead of moving one end.
		// Refused rather than ignored, so the strip never highlights for a drag it
		// would not honour.
		const vault = scheduleVault();
		const { containerEl } = datedView(vault);

		cardDrag(gripOf(containerEl, 'Planned', 'start'), shelfOf(containerEl)!);
		await flush();

		expect(vault.fm('Planned.md').start).toBe('2026-08-04');
		expect(vault.writeLog).toHaveLength(0);
		expect(shelfOf(containerEl)?.hasClass('pbl-drop-over')).toBe(false);
	});

	it('refuses a SHELF card dropped back on the shelf, which is not merely tidiness', async () => {
		// A card shelved as unreadable or reversed still carries its date keys —
		// `deriveBars` shelves it with a reason rather than for want of dates — so the
		// removal would delete the very values the reason is telling the user to correct.
		const vault = new FakeVault();
		vault.addFile('Backwards.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-31', target: '2026-08-01' } });
		const { containerEl } = datedView(vault);

		cardDrag(cardByTitle(containerEl, 'Backwards'), shelfOf(containerEl)!);
		await flush();

		expect(vault.fm('Backwards.md').start).toBe('2026-08-31');
		expect(vault.writeLog).toHaveLength(0);
	});

	it('previews the inferred span a parent KEEPS, not the shelf', async () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01', target: '2026-08-31' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-10', target: '2026-08-20' }, parentLink: 'Parent' });
		const { containerEl } = datedView(vault);
		const shelf = shelfOf(containerEl)!;

		const gesture = gridDrag.start(gripOf(containerEl, 'Parent', 'body'));
		gesture.over(shelf, { clientX: 10 });

		expect(shelf.querySelector('.pbl-shelf-outcome')?.textContent).toContain('2026-08-10');
		// A hover-only gesture has to end with `cancel`, or pragmatic keeps it "active"
		// globally and the next test's dragstart bleeds into a drag that never ended —
		// see `gridDrag.start`'s own comment in `test/helpers/dnd.ts`.
		gesture.cancel();
	});

	it('previews the shelf for a wholly dateless subtree, and for a marker with a stale start', () => {
		const vault = new FakeVault();
		vault.addFile('Alone.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01' } });
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, start: '2026-07-01', target: '2026-09-30' } });
		const { containerEl } = datedView(vault);
		const shelf = shelfOf(containerEl)!;

		for (const title of ['Alone', 'Ship']) {
			const gesture = gridDrag.start(gripOf(containerEl, title, 'body'));
			gesture.over(shelf, { clientX: 10 });
			expect(shelf.querySelector('.pbl-shelf-outcome')?.textContent, title).toContain('Unscheduled');
			gesture.leave(shelf);
			gesture.cancel();
		}
	});

	it('refuses a body hold whose note became a Milestone mid-drag, rather than narrowing to a target-only removal', async () => {
		// The gesture picks up a two-ended PBI's body — a captured shape of
		// `['start', 'target']` — and the note becomes a Milestone (`['target']`
		// alone) before release, the way a Bases refresh mid-hold would land it.
		// `unschedulePlan` and `performScheduleMove` must both still see the
		// CAPTURED shape, or the plan silently narrows to removing `target` alone
		// and applies it — exactly what `performScheduleMove`'s own comment says a
		// recomputed `ends` would do.
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' } });
		const { view, containerEl } = datedView(vault);

		const drop = startCardDrag(gripOf(containerEl, 'Item', 'body'));
		vault.setFrontmatter('Item.md', { type: 'Milestone', order: 10, start: '2026-08-04', target: '2026-08-10' });
		refresh(view, vault);
		drop(shelfOf(containerEl)!);
		await flush();

		// Refused whole: neither the captured two-ended write nor a quietly narrowed
		// target-only one lands — both keys are exactly what they were, and the writer
		// says so rather than applying a batch nobody asked for.
		expect(vault.fm('Item.md').start).toBe('2026-08-04');
		expect(vault.fm('Item.md').target).toBe('2026-08-10');
		expect(Notice.messages).toContain('That note changed while the move was in flight, so nothing was written.');
	});
});

describe('a grip is a handle, not a link', () => {
	it('does not open the note when a grip is clicked without a drag', () => {
		// A press that never travels far enough to become a drag still fires `click`, and
		// the grips are divs inside the bar inside the row `wireCardActivation` wired —
		// whose handler is unfiltered. So a resize handle did the row's action instead of
		// its own, and a middle click reached the row's `auxclick` and opened the note in
		// a new tab by the route a primary-click guard does not cover.
		const vault = new FakeVault();
		vault.addFile('Planned.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' } });
		const { containerEl } = datedView(vault);

		for (const hold of ['start', 'end'] as const) {
			const grip = gripOf(containerEl, 'Planned', hold);
			grip.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			grip.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
		}

		expect(vault.opened).toEqual([]);
	});

	it('still opens the note when the BAR itself is clicked', () => {
		// The half that must not move, and the reason the guard is per hold rather than
		// on every one of them: the body hold IS the bar element
		// (`hold === 'body' ? el : el.createDiv(...)`), so a guard applied to the whole
		// loop would stop a click on the bar from opening its note — behaviour a reader
		// depends on and nobody asked to change. Without this the fix above passes while
		// having broken the thing it was careful not to.
		const vault = new FakeVault();
		vault.addFile('Planned.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' } });
		const { containerEl } = datedView(vault);

		gripOf(containerEl, 'Planned', 'body').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		expect(vault.opened.map((o) => o.path)).toEqual(['Planned.md']);
	});
});

function iso(date: { year: number; month: number; day: number }): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}
