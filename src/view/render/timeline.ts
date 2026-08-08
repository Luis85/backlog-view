import { setTooltip } from 'obsidian';
import { RowContext } from './columns';
import { createCard, wireCardActivation } from './board';
import { renderBadge, renderTitleText } from './rows';
import { CardDragController } from '../interactions/cardDrag';
import { effectiveLeadWidth, renderLeadResize } from '../interactions/timelineLeadResize';
import { DrawnColors } from '../host';
import { BacklogItem } from '../../domain/model';
import { barHolds, TimelineBar } from '../../domain/bars';
import { isMarkerType } from '../../domain/itemTypes';
import { stateColorSlot } from '../../domain/settings';
import {
	BarGeometry,
	barGeometry,
	daysBetween,
	formatCivil,
	MIN_BAR_PX,
	superCells,
	timelineCells,
	TimelineCell,
	timelineWindow,
	TimelineScale,
	TimelineWindow,
	weekendOffsetDays,
} from '../../domain/timeline';
import { CivilDate } from '../../domain/noteFields';

/**
 * The dated axis: a grid of the active scale's cells at their true day lengths, one row
 * per placed result, a bar per row stating exactly the dates the note states, and the
 * today line — the one thing on the grid that is the reader's own.
 *
 * Everything positional is a length in DAYS multiplied by `scale.dayPx`; the two lengths
 * that are pixels — the bar floor and the sub-day nudge — do not scale, and keeping those
 * apart is the whole of what a zoom control gets wrong. The picker that chooses the scale
 * and the control that returns to today are the toolbar's.
 */

/**
 * DEFAULT width of the sticky lead column naming each row — drawn until a reader
 * drags the resize grip (`interactions/timelineLeadResize.ts`) or the Base is opened
 * for the first time, and what the grip's Home key returns to. The width actually
 * drawn is resolved ONCE per render, in `renderTimeline`, from the user's own pick
 * (`host.leadWidth`) or this default, and threaded everywhere this constant used to
 * be read directly — see that resolution's own comment for why: the CSS width and
 * the TS arithmetic that places the today line, the milestone lines and the
 * gridlines must never diverge, which is precisely the bug commit 791e1da fixed.
 */
export const TIMELINE_LEAD_PX = 220;

/**
 * Room reserved for a title beside its bar, in PIXELS — matches the label's CSS
 * budget (max-width 144px + 2×8px padding). Short of this at the window's right
 * edge, the label flips to the bar's left rather than truncating against nothing.
 */
const LABEL_RESERVE_PX = 160;

/** `.pbl-bar-milestone` / `.pbl-bar-outside` in `styles/timeline.css` — see `markWidth`. */
const MILESTONE_MARK_PX = 12;
const OUTSIDE_MARK_PX = 10;

/** What the timeline pass hands back: the rows, where today sits, and what scrolls. */
export interface TimelineRender {
	cards: BacklogItem[];
	/** Pixel offset of the today line from the grid's left edge. */
	todayLeft: number;
	/** The element that scrolls — both axes, on this projection. */
	scroller: HTMLElement;
	/** The positioned layer inside it; full-height marks and the overlay live here. */
	content: HTMLElement;
	/** The window the grid drew, for the drag's px↔date and for the zoom anchor. */
	window: TimelineWindow;
	/** The one drop target spanning the day area — see `renderTimeline`'s own comment. */
	overlay: HTMLElement;
	/** The header's day track: where a placement's preview is drawn, having no row yet. */
	headerTrack: HTMLElement;
	/** Each drawn row's day track, by path — where a MOVE's preview is drawn, in its own row. */
	tracks: Map<string, HTMLElement>;
	/** The lead width THIS render actually drew — the resolved pick, or `TIMELINE_LEAD_PX`. */
	leadWidth: number;
	/**
	 * Which override colours this pass actually drew, OR'd across every bar — reported
	 * from the render rather than recomputed from `results` (see `renderBarRow`):
	 * `barClasses` decides a mark's actual colour, including the early-return
	 * `.pbl-bar-outside` case that draws the plain accent for a marker whose date lies
	 * outside the capped window — a fact a predicate over `results` alone cannot see,
	 * since it never asks what geometry the bar drew.
	 */
	drawn: DrawnColors;
}

