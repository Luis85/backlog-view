// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { flush, useViewHarness } from '../helpers/view';
import { barFor, laneCountOf, laneNames, laneRoadmap, lanesOf } from '../helpers/roadmap';
import { ALICE_AWAY, absenceVault } from '../helpers/resources';
import { cardDrag } from '../helpers/dnd';

useViewHarness();

/**
 * An absence on screen: a blocked stretch in one resource's row and nowhere else.
 *
 * Its own file rather than a block in `resourceLanes.test.ts`, whose subject is the row
 * over the grid it derives from. What is different here is the second SOURCE a row draws
 * from — a thing that is not a work item at all, so nothing in that file's vocabulary
 * (a bar, a card, a count) describes one.
 */

/**
 * Every drawn line of the band, in order. There is no absence ROW any more — a stretch
 * draws inside its header's own track — so a header reports how many marks it carries
 * rather than being followed by a line each.
 */
function bandOrder(containerEl: HTMLElement): string[] {
	const rows = containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head, .pbl-timeline-row');
	return Array.from(rows).map((el) => {
		if (!el.classList.contains('pbl-lane-head')) return el.querySelector('.pbl-card-title')?.textContent ?? '';
		const name = el.querySelector('.pbl-lane-name')?.textContent;
		return `lane:${name}+${el.querySelectorAll('.pbl-absence').length}`;
	});
}

