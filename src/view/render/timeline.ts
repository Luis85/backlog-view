import { setTooltip } from 'obsidian';
import { RowContext } from './columns';
import { createCard, wireCardActivation } from './board';
import { renderBadge, renderTitleText } from './rows';
import { BacklogItem } from '../../domain/model';
import { TimelineBar } from '../../domain/roadmap';
import { isMarkerType } from '../../domain/itemTypes';
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
	const headerTrack = renderMonthHeader(grid, window);
	// Before the rows, so the bars — positioned elements later in the DOM — paint over
	// them. A line says what falls either side of a date; a bar is the thing being asked
	// about, and must not be obscured by the question.
	renderMilestoneLines(grid, headerTrack, window, bars, today);
	for (const bar of bars) renderBarRow(ctx, grid, window, bar);
	const todayLeft = TIMELINE_LEAD_PX + todayOffset(window, today);
	const line = grid.createDiv({ cls: 'pbl-today', attr: { 'aria-hidden': 'true' } });
	line.setCssProps({ '--pbl-today-left': `${todayLeft}px` });
	setTooltip(line, `Today — ${formatCivil(today)}`);
	return { cards: bars.map((bar) => bar.item), todayLeft };
}

/** Presentational, like the tree's column header: every row carries its own dates. */
function renderMonthHeader(grid: HTMLElement, window: TimelineWindow): HTMLElement {
	const header = grid.createDiv({ cls: 'pbl-timeline-header', attr: { 'aria-hidden': 'true' } });
	header.createDiv({ cls: 'pbl-timeline-lead' });
	const track = header.createDiv({ cls: 'pbl-timeline-track' });
	for (const month of window.months) {
		const cell = track.createDiv({ cls: 'pbl-timeline-month', text: month.label });
		cell.setCssProps({ '--pbl-month-w': `${month.days * DAY_PX}px` });
	}
	return track;
}

/** How far a milestone's line steps aside for today's, inside the same day cell. */
const TODAY_NUDGE_PX = 2;

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
function renderMilestoneLines(
	grid: HTMLElement,
	headerTrack: HTMLElement,
	window: TimelineWindow,
	bars: TimelineBar[],
	today: CivilDate,
): void {
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
		const nudge = day === todayDay ? TODAY_NUDGE_PX : 0;
		const line = grid.createDiv({ cls: 'pbl-milestone-line', attr: { 'aria-hidden': 'true' } });
		line.setCssProps({ '--pbl-milestone-left': `${TIMELINE_LEAD_PX + day * DAY_PX + nudge}px` });
		// The label sits in the header band, where the month header already is, and the
		// full name stays in the tooltip: horizontal space is the scarce resource in an
		// Obsidian pane, so the line survives the narrowing and the text is what gives way.
		// Same variable, different origin: the line is positioned in the grid, which
		// includes the sticky lead column, and the label inside the track, which does not.
		const label = names.join(' · ');
		const labelEl = headerTrack.createDiv({ cls: 'pbl-milestone-label', text: label });
		labelEl.setCssProps({ '--pbl-milestone-left': `${day * DAY_PX + nudge}px` });
		setTooltip(labelEl, label);
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
	// The row is the timeline's one selection stop, so a MARKER'S row is where the
	// line and the diamond's facts have to be readable (criterion 4a: neither is
	// focusable, so nothing about a milestone may exist only under a hover). An
	// ordinary row is left to its content-derived name — badge, title, and the bar's
	// own `aria-label` above, which the accessible-name computation already folds
	// in — the same reason `createCard`'s outside marker uses `aria-description`
	// rather than `aria-label`: an explicit label REPLACES that name instead of
	// adding to it, and would cost every dated row its type word for a fact the bar
	// already states.
	if (isMarkerType(bar.item.typeName)) row.setAttribute('aria-label', `${bar.item.title} — ${dates}`);
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
	// Nothing of it is in view. Drawing the clamp would put a diamond at a date the item
	// does not have, and a diamond IS the claim that this is the date — so the row carries
	// only the direction it lies past, in the same open-end vocabulary a clipped bar uses.
	// The exact date is in the bar's tooltip and in the row's accessible name.
	if (geometry.outside) {
		// Provenance must not be silently upgraded: an inferred span that lands wholly
		// past the edge is still inferred, not a date the note stated, so the class
		// that says so travels with it into this branch too.
		const inferred = bar.inferredStart || bar.inferredEnd ? ' pbl-bar-inferred' : '';
		return `pbl-bar pbl-bar-outside ${geometry.clippedStart ? 'pbl-bar-open-start' : 'pbl-bar-open-end'}${inferred}`;
	}
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
