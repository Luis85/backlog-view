import { setTooltip } from 'obsidian';
import { RowContext } from './columns';
import { createCard, wireCardActivation } from './board';
import { renderBadge, renderTitleText } from './rows';
import { BacklogItem } from '../../domain/model';
import { TimelineBar } from '../../domain/roadmap';
import {
	BarGeometry,
	barGeometry,
	DAY_PX,
	daysBetween,
	formatCivil,
	timelineWindow,
	TimelineWindow,
} from '../../domain/timeline';
import { CivilDate } from '../../domain/noteFields';

/**
 * The dated axis: a month grid at its true day lengths, one row per placed
 * result, a bar per row stating exactly the dates the note states, and the today
 * line — the one thing on the grid that is the reader's own. Fixed month scale
 * for now; the discrete zooms and jump-to-today are the timeline feature's work.
 */

/** Width of the sticky lead column naming each row. Published to CSS below. */
const TIMELINE_LEAD_PX = 220;

/** What the timeline pass hands back: the rows in reading order, and where today sits. */
export interface TimelineRender {
	cards: BacklogItem[];
	/** Pixel offset of the today line from the grid's left edge. */
	todayLeft: number;
}

export function renderTimeline(
	ctx: RowContext,
	containerEl: HTMLElement,
	bars: TimelineBar[],
	today: CivilDate,
): TimelineRender {
	const window = timelineWindow(bars.map((bar) => bar.span), today);
	const grid = containerEl.createDiv({ cls: 'pbl-timeline' });
	grid.setCssProps({
		'--pbl-tl-lead': `${TIMELINE_LEAD_PX}px`,
		'--pbl-tl-days': `${window.days * DAY_PX}px`,
	});
	renderMonthHeader(grid, window);
	for (const bar of bars) renderBarRow(ctx, grid, window, bar);
	const todayLeft = TIMELINE_LEAD_PX + todayOffset(window, today);
	const line = grid.createDiv({ cls: 'pbl-today', attr: { 'aria-hidden': 'true' } });
	line.setCssProps({ '--pbl-today-left': `${todayLeft}px` });
	setTooltip(line, `Today — ${formatCivil(today)}`);
	return { cards: bars.map((bar) => bar.item), todayLeft };
}

/** Presentational, like the tree's column header: every row carries its own dates. */
function renderMonthHeader(grid: HTMLElement, window: TimelineWindow): void {
	const header = grid.createDiv({ cls: 'pbl-timeline-header', attr: { 'aria-hidden': 'true' } });
	header.createDiv({ cls: 'pbl-timeline-lead' });
	const track = header.createDiv({ cls: 'pbl-timeline-track' });
	for (const month of window.months) {
		const cell = track.createDiv({ cls: 'pbl-timeline-month', text: month.label });
		cell.setCssProps({ '--pbl-month-w': `${month.days * DAY_PX}px` });
	}
}

function renderBarRow(ctx: RowContext, grid: HTMLElement, window: TimelineWindow, bar: TimelineBar): void {
	const row = createCard(ctx, grid, bar.item);
	row.addClass('pbl-timeline-row');
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	renderBadge(ctx.host, lead, bar.item);
	const title = lead.createDiv({ cls: 'pbl-card-title' });
	renderTitleText(ctx.host, title, bar.item.title);
	setTooltip(lead, bar.item.title);

	const track = row.createDiv({ cls: 'pbl-timeline-track' });
	const geometry = barGeometry(window, bar.span);
	const el = track.createDiv({ cls: barClasses(bar, geometry) });
	el.setCssProps({
		'--pbl-bar-left': `${geometry.startDay * DAY_PX}px`,
		'--pbl-bar-width': `${Math.max(geometry.spanDays * DAY_PX, DAY_PX)}px`,
	});
	const dates = spanText(bar);
	el.setAttribute('aria-label', dates);
	setTooltip(el, dates);
	wireCardActivation(ctx, row, bar.item);
}

/**
 * A dateless end is styled open — the plan's gap stays visible instead of being
 * filled in — and an end past the window's edge is styled the same way: both say
 * "this continues beyond what is drawn", and the tooltip carries the exact dates.
 *
 * An inferred bar is a different claim: it HAS dates, but the view drew them from
 * below rather than reading them off the note, so it is outlined rather than
 * filled and never reads as a plan somebody stated.
 *
 * ponytail: one class covers "inferred" and "inferred, some children undated" —
 * an inferred end is uncertain by construction. Split them when someone can
 * describe the two pixels apart.
 */
function barClasses(bar: TimelineBar, geometry: BarGeometry): string {
	let cls = 'pbl-bar';
	if (geometry.milestone) cls += ' pbl-bar-milestone';
	if (bar.span.start === null || geometry.clippedStart) cls += ' pbl-bar-open-start';
	if (bar.span.target === null || geometry.clippedEnd) cls += ' pbl-bar-open-end';
	if (bar.inferredStart || bar.inferredEnd) cls += ' pbl-bar-inferred';
	return cls;
}

function spanText(bar: TimelineBar): string {
	const span = bar.span;
	const inferred = bar.inferredStart || bar.inferredEnd ? ' — inferred from children' : '';
	if (span.start !== null && span.target !== null) {
		if (formatCivil(span.start) === formatCivil(span.target)) return `Milestone ${formatCivil(span.start)}${inferred}`;
		return `${formatCivil(span.start)} → ${formatCivil(span.target)}${inferred}`;
	}
	if (span.start !== null) return `Starts ${formatCivil(span.start)}, target not set${inferred}`;
	// deriveBars admits no fully dateless span, so the remaining end exists.
	return `Target ${formatCivil(span.target as CivilDate)}, start not set${inferred}`;
}

function todayOffset(window: TimelineWindow, today: CivilDate): number {
	const days = Math.min(Math.max(daysBetween(window.start, today), 0), window.days - 1);
	return days * DAY_PX;
}