/** What `renderTimeline` needs beyond the bars themselves — grouped to stay in budget. */
export interface TimelineDrawing {
	today: CivilDate;
	scale: TimelineScale;
	/** The controller every bar's grips are wired through — the same one the shelf uses. */
	dnd: CardDragController;
	/**
	 * The vocabulary `stateColorSlot` indexes a bar's colour into — passed down by
	 * `renderRoadmap`, which already holds the non-null model this axis draws from,
	 * rather than re-read here off `ctx.host.model`: a bar exists only because a model
	 * did, so a second null check here would guard nothing reachable.
	 */
	observedStates: string[];
	/**
	 * The pane's own measured width, in pixels — `renderRoadmap`'s `treeEl.clientWidth`,
	 * the same element `backlogView.ts`'s `ResizeObserver` watches, so a render and a
	 * resize-driven re-render agree on what "the space available" means. 0 or less reads
	 * as "not measured" — see `effectiveLeadWidth`.
	 */
	available: number;
}

export function renderTimeline(
	ctx: RowContext,
	containerEl: HTMLElement,
	bars: TimelineBar[],
	drawing: TimelineDrawing,
): TimelineRender {
	const { today, scale, dnd, observedStates, available } = drawing;
	const window = timelineWindow(bars.map((bar) => bar.span), today);
	// Resolved ONCE, here, and threaded everywhere `TIMELINE_LEAD_PX` used to be read
	// directly: the CSS width below and the TS arithmetic that places the today line,
	// the milestone lines and the gridlines all have to agree on the same number, or a
	// resize reopens the 17px mismatch commit 791e1da fixed. Clamped against the pane
	// (`effectiveLeadWidth`) so a wide stored pick cannot cover a narrow one edge to
	// edge — the STORED pick itself is untouched, only what this render draws.
	const stored = ctx.host.leadWidth ?? TIMELINE_LEAD_PX;
	const leadWidth = effectiveLeadWidth(stored, available);
	// TWO elements, not one. The scroll box is the outer one; the positioned layer is
	// the inner. Full-height marks — the today line, the milestone lines, and the drop
	// overlay that joins them — resolve `top: 0; bottom: 0` against their containing
	// block's PADDING box, which for a scroll container is its visible height rather
	// than its content height. Making the scroll box the containing block would make
	// every one of them viewport-tall and scroll away, leaving the lower rows crossed by
	// nothing. A line that stops partway down is worse than no line: it says the plan
	// divides there.
	const grid = containerEl.createDiv({ cls: 'pbl-timeline' });
	grid.toggleClass('pbl-density-compact', ctx.host.density === 'compact');
	const content = grid.createDiv({ cls: 'pbl-timeline-content' });
	content.setCssProps({
		'--pbl-tl-lead': `${leadWidth}px`,
		'--pbl-tl-days': `${window.days * scale.dayPx}px`,
		// The stylesheet stops hard-coding 2px: the width is the scale's, because
		// `dayPx >= 2 * lineWidth` is what lets today's line and a coincident
		// milestone's both draw inside one day instead of one erasing the other.
		'--pbl-tl-line': `${scale.lineWidth}px`,
		'--pbl-day-px': `${scale.dayPx}px`,
	});
	// One layer, not one band per weekend: weekends are exactly 7-day periodic, so
	// the stylesheet repeats a 2-on/5-off gradient and TS publishes only the phase.
	// Week zoom alone — at 4px and 2px per day the stripes are noise, which is where
	// the surveyed tools stop shading too.
	if (scale.id === 'week') {
		const weekend = content.createDiv({ cls: 'pbl-weekend-layer', attr: { 'aria-hidden': 'true' } });
		weekend.setCssProps({ '--pbl-weekend-offset': `${weekendOffsetDays(window) * scale.dayPx}px` });
	}
	const headerTrack = renderCellHeader(ctx, content, window, scale, { width: leadWidth, available });
	renderGridLines(content, window, scale, leadWidth);
	// Before the rows, so the bars — positioned elements later in the DOM — paint over
	// them. A line says what falls either side of a date; a bar is the thing being asked
	// about, and must not be obscured by the question.
	// Reported, because a milestone's LINE is cyan whatever its bar does: the done
	// override repaints the diamond green and leaves the line alone, so a grid whose only
	// marker is done draws cyan that no diamond accounts for. Asking the bars alone left
	// that line unkeyed.
	const milestoneLines = renderMilestoneLines({ grid: content, headerTrack }, window, bars, today, { scale, leadWidth });
	const tracks = new Map<string, HTMLElement>();
	const mounts: BarRowMounts = { content, scroller: grid, dnd, tracks, observedStates };
	const drawn: DrawnColors = { done: false, milestone: milestoneLines, accent: false };
	bars.forEach((bar, index) => {
		const { row, colors } = renderBarRow(ctx, mounts, window, bar, scale);
		if (colors.done) drawn.done = true;
		if (colors.milestone) drawn.milestone = true;
		if (colors.accent) drawn.accent = true;
		// Assigned at render because CSS has no nth-of-class, and nth-child would
		// count the header, the lines and the layers interleaved in this container.
		if (index % 2 === 1) row.addClass('pbl-row-even');
	});
	const todayLeft = leadWidth + todayOffset(window, today, scale);
	const line = content.createDiv({ cls: 'pbl-today', attr: { 'aria-hidden': 'true' } });
	line.setCssProps({ '--pbl-today-left': `${todayLeft}px` });
	setTooltip(line, `Today — ${formatCivil(today)}`);
	// One overlay over the day area, spanning the full height of the CONTENT (which is
	// at least the scrollport, so the blank grid below the last row — the state every
	// fresh backlog starts in — is a drop target too). Positioned past the sticky lead
	// column in CSS, so the exclusion the pointer conversion depends on is structural
	// rather than a constant kept in step with the stylesheet.
	//
	// It takes pointer events only while a drag is LIVE, so it never sits between the
	// reader and a bar's grips: the empty shelf's own trick — in the DOM so a drop has
	// somewhere to land, out of the way until a drag needs it — reached by a second
	// surface. `interactions/timelineDrag.ts` decides what a position on it means.
	const overlay = content.createDiv({ cls: 'pbl-timeline-drop', attr: { 'aria-hidden': 'true' } });
	return {
		cards: bars.map((bar) => bar.item),
		todayLeft,
		scroller: grid,
		content,
		window,
		overlay,
		headerTrack,
		tracks,
		leadWidth,
		drawn,
	};
}

