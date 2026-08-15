// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, MenuItem } from '../helpers/obsidian-mock';
import { flush, makeView, rowByTitle, submitSchedule, useViewHarness } from '../helpers/view';
import { cardByTitle } from '../helpers/board';
import { cardDrag, gridDrag, overlayOf, pannedGrid } from '../helpers/dnd';
import { bucketByName, gripOf, horizonVault, makeRoadmap, shelfOf } from '../helpers/roadmap';
import { scaleFor } from '../../src/domain/timeline';
import { Harness } from '../helpers/view';

useViewHarness();

/**
 * The one criterion `docs/requirements/Horizon and dates from the row.md` left open:
 * **a row's placement action and the equivalent roadmap gesture are one batch.** It
 * could not be checked when the row's actions were built, because nothing on the
 * roadmap wrote yet; both use cases it was waiting on ([[Moving between horizons]],
 * [[Drag from the shelf to schedule]]) have since landed on `computeHorizonWrites` and
 * `computeScheduleWrites`, so there is now something to compare against.
 *
 * Each case drives ONE request through both surfaces against two vaults nothing else
 * has touched, and compares the whole `writeLog` — which files were opened, what each
 * one says afterwards, and how many batches it took. Not the planned `ItemWrite`s: a
 * gesture carries the baseline it was measured from and the placement shape it was
 * captured under (`from`, `ends`) while a dialog entry carries neither, deliberately
 * (`performScheduleMove`), so the two PLANS differ by design and only what lands may
 * be claimed identical.
 *
 * This is the agreement the epic rests on — one model, one gate, one undo history — so
 * a second planner beside either of these fails here rather than at the review that
 * notices the projections drifting.
 */

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };
const HORIZON_AXIS = { horizonProperty: 'note.horizon' };

function dateVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Planned.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' } });
	vault.addFile('Unplanned.md', { frontmatter: { type: 'PBI', order: 20 } });
	return vault;
}

/** The roadmap on the dated axis, panned, so a pointer X means a day rather than zero. */
function datedRoadmap(vault: FakeVault): Harness & { at: (gridOffset: number) => number } {
	const harness = makeView(vault, DATE_AXIS, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setShelfCollapsed(false);
	return { ...harness, at: pannedGrid(harness.containerEl, { rectLeft: 220, scrollLeft: 640 }) };
}

/** The row's own context menu, in whichever projection the harness is showing. */
function rowMenu(containerEl: HTMLElement, title: string): Menu {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error(`no context menu for ${title}`);
	return menu;
}

/** Pick an entry of the row menu's Set horizon list — its Clear foot included. */
function pickHorizon(containerEl: HTMLElement, title: string, value: string): void {
	const entries: MenuItem[] = rowMenu(containerEl, title).item('Set horizon')?.submenu?.items ?? [];
	const entry = entries.find((i) => i.titleText === value);
	if (!entry) throw new Error(`no horizon entry ${value}`);
	entry.click();
}

describe('a horizon set from the row and one set by a card move', () => {
	it('are the same batch — the tree menu and a bucket drop', async () => {
		const fromRow = horizonVault();
		pickHorizon(makeView(fromRow, HORIZON_AXIS).containerEl, 'Now item', 'Next');
		await flush();

		const byDrag = horizonVault();
		const map = makeRoadmap(byDrag);
		cardDrag(cardByTitle(map.containerEl, 'Now item'), bucketByName(map.containerEl, 'Next'));
		await flush();

		expect(fromRow.writeLog).toHaveLength(1);
		expect(fromRow.writeLog).toEqual(byDrag.writeLog);
	});

	it('take it away the same way — Clear horizon and a drop on the shelf', async () => {
		const fromRow = horizonVault();
		pickHorizon(makeView(fromRow, HORIZON_AXIS).containerEl, 'Now item', 'Clear horizon');
		await flush();

		const byDrag = horizonVault();
		const map = makeRoadmap(byDrag);
		cardDrag(cardByTitle(map.containerEl, 'Now item'), shelfOf(map.containerEl)!);
		await flush();

		// Removed rather than blanked on both paths: an empty value would place the item
		// in a bucket named nothing, and one surface doing that is the drift this checks.
		expect('horizon' in fromRow.fm('Now item.md')).toBe(false);
		expect(fromRow.writeLog).toEqual(byDrag.writeLog);
	});
});

describe('dates set from the row and dates set by a card move', () => {
	it('are the same batch for the same span — the entry and a drop on the grid', async () => {
		const byDrag = dateVault();
		const map = datedRoadmap(byDrag);
		gridDrag(cardByTitle(map.containerEl, 'Unplanned'), overlayOf(map.containerEl), { clientX: map.at(700) });
		await flush();

		// The same span, asked for absolutely instead of by a pointer. Read back rather
		// than written as a literal: what the drop MEANT is the zoom's own arithmetic,
		// and restating it here would make this a test of that arithmetic instead of a
		// test that the two surfaces agree about a span they were both given.
		const span = byDrag.fm('Unplanned.md');
		const fromRow = dateVault();
		const row = makeView(fromRow, DATE_AXIS);
		rowMenu(row.containerEl, 'Unplanned').item('Schedule')?.click();
		submitSchedule([span.start as string, span.target as string]);
		await flush();

		expect(fromRow.writeLog).toHaveLength(1);
		expect(fromRow.writeLog).toEqual(byDrag.writeLog);
	});

	it('are the same batch from a date CHIP as from the grid — one end, one key', async () => {
		// The chip is the newest surface over `computeScheduleWrites` and the narrowest: it
		// names one end where every other input names a placement. Held to the same rule
		// anyway — a one-ended grid gesture and a one-ended chip entry are one batch.
		const byGrip = dateVault();
		const map = datedRoadmap(byGrip);
		gridDrag(gripOf(map.containerEl, 'Planned', 'end'), overlayOf(map.containerEl), {
			from: 1000,
			clientX: 1000 + 5 * scaleFor('month').dayPx,
		});
		await flush();

		const moved = byGrip.fm('Planned.md').target as string;
		const fromChip = dateVault();
		const row = makeView(fromChip, DATE_AXIS, { order: ['note.target'] });
		rowByTitle(row.containerEl, 'Planned')
			.querySelector<HTMLElement>('.pbl-prop-target .pbl-date-chip')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitSchedule([moved]);
		await flush();

		expect(fromChip.writeLog).toHaveLength(1);
		expect(fromChip.writeLog).toEqual(byGrip.writeLog);
	});

	it('take them away the same way — Unschedule and a bar dropped on the shelf', async () => {
		const fromRow = dateVault();
		rowMenu(makeView(fromRow, DATE_AXIS).containerEl, 'Planned').item('Unschedule')?.click();
		await flush();

		const byDrag = dateVault();
		const map = datedRoadmap(byDrag);
		cardDrag(gripOf(map.containerEl, 'Planned', 'body'), shelfOf(map.containerEl)!);
		await flush();

		expect('start' in fromRow.fm('Planned.md')).toBe(false);
		expect(fromRow.writeLog).toHaveLength(1);
		expect(fromRow.writeLog).toEqual(byDrag.writeLog);
	});
});
