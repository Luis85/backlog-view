// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { flush, makeView, treeOf, useViewHarness } from '../helpers/view';
import { cardByTitle } from '../helpers/board';
import { gridDrag, overlayOf, pannedGrid } from '../helpers/dnd';
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

function iso(date: { year: number; month: number; day: number }): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}