/**
 * The cell tiers are presentational, like the tree's column header: every row
 * carries its own dates, so the month/quarter labels add nothing a screen reader
 * needs. The LEAD cell is not: it now carries the resize grip, a real control, so
 * `aria-hidden` sits on the tiers alone rather than the whole header — an
 * `aria-hidden` ancestor removes every focusable descendant from the accessibility
 * tree along with the decoration, and this cell is no longer only decoration.
 *
 * Returns the cell tier alone — `TimelineRender.headerTrack`, where the milestone
 * labels and the drop ghost mount. It once also handed back an empty band reserved
 * for the Today pill; the legend strip above the grid took over naming the today
 * line's colour, so the pill and its band are gone and this is a plain track again.
 */
function renderCellHeader(
	ctx: RowContext,
	content: HTMLElement,
	window: TimelineWindow,
	scale: TimelineScale,
	// `available` rides along only so the grip can state a real `aria-valuemax` — see
	// `renderLeadResize`.
	lead: { width: number; available: number },
): HTMLElement {
	const header = content.createDiv({ cls: 'pbl-timeline-header' });
	const leadEl = header.createDiv({ cls: 'pbl-timeline-lead' });
	renderLeadResize(ctx.host, leadEl, content, { current: lead.width, defaultWidth: TIMELINE_LEAD_PX, available: lead.available });
	// Two stacked tiers in the track slot: the coarser orientation tier, then the cells.
	const tiers = header.createDiv({ cls: 'pbl-timeline-tiers', attr: { 'aria-hidden': 'true' } });
	renderHeaderTier(tiers, superCells(window, scale), scale, 'pbl-timeline-super', 'pbl-timeline-cell pbl-timeline-cell-super');
	return renderHeaderTier(tiers, timelineCells(window, scale), scale, '', 'pbl-timeline-cell');
}

