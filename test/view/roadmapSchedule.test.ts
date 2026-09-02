// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { itemAt, makeView, useViewHarness } from '../helpers/view';
import { announced } from '../helpers/dnd';
import { unschedule } from '../../src/view/interactions/plan';

useViewHarness();

/**
 * The DATED axis's own move, split from `roadmapMoves.test.ts` when that file reached the
 * suite's line cap. The two are one rule apiece rather than one subject in two halves:
 * everything left there is a HORIZON — a bucket, the shelf, the value a card carries —
 * while every case here is a span of dates, and the two share no fixture, no helper and
 * no drop target.
 */
describe('scheduling from the row, on the one path', () => {
	function datedVault() {
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Parent.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-08-01', target: '2026-08-31' },
		});
		vault.addFile('Child.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-10', target: '2026-08-20' },
			parentLink: 'Parent',
		});
		return vault;
	}

	function datedView(vault: FakeVault) {
		const harness = makeView(
			vault,
			{ startProperty: 'note.start', targetProperty: 'note.target' },
			{ collapsed: true },
		);
		harness.view.setProjection('roadmap');
		return harness;
	}

	it('announces the dates the WRITER saw, not the ones the row was drawn from', async () => {
		vi.useFakeTimers();
		const vault = datedVault();
		const { view } = datedView(vault);
		const item = itemAt(view, 'Child.md');
		// The note moved under the row: the screen says the 10th, the note says the 11th.
		vault.fm('Child.md').start = '2026-08-11';

		await view.performScheduleMove(item, { start: '2026-08-12' });

		expect(await announced()).toBe('Moved "Child" from 2026-08-11 to 2026-08-20 to 2026-08-12 to 2026-08-20');
	});

	it('says nothing at all when the write changed nothing', async () => {
		vi.useFakeTimers();
		const vault = datedVault();
		const { view } = datedView(vault);
		const item = itemAt(view, 'Child.md');

		const moved = await view.performScheduleMove(item, { start: '2026-08-10' });

		expect(moved).toBe(false);
		expect(await announced()).toBe('');
	});

	it('names the INFERRED span a parent keeps rather than claiming it was unscheduled', async () => {
		// `inferSpan` refills an end the note no longer states, so announcing a removal
		// as "Unscheduled" would describe something other than what renders. This is
		// `announceHorizonMove`'s own lesson — it recorded a cleanup as "from Unplaced
		// to Unplaced" — reached by the other axis.
		vi.useFakeTimers();
		const vault = datedVault();
		const { view } = datedView(vault);
		const item = itemAt(view, 'Parent.md');

		await view.performScheduleMove(item, { start: null, target: null });

		expect(await announced()).toBe('Moved "Parent" from 2026-08-01 to 2026-08-31 to 2026-08-10 to 2026-08-20');
	});

	it('says Unscheduled only where the item actually leaves the axis', async () => {
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Alone.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01' } });
		const { view } = datedView(vault);
		const item = itemAt(view, 'Alone.md');

		await view.performScheduleMove(item, { start: null, target: null });

		expect(await announced()).toBe('Moved "Alone" from 2026-08-01 onwards to Unscheduled');
	});

	it('reports a real cleanup of an unreadable date, not "Unscheduled" both ways', async () => {
		// The note held something this axis refuses to read; clearing it is a real,
		// undoable change, and "Unscheduled" was already true before the write — the
		// exact confusion `placementLabel` stopped making on the horizon axis.
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'PBI', order: 10, start: 'soon' } });
		const { view } = datedView(vault);
		const item = itemAt(view, 'Garbled.md');

		const moved = await view.performScheduleMove(item, { start: null, target: null });

		expect(moved).toBe(true);
		expect(await announced()).toBe('Moved "Garbled" from an unreadable start date to Unscheduled');
	});

	it('names the shelf reason on the TO side too, when the OTHER end stays unreadable', async () => {
		// A one-ended write (`computeScheduleWrites`) can leave the end it never touched
		// exactly as unreadable as it found it. `outcome.dates.after` now carries that
		// genuine `invalid: true` through — round 1 only fixed the source side, and
		// `placementWords` was still throwing the reason away on this one: the same
		// collapse, newly reachable here because the writer no longer forces every
		// after-reading to `invalid: false`.
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Half.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: 'soon' } });
		const { view } = datedView(vault);
		const item = itemAt(view, 'Half.md');

		const moved = await view.performScheduleMove(item, { start: '2026-08-05' });

		expect(moved).toBe(true);
		expect(await announced()).toBe('Moved "Half" from an unreadable target date to an unreadable target date');
	});

	it('names a marker as the point it is drawn as, on both sides of the sentence', async () => {
		// A marker keeps a stale start deliberately, so an unnarrowed source span would
		// announce "from 2026-07-01 to 2026-09-30 to 2026-10-15" for a note the timeline
		// draws and edits as one September point.
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 10, start: '2026-07-01', target: '2026-09-30' },
		});
		const { view } = datedView(vault);
		const item = itemAt(view, 'Ship.md');

		await view.performScheduleMove(item, { target: '2026-10-15' });

		expect(await announced()).toBe('Moved "Ship" from 2026-09-30 to 2026-10-15');
	});

	it('routes the menu’s Unschedule through the same method', async () => {
		vi.useFakeTimers();
		const vault = datedVault();
		const { view } = datedView(vault);
		const spy = vi.spyOn(view, 'performScheduleMove');
		const item = itemAt(view, 'Child.md');

		await unschedule(view, item);

		expect(spy).toHaveBeenCalledOnce();
	});
});
