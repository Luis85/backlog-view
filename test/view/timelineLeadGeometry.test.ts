// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, treeOf, useViewHarness } from '../helpers/view';
import { MAX_TIMELINE_LEAD_PX } from '../../src/storage/collapseStore';
import { MIN_DAY_TRACK_PX } from '../../src/view/interactions/timelineLeadResize';
import { TIMELINE_LEAD_PX } from '../../src/view/render/timeline';
import { addDays, daysBetween, formatCivil, scaleFor, timelineCells } from '../../src/domain/timeline';
import { readDate, todayStamp } from '../../src/domain/noteFields';

useViewHarness();

/**
 * The full-height marks the lead width is baked INTO, asked at a width that is not the
 * default. `renderTimeline` resolves the drawn width once and threads it to the CSS
 * custom property, the gridlines, the milestone lines and the today line precisely so
 * the stylesheet and the arithmetic cannot name different numbers — the 17px mismatch
 * commit 791e1da fixed. Every other positional assertion in this suite's neighbours
 * renders at `TIMELINE_LEAD_PX`, where hard-coding that constant back into either
 * loop is invisible: the mark lands where it always did.
 *
 * So the fixture is deliberately a pane-CLAMPED width — a stored 480 in a 350px pane
 * draws at 270 — which is a number no constant in the module spells, and both marks
 * are asserted absolutely rather than against each other or against the today line,
 * which carries the same term and would shift with them.
 */

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };
const SCALE = scaleFor('month');
/** `todayCivil()` reads the same live clock, so the window always contains this day. */
const TODAY = readDate(todayStamp()).value ?? { year: 2026, month: 1, day: 1 };
/** Far enough from today that the milestone line takes no coincidence nudge. */
const MILESTONE = addDays(TODAY, 10);

/** A dated item plus a milestone inside the window — one of each mark, at one zoom. */
function markedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-20' } });
	vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, target: formatCivil(MILESTONE) } });
	return vault;
}

function leftOf(containerEl: HTMLElement, selector: string, property: string): number {
	const el = containerEl.querySelector<HTMLElement>(selector);
	if (!el) throw new Error(`not rendered: ${selector}`);
	return Number.parseFloat(el.style.getPropertyValue(property));
}

describe('what the resolved lead width places, at a width that is not the default', () => {
	/** A 350px pane clamping a stored 480 — an effective width of 270. */
	function clampedRoadmap() {
		const { view, containerEl } = makeView(markedVault(), DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');
		Object.defineProperty(treeOf(containerEl), 'clientWidth', { value: 350, configurable: true });
		view.setLeadWidth(MAX_TIMELINE_LEAD_PX);
		return { view, containerEl };
	}

	const EFFECTIVE = 350 - MIN_DAY_TRACK_PX;

	it('draws the first gridline from the width the render resolved, not from the default', () => {
		const { view, containerEl } = clampedRoadmap();
		const window = view.roadmap?.window;
		if (!window) throw new Error('no timeline window');

		// The number the drawn column, the announced value and the marks must all agree
		// on — stated once here so a divergence names itself.
		expect(EFFECTIVE).not.toBe(TIMELINE_LEAD_PX);
		expect(leftOf(containerEl, '.pbl-timeline-content', '--pbl-tl-lead')).toBe(EFFECTIVE);

		// No line at day 0 — that boundary is the lead column's own border — so the first
		// one sits a whole first cell past the column.
		const firstCell = timelineCells(window, SCALE)[0];
		expect(leftOf(containerEl, '.pbl-grid-line', '--pbl-grid-left')).toBe(EFFECTIVE + firstCell.days * SCALE.dayPx);
	});

	it('draws the milestone line from that same width', () => {
		const { view, containerEl } = clampedRoadmap();
		const window = view.roadmap?.window;
		if (!window) throw new Error('no timeline window');

		const day = daysBetween(window.start, MILESTONE);
		expect(leftOf(containerEl, '.pbl-milestone-line', '--pbl-milestone-left')).toBe(EFFECTIVE + day * SCALE.dayPx);
		// The LABEL is positioned inside the header's track, which starts past the lead
		// column — same variable, different origin, so it carries no lead term at all.
		expect(leftOf(containerEl, '.pbl-milestone-label', '--pbl-milestone-left')).toBe(day * SCALE.dayPx);
	});
});