function renderHeaderTier(
	tiers: HTMLElement,
	cells: TimelineCell[],
	scale: TimelineScale,
	trackCls: string,
	cellCls: string,
): HTMLElement {
	const track = tiers.createDiv({ cls: `pbl-timeline-track${trackCls ? ' ' + trackCls : ''}` });
	for (const cell of cells) {
		const cellEl = track.createDiv({ cls: cellCls, text: cell.label });
		cellEl.setCssProps({ '--pbl-cell-w': `${cell.days * scale.dayPx}px` });
	}
	return track;
}

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
		// The label sits in the header band, where the month header already is, and the
		// full name stays in the tooltip: horizontal space is the scarce resource in an
		// Obsidian pane, so the line survives the narrowing and the text is what gives way.
		// Same variable, different origin: the line is positioned in the grid, which
		// includes the sticky lead column, and the label inside the track, which does not.
		const label = names.join(' · ');
		const labelEl = headerTrack.createDiv({ cls: 'pbl-milestone-label', text: label });
		labelEl.setCssProps({ '--pbl-milestone-left': `${day * scale.dayPx + nudge}px` });
		setTooltip(labelEl, label);
	}
	return byDay.size > 0;
}

/**
 * The header's cell boundaries, extended down the grid body — decoration only,
 * drawn before the milestone lines so a boundary never paints over a mark that
 * means something. No line at day 0: that boundary is the lead column's border.
 */
function renderGridLines(content: HTMLElement, window: TimelineWindow, scale: TimelineScale, leadWidth: number): void {
	let day = 0;
	for (const cell of timelineCells(window, scale)) {
		day += cell.days;
		if (day >= window.days) break;
		const line = content.createDiv({ cls: 'pbl-grid-line', attr: { 'aria-hidden': 'true' } });
		line.setCssProps({ '--pbl-grid-left': `${leadWidth + day * scale.dayPx}px` });
	}
}

/** Where a bar's grips land and how they are wired — grouped to stay under max-params. */
interface BarRowMounts {
	content: HTMLElement;
	/** The element that actually scrolls, for a grip's own pan baseline. */
	scroller: HTMLElement;
	dnd: CardDragController;
	/** Filled as each row draws, so a move's preview can be mounted in its own row. */
	tracks: Map<string, HTMLElement>;
	/** See `TimelineDrawing.observedStates`. */
	observedStates: string[];
}

