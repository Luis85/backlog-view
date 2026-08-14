import { setTooltip } from 'obsidian';
import { TimelineBar } from '../../domain/bars';
import { isMarkerType } from '../../domain/itemTypes';
import { CivilDate } from '../../domain/noteFields';
import { barGeometry, daysBetween, TimelineScale, TimelineWindow } from '../../domain/timeline';

/**
 * The grid's one full-height mark that comes from the PLAN rather than from the reader:
 * a line down every row per milestone date, with its name in the header band.
 *
 * Its own module because `render/timeline.ts` is at the 400-line budget and this is the
 * piece with the least to do with the rest of it — the grid draws rows, and this draws
 * across all of them from a list of dates. Same move `render/barLabel.ts` and
 * `render/lanes.ts` already made, for the same reason.
 */

/**
 * A line down the whole plan per milestone DATE, behind the bars — a diamond says *when*,
 * a line says *what is on either side of it*, which is the question a deadline is actually
 * asked. The today line is the same shape, drawn once across the grid from a single date,
 * so this is a second instance of something that works rather than a drawing layer.
 *
 * Grouped by day, not by item: two lines a pixel apart read as one and quietly misreport
 * the count, so two milestones on a date are one line naming both. A milestone outside the
 * window draws none — `outside` says so, and a line at the edge would claim a date the
 * milestone does not have. Nothing here is focusable and nothing is written: the line is
 * decoration of a row, and every fact it shows is in that row's accessible name.
 */
export function renderMilestoneLines(
	mounts: { grid: HTMLElement; headerTrack: HTMLElement },
	window: TimelineWindow,
	bars: TimelineBar[],
	today: CivilDate,
	// `scale` and `leadWidth` grouped into one param — both are "how a day converts to a
	// pixel here", and the pair is what keeps this under the five-parameter budget.
	ruler: { scale: TimelineScale; leadWidth: number },
): boolean {
	const { grid, headerTrack } = mounts;
	const { scale, leadWidth } = ruler;
	// Insertion order is bar order, which is row order — so a shared line names its
	// milestones the way the rows read.
	const byDay = new Map<number, string[]>();
	for (const bar of bars) {
		if (!isMarkerType(bar.item.typeName)) continue;
		const geometry = barGeometry(window, bar.span);
		if (geometry.outside) continue;
		byDay.set(geometry.startDay, [...(byDay.get(geometry.startDay) ?? []), bar.item.title]);
	}
	const todayDay = daysBetween(window.start, today);
	for (const [day, names] of byDay) {
		// Today keeps its position and its place on top: it is the one mark on this grid
		// that is the reader's own, and no plan may hide *now*. The milestone's line is
		// what gives way, drawn beside it inside the same day cell — room the grid has,
		// since a day is wider than either mark.
		// A sub-day offset, so it is the SCALE's line width and never a constant: two
		// fixed pixels at two pixels per day is a whole day's displacement, putting the
		// line and its label in the day after the one they belong to. `dayPx >= 2 *
		// lineWidth` is what guarantees the step still fits inside the day it steps in.
		const nudge = day === todayDay ? scale.lineWidth : 0;
		const line = grid.createDiv({ cls: 'pbl-milestone-line', attr: { 'aria-hidden': 'true' } });
		line.setCssProps({ '--pbl-milestone-left': `${leadWidth + day * scale.dayPx + nudge}px` });
		// The label sits in the header band, and the full name stays in the tooltip:
		// horizontal space is the scarce resource in an Obsidian pane, so the line survives
		// the narrowing and the text is what gives way.
		//
		// **The COARSE tier, never the cell tier**, which is the one thing about this label
		// that was chosen rather than inherited. It is an opaque box `max-width: 140px` wide,
		// so whatever tier it lands in, it covers that tier's own labels from its date
		// rightward — and the cell tier carries one label per WEEK, so a milestone truncated
		// the date it sits on every single time (seen in a vault: `28 Sep` reading as `28 S`
		// under `Ship the roadmap epic`). The coarse tier carries one label per month or year,
		// so the same 140px usually covers nothing at all, and when it does the casualty is a
		// month name the tier below still spells out in days. That is a strictly smaller loss,
		// bought by moving one mount point — no extra header row, which
		// `docs/issues/Nearby milestone labels cover each other.md` weighs and declines for
		// crowding the sticky band.
		//
		// Same variable, different origin: the line is positioned in the grid, which
		// includes the sticky lead column, and the label inside the track, which does not.
		const label = names.join(' · ');
		const labelEl = headerTrack.createDiv({ cls: 'pbl-milestone-label', text: label });
		labelEl.setCssProps({ '--pbl-milestone-left': `${day * scale.dayPx + nudge}px` });
		setTooltip(labelEl, label);
	}
	return byDay.size > 0;
}