describe('an absence on the resources axis', () => {
	it('draws in its own resource’s header, not in a row of its own', () => {
		const { containerEl } = laneRoadmap(absenceVault());

		// One row per person: the stretch is a mark inside the header's track, and Alice's
		// work follows the header directly.
		expect(bandOrder(containerEl)).toEqual(['lane:Alice+1', 'Work', 'lane:Bob+0']);
		expect(containerEl.querySelectorAll('.pbl-absence-row')).toHaveLength(0);
	});

	it('puts the mark inside the header’s own track', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const track = containerEl.querySelector<HTMLElement>('.pbl-lane-head .pbl-timeline-track');

		expect(track?.querySelectorAll('.pbl-absence')).toHaveLength(1);
	});

	it('is positioned by the same date math a bar is', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const bar = containerEl.querySelector<HTMLElement>('.pbl-timeline-row .pbl-bar');
		const away = containerEl.querySelector<HTMLElement>('.pbl-absence');

		// Both offsets are daysÃ—dayPx from the same window origin, so a stretch that starts
		// three days after the bar sits three days to its right — asserted as the CSS
		// custom properties, since jsdom lays nothing out.
		const barLeft = Number.parseFloat(bar?.style.getPropertyValue('--pbl-bar-left') ?? '');
		const awayLeft = Number.parseFloat(away?.style.getPropertyValue('--pbl-bar-left') ?? '');
		expect(Number.isFinite(awayLeft)).toBe(true);
		// The absence starts three days after the work does, at the scale's own day width.
		expect(awayLeft - barLeft).toBe(3 * 4);
		// Three days inclusive, the same span arithmetic a bar's own width uses.
		expect(away?.style.getPropertyValue('--pbl-bar-width')).toBe(`${3 * 4}px`);
	});

	it('gives a resource nothing else names a row of its own', () => {
		const vault = absenceVault();
		vault.addFile('Quinn away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2026-08-02', due: '2026-08-03' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(laneNames(containerEl)).toEqual(['Alice', 'Bob', 'Quinn']);
	});

	it('packs two that share a day onto two sub-lanes, and says how many', () => {
		// 4a's promise kept in its new form: nothing is hidden or merged, the header grows.
		const vault = absenceVault();
		vault.addFile('Also away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-05', due: '2026-08-08' },
		});
		const { containerEl } = laneRoadmap(vault);
		const head = lanesOf(containerEl)[0];

		expect(head.querySelectorAll('.pbl-absence')).toHaveLength(2);
		expect(head.style.getPropertyValue('--pbl-lane-sublanes')).toBe('2');
		// **The count is not the mechanism.** Two marks and a `2` both survive deleting the
		// per-mark index wiring entirely — the marks then stack on ONE line inside a header
		// grown for two, which is 4a's promise ("two stretches that share a day are two marks
		// on two lines") broken with nothing red. The index each mark carries is what the
		// stylesheet turns into a line (`.pbl-absence`'s `top`), so it is what gets asserted.
		const marks = Array.from(head.querySelectorAll<HTMLElement>('.pbl-absence'));
		expect(marks.map((mark) => mark.style.getPropertyValue('--pbl-sublane'))).toEqual(['0', '1']);
	});

	it('counts for nothing on the header, and takes no stripe', () => {
		const { containerEl } = laneRoadmap(absenceVault());

		// Result bars only, the rule a context row already keeps. No absence half here
		// because `absenceVault`'s stretch ENDED (2026-08-06) and only pending ones are
		// counted — the readout's own cases are driven in `resourceLanes.test.ts`.
		expect(laneCountOf(lanesOf(containerEl)[0])).toBe('1 item');
		// The stripe alternates over WORK rows: the header (marks included) is chrome, so
		// the one work row beneath it is still the first of its band.
		expect(containerEl.querySelectorAll('.pbl-row-even')).toHaveLength(0);
	});

	it('keeps the context menu on the mark, which is now the only route to it', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const mark = containerEl.querySelector<HTMLElement>('.pbl-lane-head .pbl-absence');

		mark?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['Edit absence', 'Delete absence']);
	});

	it('lets a drop on the MARK still reach the band it sits in', async () => {
		// The mark is a CHILD of a registered element rather than a sibling drawing into the
		// band, so dragover and drop bubble to the header. That is the whole mechanism, and
		// its absence is `docs/bugs/An absence stretch is a dead spot in its own band.md`.
		const vault = absenceVault();
		vault.addFile('Bob away.md', {
			frontmatter: { type: 'Absence', assignee: 'Bob', start: '2026-08-04', due: '2026-08-06' },
		});
		const { containerEl } = laneRoadmap(vault);
		const mark = lanesOf(containerEl)[1].querySelector<HTMLElement>('.pbl-absence');
		if (mark === null) throw new Error('no mark to drop on');

		cardDrag(barFor(containerEl, 'Work'), mark);
		await flush();

		expect(vault.fm('Work.md')['assignee']).toBe('Bob');
	});

	it('grows the window to hold itself, in a row nothing else draws in', () => {
		// The window was every drawn BAR and an absence is not one, so a stretch beyond the
		// bars' reach was clamped to the edge and painted on a day it does not cover. Worst
		// exactly here — a row minted BY an absence holds no bar, so nothing it exists to
		// draw had any say in the window it is drawn against.
		const vault = new FakeVault();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
		});
		vault.addFile('Quinn away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2026-11-04', due: '2026-11-20' },
		});
		const { containerEl } = laneRoadmap(vault);
		const away = containerEl.querySelector<HTMLElement>('.pbl-absence');

		// 17 days inclusive, at the scale's own day width — the true span, not the one-day
		// stripe a clamp leaves. And nothing about it says "beyond what is drawn", because
		// the window now reaches it.
		expect(away?.style.getPropertyValue('--pbl-bar-width')).toBe(`${17 * 4}px`);
		expect(away?.className).toBe('pbl-absence');
	});

	it('says "beyond what is drawn" where the grid refuses to reach it', () => {
		// The window grows to hold an absence now, so the only thing that can still put one
		// outside it is `MAX_TIMELINE_DAYS` — a plan too long to draw whole, clamped around
		// today. That case is rarer than it was and not gone, which is why the mark reads
		// its own geometry rather than resting on the window fix: a filled stripe on a
		// calendar claims THESE are the days, exactly as a bar does.
		const vault = new FakeVault();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2020-01-01', due: '2032-01-01' },
		});
		vault.addFile('Quinn away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2031-01-04', due: '2031-01-20' },
		});
		vault.addFile('Early away.md', {
			frontmatter: { type: 'Absence', assignee: 'Early', start: '2020-02-01', due: '2020-02-10' },
		});
		const { containerEl } = laneRoadmap(vault);
		const marks = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-absence'));

		// Past the far edge and past the near one — the same open-end vocabulary a bar wears,
		// so the direction it lies in is still readable.
		expect(marks.map((el) => el.className)).toEqual([
			'pbl-absence pbl-bar-outside pbl-bar-open-end',
			'pbl-absence pbl-bar-outside pbl-bar-open-start',
		]);
	});

	it('gives every clamped mark a line of its own, so one cannot bury another', () => {
		// `packAbsences` answers about DAYS: two stretches beyond the same edge do not
		// overlap, so it puts them in one sub-lane — and `barGeometry` clamps both to that
		// edge, so they draw as one `MIN_BAR_PX` stripe on one pixel. The later covered the
		// earlier outright, taking its tooltip and the only route to Edit and Delete with
		// it. Two months apart in the note and the same rectangle on screen, which is why
		// the pack alone could never see it.
		const vault = new FakeVault();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2020-01-01', due: '2032-01-01' },
		});
		vault.addFile('First away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2031-01-04', due: '2031-01-20' },
		});
		vault.addFile('Second away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2031-03-01', due: '2031-03-10' },
		});
		const { containerEl } = laneRoadmap(vault);
		const head = lanesOf(containerEl)[laneNames(containerEl).indexOf('Quinn')];
		const marks = Array.from(head.querySelectorAll<HTMLElement>('.pbl-absence'));

		// The premise: both are past the same edge, so nothing about their POSITION can
		// tell them apart — same left, same width, and the same direction claimed.
		expect(marks.map((el) => el.className)).toEqual([
			'pbl-absence pbl-bar-outside pbl-bar-open-end',
			'pbl-absence pbl-bar-outside pbl-bar-open-end',
		]);
		expect(new Set(marks.map((el) => el.style.getPropertyValue('--pbl-bar-left'))).size).toBe(1);
		// So the LINE is what has to separate them, and the header has to have grown for it.
		expect(marks.map((el) => el.style.getPropertyValue('--pbl-sublane'))).toEqual(['0', '1']);
		expect(head.style.getPropertyValue('--pbl-lane-sublanes')).toBe('2');
	});

	it('marks a stretch the window cuts through as running past whichever edge it crosses', () => {
		const vault = new FakeVault();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2020-01-01', due: '2032-01-01' },
		});
		// One straddling the clamped window's far end, one its near end — each has an end
		// inside the grid and an end past it, in opposite directions.
		vault.addFile('Quinn away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2026-08-01', due: '2031-01-20' },
		});
		vault.addFile('Early away.md', {
			frontmatter: { type: 'Absence', assignee: 'Early', start: '2020-02-01', due: '2026-08-20' },
		});
		const { containerEl } = laneRoadmap(vault);
		const marks = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-absence'));

		expect(marks.map((el) => el.className)).toEqual([
			'pbl-absence pbl-bar-open-end pbl-bar-clipped-end',
			'pbl-absence pbl-bar-open-start',
		]);
	});

	it('names every stretch on the header, since none of them has a row any more', () => {
		// The accessibility cost of one-row-per-person, stated as a check rather than only in
		// the register: three rows each with a name become one description with three in it.
		const { containerEl } = laneRoadmap(absenceVault());

		// The fixture's note carries the name the create path derives, so the range is in the
		// title already and is stated ONCE. Appended unconditionally — as it was until the
		// title became derived — this reads `Alice away 2026-08-04 → 2026-08-06 2026-08-04 →
		// 2026-08-06`, on the only per-stretch channel a screen reader has left.
		expect(lanesOf(containerEl)[0].getAttribute('aria-description')).toBe(`Unavailable: ${ALICE_AWAY}`);
	});

	it('says the range once on the mark’s own tooltip too, which is where the name is legible', () => {
		const { containerEl } = laneRoadmap(absenceVault());
		const mark = containerEl.querySelector<HTMLElement>('.pbl-lane-head .pbl-absence');

		expect(mark?.dataset.tooltip).toBe(ALICE_AWAY);
	});

	it('still states the range for a note whose name does not carry it', () => {
		// The case the append was written for and the reason it is a condition rather than a
		// deletion: a note named before the title was derived, or one a reader named by hand,
		// says nothing about when. Asked of the PRODUCER — a title equal to what `absenceTitle`
		// derives from the same three facts — never of the string's shape.
		const vault = new FakeVault();
		vault.addFile('Offsite.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
		});
		const { containerEl } = laneRoadmap(vault);

		const said = 'Offsite — 2026-08-04 → 2026-08-06';
		expect(lanesOf(containerEl)[0].getAttribute('aria-description')).toBe(`Unavailable: ${said}`);
		expect(containerEl.querySelector<HTMLElement>('.pbl-absence')?.dataset.tooltip).toBe(said);
	});

	it('lists the stretches in the order the marks are actually drawn', () => {
		// The description walked `lane.absences` — model order — while the marks draw in
		// PACKED order, so a reader hearing "the first one" and a reader seeing the top line
		// were told about two different stretches.
		const vault = absenceVault();
		vault.addFile('Alice away 2026-08-05 → 2026-08-08.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-05', due: '2026-08-08' },
		});
		const { containerEl } = laneRoadmap(vault);
		const head = lanesOf(containerEl)[0];
		const drawn = Array.from(head.querySelectorAll<HTMLElement>('.pbl-absence')).map((mark) => mark.dataset.tooltip);

		expect(head.getAttribute('aria-description')).toBe(`Unavailable: ${drawn.join('; ')}`);
	});

	it('draws nothing at all with one date property configured', () => {
		// 4d, at the surface: not a one-ended bar from the key that survives.
		const { containerEl } = laneRoadmap(absenceVault(), { targetProperty: null });

		expect(containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
		expect(containerEl.querySelectorAll('.pbl-absence-row')).toHaveLength(0);
	});

	it('never draws on the other two axes', () => {
		const harness = laneRoadmap(absenceVault(), { horizonProperty: 'note.horizon' });

		harness.view.setAxisPick('dates');
		expect(harness.containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
		harness.view.setAxisPick('horizons');
		expect(harness.containerEl.querySelectorAll('.pbl-absence')).toHaveLength(0);
	});
});