function renderBarRow(
	ctx: RowContext,
	mounts: BarRowMounts,
	window: TimelineWindow,
	bar: TimelineBar,
	scale: TimelineScale,
): { row: HTMLElement; colors: DrawnColors } {
	const row = createCard(ctx, mounts.content, bar.item);
	row.addClass('pbl-timeline-row');
	// The bar's colour, by the item's own state — never computed here: `stateColorSlot`
	// is the one place that decides a slot, so a bar and the Set state menu cannot name
	// a state a different colour. No slot (no state, or a value the vocabulary does not
	// carry) adds no class, and the bar keeps its plain accent — `styles/timeline.css`
	// owns what a slot actually paints, mirroring the level badge's TS-adds-the-class,
	// CSS-owns-the-colour split.
	const slot = stateColorSlot(ctx.host.settings, mounts.observedStates, bar.item.stateValue);
	if (slot !== null) row.addClass(`pbl-state-${slot}`);
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	renderBadge(ctx.host, lead, bar.item);
	const title = lead.createDiv({ cls: 'pbl-card-title' });
	renderTitleText(ctx.host, title, bar.item.title);
	setTooltip(lead, bar.item.title);

	const track = row.createDiv({ cls: 'pbl-timeline-track' });
	mounts.tracks.set(bar.item.file.path, track);
	const geometry = barGeometry(window, bar.span);
	// Asked ONCE, of `barHolds`, shared by the class that advertises a body drag and
	// the loop that actually wires one — so what the cursor promises and what a drop
	// registers cannot disagree. The body hold IS the bar; the grips are its two edges.
	const holds = barHolds(bar.item, ctx.host.settings, bar);
	const el = track.createDiv({ cls: barClasses(bar, geometry, holds.includes('body')) });
	el.setCssProps({
		'--pbl-bar-left': `${geometry.startDay * scale.dayPx}px`,
		'--pbl-bar-width': `${Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX)}px`,
	});
	const dates = spanText(bar);
	el.setAttribute('aria-label', dates);
	setTooltip(el, dates);
	for (const hold of holds) {
		const grip = hold === 'body' ? el : el.createDiv({ cls: `pbl-bar-grip pbl-bar-grip-${hold}` });
		grip.dataset.pblHold = hold;
		// The scroller's offset at drag start rides the payload, for the delta a hold
		// measures — see `CardSource.scrollLeft` and `interactions/timelineDrag.ts`.
		mounts.dnd.wireCard(grip, bar.item, hold, () => mounts.scroller.scrollLeft);
	}
	renderBarLabel(track, bar, geometry, scale, window);
	// Said in words on the row itself, because on this axis the state is otherwise a
	// bar COLOUR and nothing else — see `stateNote`.
	const state = stateNote(ctx.host.settings.stateKey, bar.item);
	if (state) row.createSpan({ cls: 'pbl-sr-only', text: state });
	// The row is the timeline's one selection stop, so a MARKER'S row is where the
	// line and the diamond's facts have to be readable (criterion 4a: neither is
	// focusable, so nothing about a milestone may exist only under a hover). An
	// ordinary row is left to its content-derived name — badge, title, and the bar's
	// own `aria-label` above, which the accessible-name computation already folds
	// in — the same reason `createCard`'s outside marker uses `aria-description`
	// rather than `aria-label`: an explicit label REPLACES that name instead of
	// adding to it, and would cost every dated row its type word for a fact the bar
	// already states.
	// A marker's explicit label REPLACES the row's content, the hidden state span
	// above included, so the same words are folded into it rather than lost.
	if (isMarkerType(bar.item.typeName)) {
		row.setAttribute('aria-label', `${bar.item.title} — ${dates}${state ? ` — ${state}` : ''}`);
	}
	wireCardActivation(ctx, row, bar.item);
	// The same three overrides `styles/timeline.css` gives a bar, asked in the same
	// order: done wins outright (the row class overrides regardless of geometry), then
	// a milestone diamond only where `barClasses` actually added `pbl-bar-milestone` —
	// never for `geometry.milestone` alone, since the early return for `geometry.outside`
	// withholds that class from a marker whose date lies outside the window, and that
	// bar draws the plain accent like any other. A bar can draw an ordinary PBI's own
	// coincident start/target as the same diamond (`timelineFurniture.test.ts`'s "Ship
	// it"), so this is asked of the geometry alone, never narrowed to marker items.
	const milestoneDrawn = geometry.milestone && !geometry.outside;
	const colors: DrawnColors = {
		done: bar.item.done,
		milestone: !bar.item.done && milestoneDrawn,
		accent: !bar.item.done && slot === null && !milestoneDrawn,
	};
	return { row, colors };
}

/**
 * The row's workflow state in words, or '' where there is none to say.
 *
 * This axis draws state as a bar COLOUR and nothing else: `renderStateChip`'s only call
 * site is the tree, and `chipProps` skips the state property, so without these words the
 * five slot colours are the whole of it — unreadable to a screen reader, and colour alone
 * for everyone else (WCAG 1.4.1). Done is spelt out for the same reason: `pbl-done` is a
 * class and a green bar.
 *
 * Visually hidden text in the ROW's content, not an `aria-label` anywhere. `.pbl-bar` is
 * a plain div — role `generic`, where ARIA prohibits an accessible name, so appending to
 * the label it already carries may be announced by nobody — and a label on the row would
 * REPLACE the badge and title the row derives its name from, which is exactly what
 * `renderBarRow` avoids for an ordinary row. Content adds to that name instead. It stays
 * out of the visible row on purpose: the layout is a lead column and a track, and a
 * sixth thing in the lead is what the colour was chosen to avoid.
 */
function stateNote(stateKey: string, item: BacklogItem): string {
	if (!stateKey) return '';
	const value = item.stateValue;
	if (item.done) return value === null ? 'Done' : `${value} — done`;
	return value ?? '';
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
 *
 * `hasBodyHold` is asked of `barHolds`, never re-derived here: a fully inferred bar,
 * a half-inferred one, and a marker with no writable target all withhold the body
 * hold, and a class computed independently from geometry alone would drift from
 * that list the moment a fourth case joined it. The class is what lets the
 * stylesheet scope the grab cursor to a bar that actually registers a drag —
 * `pbl-bar` alone would advertise a hold on every one of those.
 */
/**
 * How wide the mark actually DRAWS, which is what a label beside it has to clear.
 * `--pbl-bar-width` is not that number for two of the three shapes: `.pbl-bar-milestone`
 * is a 12px diamond and `.pbl-bar-outside` a 10px arrow whatever the span, so a
 * one-day milestone at quarter zoom measures 4px here and would have its title
 * painted across it. Same order of tests as `barClasses`, which is what decides
 * which shape is drawn — keep the two in step, and both in step with
 * `.pbl-bar-milestone` / `.pbl-bar-outside` in `styles/timeline.css`.
 *
 * The diamond's 45° rotation puts its tips ~2.5px outside this box; the label's own
 * 8px of padding is the clearance, so this stays the CSS width rather than a
 * bounding-box calculation nothing else in the file does.
 */
function markWidth(geometry: BarGeometry, scale: TimelineScale): number {
	if (geometry.outside) return OUTSIDE_MARK_PX;
	if (geometry.milestone) return MILESTONE_MARK_PX;
	return Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX);
}

/**
 * The title where the reader's eye already is — decoration only. The row's
 * accessible name carries the title and the bar's aria-label the dates, so this
 * is aria-hidden; pointer-events die in CSS so the grips never lose a hit.
 */
function renderBarLabel(
	track: HTMLElement,
	bar: TimelineBar,
	geometry: BarGeometry,
	scale: TimelineScale,
	window: TimelineWindow,
): void {
	const left = geometry.startDay * scale.dayPx;
	const width = markWidth(geometry, scale);
	const trackWidth = window.days * scale.dayPx;
	const after = left + width + LABEL_RESERVE_PX <= trackWidth;
	// Dropped whenever there is no room after the bar's right edge AND its start sits
	// within the reserve of the track's own left edge. That is a bar clipped at BOTH
	// window edges, but not only that: it is also a bar clipped at the right alone that
	// merely BEGINS within 160px of the left edge without being clipped there itself —
	// reachable whenever timelineWindow clamps to MAX_TIMELINE_DAYS. Either way, flipping
	// the label before such a bar would put it off the track behind the sticky lead
	// column. Nothing is lost by dropping it — the row's lead carries the same title,
	// which is what makes this decoration rather than content, and squeezing it over the
	// bar would only trade a hidden label for an unreadable one.
	if (!after && left < LABEL_RESERVE_PX) return;
	const label = track.createDiv({ cls: 'pbl-bar-label', text: bar.item.title, attr: { 'aria-hidden': 'true' } });
	if (after) {
		label.addClass('pbl-bar-label-after');
		label.setCssProps({ '--pbl-label-left': `${left + width}px` });
	} else {
		label.addClass('pbl-bar-label-before');
		label.setCssProps({ '--pbl-label-right': `${trackWidth - left}px` });
	}
}

function barClasses(bar: TimelineBar, geometry: BarGeometry, hasBodyHold: boolean): string {
	const holdable = hasBodyHold ? ' pbl-bar-holdable' : '';
	// Nothing of it is in view. Drawing the clamp would put a diamond at a date the item
	// does not have, and a diamond IS the claim that this is the date — so the row carries
	// only the direction it lies past, in the same open-end vocabulary a clipped bar uses.
	// The exact date is in the bar's tooltip and in the row's accessible name.
	if (geometry.outside) {
		// Provenance must not be silently upgraded: an inferred span that lands wholly
		// past the edge is still inferred, not a date the note stated, so the class
		// that says so travels with it into this branch too.
		const inferred = bar.inferredStart || bar.inferredEnd ? ' pbl-bar-inferred' : '';
		return `pbl-bar pbl-bar-outside ${geometry.clippedStart ? 'pbl-bar-open-start' : 'pbl-bar-open-end'}${inferred}${holdable}`;
	}
	let cls = 'pbl-bar';
	if (geometry.milestone) cls += ' pbl-bar-milestone';
	if (bar.span.start === null || geometry.clippedStart) cls += ' pbl-bar-open-start';
	if (bar.span.target === null || geometry.clippedEnd) cls += ' pbl-bar-open-end';
	if (bar.inferredStart || bar.inferredEnd) cls += ' pbl-bar-inferred';
	return cls + holdable;
}

/** One sentence about a span, said identically on the grid and in the drop ghost. */
export function spanText(bar: TimelineBar): string {
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

function todayOffset(window: TimelineWindow, today: CivilDate, scale: TimelineScale): number {
	const days = Math.min(Math.max(daysBetween(window.start, today), 0), window.days - 1);
	return days * scale.dayPx;
}
