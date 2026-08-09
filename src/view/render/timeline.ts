import { setIcon, setTooltip } from 'obsidian';
import { RowContext } from './columns';
import { createCard, wireCardActivation } from './board';
import { renderBadge, renderChevron, renderTitleText } from './rows';
import { dependencyNote, NO_CONFLICTS, renderDependencyArrows } from './timelineArrows';
import { CardDragController } from '../interactions/cardDrag';
import { wireBarLink, wireLinkPreview } from '../interactions/linkDrag';
import { effectiveLeadWidth, renderLeadResize } from '../interactions/timelineLeadResize';
import { BacklogViewHost, DrawnColors } from '../host';
import { BacklogItem } from '../../domain/model';
import { barHolds, ShelfCard, TimelineBar, TimelineRow } from '../../domain/bars';
import { dependencyArrows } from '../../domain/dependencies';
import { isMarkerType } from '../../domain/itemTypes';
import {
	ownWorkflowReading,
	paletteFor,
	paletteSlot,
	stateKeyFor,
	StatePalette,
	WorkflowReading,
} from '../../domain/board';
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
 * Exported for `test/view/timelineBoxing.test.ts`, which reads that budget out of
 * `styles/timelineFurniture.css` and refuses the two drifting apart.
 */
export const LABEL_RESERVE_PX = 160;

/** `.pbl-bar-milestone` / `.pbl-bar-outside` in `styles/timeline.css` — see `markWidth`. */
const MILESTONE_MARK_PX = 12;
const OUTSIDE_MARK_PX = 10;

/**
 * The narrowest an arrow may be drawn, in PIXELS — `MIN_BAR_PX`'s own reasoning (1f of
 * [[Arrows between bars]]): two ends with almost no room to route still draw, and a
 * length rounded to zero would report nothing.
 */

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
	/**
	 * Which of EACH dependent's prerequisites conflict, keyed by the dependent's own
	 * path — `dependencyArrows`' own `conflicts` map, unfiltered by anything this grid
	 * drew. It covers a shelved dependent too (2b): nothing on this grid draws one,
	 * since a shelved item has no bar, but the map is keyed by path either way, so
	 * `renderRoadmap` reads this SAME map to mark the shelf card, which is that
	 * dependent's row (1b) — one shape for both. See `dependencyArrows`.
	 */
	dependencyConflicts: ReadonlyMap<string, ReadonlySet<string>>;
}

/** What `renderTimeline` needs beyond the bars themselves — grouped to stay in budget. */
export interface TimelineDrawing {
	today: CivilDate;
	scale: TimelineScale;
	/** The controller every bar's grips are wired through — the same one the shelf uses. */
	dnd: CardDragController;
	/**
	 * The vocabularies `paletteSlot` indexes a bar's colour into — passed down by
	 * `renderRoadmap`, which already holds the non-null model this axis draws from,
	 * rather than re-read here off `ctx.host.model`: a bar exists only because a model
	 * did, so a second null check here would guard nothing reachable.
	 */
	palettes: StatePalette[];
	/**
	 * The pane's own measured width, in pixels — `renderRoadmap`'s `treeEl.clientWidth`,
	 * the same element and the same property `backlogView.ts`'s `ResizeObserver` branch
	 * measures, so the two normally read the same number for "the space available".
	 *
	 * Normally, not always: `renderRoadmap` measures AFTER `treeEl.empty()`, so a
	 * vertical scrollbar the pane had at resize time is gone at render time and the two
	 * differ by its width. `.pbl-roadmap-dates .pbl-tree` is `overflow-y: auto` as a
	 * deliberate fallback (a floor plus four maxima can exceed a short or embedded pane),
	 * so this is confined to that case, and it costs at most one extra rebuild — the
	 * resize branch's idempotence check fails once — and a day track reserved a scrollbar
	 * too narrow. 0 or less reads as "not measured" — see `effectiveLeadWidth`.
	 */
	available: number;
	/**
	 * The dated axis's shelf, so `dependencyArrows` can judge a shelved dependent's own
	 * stated start against a dated prerequisite (2b) — a question the drawn bars alone
	 * cannot answer, since a shelved dependent has none. Not drawn here; `renderRoadmap`
	 * draws the shelf itself, separately, after this pass.
	 */
	shelf: ShelfCard[];
}

export function renderTimeline(
	ctx: RowContext,
	containerEl: HTMLElement,
	rows: TimelineRow[],
	drawing: TimelineDrawing,
): TimelineRender {
	const { today, scale, dnd, palettes, available, shelf } = drawing;
	// What a collapsed row hides, it hides from the whole grid: the window is the drawn
	// spans, exactly as it already is for the spans hiding completed work removes.
	const bars = rows.map((row) => row.bar);
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
	// Computed ONCE, before any row exists, and from `bars`/`shelf` alone — never from
	// what the arrow layer below goes on to draw. That is what makes both consumers
	// window-independent: `dependencyArrows` never filters by the drawn window, so an
	// edge clear across the plan from where the reader is scrolled still names its
	// dependent's row and still marks it, exactly as one on screen does (1a/1b's "the
	// row is where the dependency still lives" — the guarantee a window-derived mark
	// would silently narrow). `dependencies.conflicts` covers a shelved dependent too
	// (2b): nothing on THIS grid draws one, since a shelved item has no bar, but the
	// map is keyed by the dependent's own path regardless, so the shelf's own card
	// (`TimelineRender.dependencyConflicts`, read by `renderRoadmap`) reads this exact
	// same map rather than a second one built for it.
	const dependencies = dependencyArrows(bars, shelf);
	// The layer is created HERE, before a single row, and filled after they all exist.
	// That ordering is what puts the arrows behind the bars, the milestone line's own
	// answer to the same question: a bar is positioned with no z-index of its own, so
	// what paints on top is decided by document order, and a layer appended after the
	// rows would draw across every bar it crosses. Filling it later is unavoidable —
	// an edge's Y comes from where the two rows actually landed — so the element and
	// its contents are deliberately separated in time.
	const arrowLayer = content.createSvg('svg', { cls: 'pbl-dependency-layer', attr: { 'aria-hidden': 'true' } });
	wireLinkPreview(ctx.host, dnd, content);
	const mounts: BarRowMounts = {
		content,
		scroller: grid,
		dnd,
		tracks,
		palettes,
		conflictedPrereqs: dependencies.conflicts,
	};
	const drawn: DrawnColors = { done: false, milestone: milestoneLines, accent: false };
	rows.forEach((entry, index) => {
		const { row, colors } = renderBarRow(ctx, mounts, window, entry, scale);
		if (colors.done) drawn.done = true;
		if (colors.milestone) drawn.milestone = true;
		if (colors.accent) drawn.accent = true;
		// Assigned at render because CSS has no nth-of-class, and nth-child would
		// count the header, the lines and the layers interleaved in this container.
		if (index % 2 === 1) row.addClass('pbl-row-even');
	});
	// After every row exists, never before: an edge's arrow anchors on the ROWS the
	// prerequisite and the dependent actually drew, and its Y comes from where those
	// rows really landed rather than a guessed row height — see `renderDependencyArrows`,
	// which draws from the same `dependencies.arrows` list computed above.
	renderDependencyArrows({ layer: arrowLayer, content, tracks }, window, dependencies.arrows, { scale, leadWidth });
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
		dependencyConflicts: dependencies.conflicts,
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
	/** Which of a dependent's prerequisites conflict, by the dependent's path — see `DependencyArrows.conflicts`. */
	conflictedPrereqs: ReadonlyMap<string, ReadonlySet<string>>;
	/** See `TimelineDrawing.palettes`. */
	palettes: StatePalette[];
}

function renderBarRow(
	ctx: RowContext,
	mounts: BarRowMounts,
	window: TimelineWindow,
	entry: TimelineRow,
	scale: TimelineScale,
): { row: HTMLElement; colors: DrawnColors } {
	const bar = entry.bar;
	// The item's OWN workflow, read ONCE and threaded through the three things on this row
	// that key a colour or say one in words: the slot class, the hidden state words, and
	// the `drawn` report the legend is built from. (`pbl-done` is the fourth and is no
	// longer passed — `createCard` asks the same question itself now, for every projection
	// that draws a card.) Reading `item.done` / `item.stateValue` here keyed a Deliverable
	// into the REQUIREMENTS workflow — a colour naming a state it does not hold, and
	// changing the state that IS its own moved nothing on the grid.
	const own = ownWorkflowReading(bar.item);
	const row = createCard(ctx, mounts.content, bar.item);
	row.addClass('pbl-timeline-row');
	// The marking loop reads this rather than matching titles: a title is not unique and
	// is not an identity, and `begin` runs over every row on the grid.
	row.dataset.pblPath = bar.item.file.path;
	// Which vocabulary indexes that value is the same type decision, made by `paletteFor`.
	// No slot (no state, or a value its own vocabulary does not carry) adds no class and
	// the bar keeps its plain accent — `styles/timeline.css` owns what a slot paints, the
	// level badge's TS-adds-the-class, CSS-owns-the-colour split.
	// Undefined where no workflow has a key at all — no vocabulary, so no slot, which is
	// the same answer `paletteSlot` gives a state outside one: the plain accent.
	const palette = paletteFor(mounts.palettes, bar.item);
	const slot = palette ? paletteSlot(palette, own.value) : null;
	if (slot !== null) row.addClass(`pbl-state-${slot}`);
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	renderRowChevron(ctx, lead, entry);
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
	renderConnector(ctx, mounts, { row, barEl: el, geometry }, bar);
	renderBarLabel(track, bar, geometry, scale, window);
	renderRowFacts(row, ctx, bar, { dates, own, conflictedPrereqs: mounts.conflictedPrereqs, lead });
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
		done: own.done,
		milestone: !own.done && milestoneDrawn,
		accent: !own.done && slot === null && !milestoneDrawn,
	};
	return { row, colors };
}

/**
 * Every fact this row states beyond the bar's own colour and shape: its workflow
 * state, what it waits for, and which of that conflicts — extracted out of
 * `renderBarRow` to keep that function's own branching under budget, since these
 * four guards are independent of everything else it does.
 *
 * The row is the timeline's one selection stop, so a MARKER'S row is where the line
 * and the diamond's facts have to be readable (criterion 4a: neither is focusable,
 * so nothing about a milestone may exist only under a hover). An ordinary row is
 * left to its content-derived name — badge, title, and the bar's own `aria-label`
 * (`dates`), which the accessible-name computation already folds in — the same
 * reason `createCard`'s outside marker uses `aria-description` rather than
 * `aria-label`: an explicit label REPLACES that name instead of adding to it, and
 * would cost every dated row its type word for a fact the bar already states. A
 * marker's explicit label therefore REPLACES the row's content, the hidden state
 * and dependency spans included, so the same words are folded into it instead.
 */
function renderRowFacts(
	row: HTMLElement,
	ctx: RowContext,
	bar: TimelineBar,
	said: {
		dates: string;
		own: WorkflowReading;
		conflictedPrereqs: ReadonlyMap<string, ReadonlySet<string>>;
		lead: HTMLElement;
	},
): void {
	// Said in words on the row itself, because on this axis the state is otherwise a
	// bar COLOUR and nothing else — see `stateNote`.
	const { dates, own, conflictedPrereqs, lead } = said;
	const state = stateNote(stateKeyFor(ctx.host.settings, bar.item), own);
	if (state) row.createSpan({ cls: 'pbl-sr-only', text: state });
	// What this row waits for, which of those conflicts, and which is broken (1d) —
	// `dependencyNote`, read from `conflictedPrereqs` (window-independent, see
	// `renderTimeline`) rather than from anything the arrow layer drew. The class is
	// the same fact for sighted users: both come from this one map, so neither can say
	// something the other does not (`Arrows between bars` Task 3, concerns 1 and 2).
	const conflicted = conflictedPrereqs.get(bar.item.file.path) ?? NO_CONFLICTS;
	if (conflicted.size > 0) row.addClass('pbl-row-conflict');
	const waits = dependencyNote(bar.item, conflicted);
	if (waits) row.createSpan({ cls: 'pbl-sr-only pbl-dependency-note', text: waits });
	// A BROKEN entry draws no arrow, so without a mark of its own it would be visible to
	// a screen reader (the span above) and to nobody else — 1d asks the row to carry the
	// marker, and 4d makes this the one surface where the fact is visible rather than
	// merely reachable. The mark is a glyph rather than a second row colour: the row's
	// conflict accent is already a colour, and a fact told only in colour is one a
	// reader with low vision or a red-green deficit does not get. The shelf card's own
	// marker is this same icon with this same string beside it, which is what keeps one
	// fact reading as one fact across the two surfaces `Dependencies` allows it on.
	if (conflicted.size > 0 || bar.item.brokenPrerequisites.length > 0) {
		setIcon(lead.createSpan({ cls: 'pbl-timeline-dependency-flag', attr: { 'aria-hidden': 'true' } }), 'alert-triangle');
		// The words the glyph stands for, so a pointer reader gets what the span gives a
		// screen reader. The row's own accessible name already carries it, so the tooltip
		// is a second route to one fact rather than the only route to a hidden one.
		setTooltip(lead, `${bar.item.title} — ${waits}`);
	}
	if (isMarkerType(bar.item.typeName)) {
		row.setAttribute(
			'aria-label',
			`${bar.item.title} — ${dates}${state ? ` — ${state}` : ''}${waits ? ` — ${waits}` : ''}`,
		);
	}
}

/**
 * The row's disclosure — the tree's own chevron (`renderChevron`), in the lead column,
 * folding the ROWS below this bar rather than listing anything on its face. A row with
 * nothing below it on the grid draws that function's leaf placeholder instead.
 *
 * What is decided here is the two things the shared control cannot know: that a collapse
 * on this axis re-renders the whole projection, since the window, the gridlines and every
 * full-height mark are derived from the row set it changes; and that the path joins
 * `ctx.cardKids`, the register of what actually drew a disclosure this pass, which is
 * what makes the toolbar's bulk controls live and puts the same toggle in the row menu
 * for a reader with no pointer.
 */
function renderRowChevron(ctx: RowContext, lead: HTMLElement, entry: TimelineRow): void {
	// Annotated so fallow can see which host members this file uses — see the root
	// CLAUDE.md on interface members resolved through a property access.
	const host: BacklogViewHost = ctx.host;
	const item = entry.bar.item;
	if (entry.hasChildren) ctx.cardKids.add(item.file.path);
	// A LABEL is passed, which is what makes this the button form — see `renderChevron`,
	// which also states what that does and does not buy on a `role="option"` row. Worded
	// exactly as the row menu's own entry, because the row's NAME is the part a screen
	// reader gets either way and the two surfaces must not describe one act differently.
	const label = entry.collapsed ? 'Show children' : 'Hide children';
	renderChevron(host, lead, item, { ...entry, label }, (heldFocus) => {
		host.render();
		if (heldFocus) refocusPane(host);
	});
}

/**
 * Focus after a fold, for the one case that loses it: the button that was pressed is gone
 * with the frame it was drawn in, and a browser drops focus to the body — where the
 * pane's arrows and menu keys do nothing until the reader finds their own way back.
 *
 * The PANE, never the replacement chevron, which is `render/shelfControls.ts`'s rule for
 * the same situation and not a preference: `handleRoadmapKeydown` returns on any event
 * whose target is not the pane itself, so focusing a `tabindex="-1"` control inside the
 * composite would look right and silently kill the arrow keys. Read off the snapshot the
 * render just published, because every element this function could have closed over
 * belongs to the frame that was just thrown away.
 */
function refocusPane(host: BacklogViewHost): void {
	host.roadmap?.scroller?.closest<HTMLElement>('.pbl-tree')?.focus();
}

/**
 * The row's workflow state in words, or '' where there is none to say.
 *
 * This axis draws state as a bar COLOUR and nothing else: `renderStateChip`'s only call
 * site is the tree, and `chipProps` skips the state property, so without these words the
 * slot colours are the whole of it — unreadable to a screen reader, and colour alone
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
function stateNote(stateKey: string, reading: WorkflowReading): string {
	if (!stateKey) return '';
	if (reading.done) return reading.value === null ? 'Done' : `${reading.value} — done`;
	return reading.value ?? '';
}

/**
 * How wide the mark actually DRAWS, which is what a label beside it has to clear.
 * `--pbl-bar-width` is not that number for two of the three shapes: `.pbl-bar-milestone`
 * is a 12px diamond and `.pbl-bar-outside` a 10px arrow whatever the span, so a
 * one-day milestone at quarter zoom measures 4px here and would have its title
 * painted across it. Same order of tests as `barClasses`, which is what decides
 * which shape is drawn — keep the two in step, and both in step with
 * `.pbl-bar-milestone` / `.pbl-bar-outside` in `styles/timeline.css`.
 *
 * A WIDTH only: where that width starts is the caller's business, because the two
 * marks do not share an origin. `.pbl-bar-outside` sits at `--pbl-bar-left`, while
 * `.pbl-bar.pbl-bar-milestone` carries `translateX(-50%)` and is centred on it —
 * `markLeft` in `renderBarLabel` is where that difference is applied. The diamond's
 * 45° rotation puts its tips ~2.5px outside this box on each side; the label's own
 * 8px of padding is the clearance, so this stays the CSS width rather than a
 * bounding-box calculation nothing else in the file does.
 */
function markWidth(geometry: BarGeometry, scale: TimelineScale): number {
	if (geometry.outside) return OUTSIDE_MARK_PX;
	if (geometry.milestone) return MILESTONE_MARK_PX;
	return Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX);
}

/** Where this row's connector is drawn, and what it is drawn against. Grouped rather
 *  than passed flat: `max-params` is 5 and this would be the sixth. */
interface ConnectorPlace {
	row: HTMLElement;
	barEl: HTMLElement;
	geometry: BarGeometry;
}

/**
 * The dependency connector — a HANDLE, not a grip, and the distinction decides both of
 * its rules. `barHolds` withholds a grip wherever no end is the note's own, because a
 * grip writes a DATE and needs a baseline to move from; this writes a link and claims no
 * date, so an inferred bar offers one and a bar clipped by the window offers one at the
 * clamped edge. A handle can sit at a boundary without asserting anything is there,
 * which is what a diamond cannot do.
 *
 * The draw condition (`dependsOnKey !== '' && !geometry.outside`) is a strict subset of
 * `wireBarLink`'s own gate (`dependsOnKey !== ''`): a bar can never draw a connector
 * without a target being wired for it. The key unconfigured is a feature this view does
 * not have ([[Draw a dependency between bars]] 1c) and refuses both; `geometry.outside`
 * is the one case where a target is still wired for a bar with no dot — a bar wholly
 * outside the window has no on-screen end to draw one from, but is still something
 * another bar's link may legitimately point at. An `outsideFilter` row needs no guard:
 * `deriveBars` routes it to context before any span is computed, so it never has a bar
 * to hang one on — the same reason [[Arrows between bars]] 1c needs none.
 *
 * `tabindex="-1"` like every other per-row control: the pane is one tab stop and the
 * arrows move the selection. The context menu's Depends on… is the keyboard path, which
 * is what SC 2.5.7 requires of a gesture and is why it shipped first.
 */
function renderConnector(ctx: RowContext, mounts: BarRowMounts, place: ConnectorPlace, bar: TimelineBar): void {
	const { row, barEl, geometry } = place;
	const dot =
		ctx.host.settings.dependsOnKey === '' || geometry.outside
			? null
			: barEl.createEl('button', {
					cls: 'pbl-bar-connector',
					attr: { 'aria-label': `Draw a dependency from ${bar.item.title}`, tabindex: '-1' },
				});
	if (dot) {
		// A press that never travels far enough to become a drag still fires `click`, and
		// this button sits inside the row `wireCardActivation` wired — whose handler is
		// unfiltered, so the one control labelled "Draw a dependency from…" opened the
		// note instead. Worst exactly where the dot is permanently visible: on a hoverless
		// device every interaction with it is a tap.
		//
		// The guard is the CONTROL's, not a filter inside the shared handler, because that
		// is what every other control inside a card already does — `.pbl-card-kid`, the
		// chevron, the card-children toggle, the chips. A central filter would be a better
		// idea imposed on eight existing sites rather than a fix to this one.
		dot.addEventListener('click', (evt) => evt.stopPropagation());
		// Middle click never fires `click`, so stopping the primary one leaves the row's
		// `auxclick` opening the note in a new tab — the same wrong action by the one
		// route the first guard does not cover. `.pbl-card-kid` carries this same pair.
		dot.addEventListener('auxclick', (evt) => evt.stopPropagation());
	}
	wireBarLink(ctx, { dnd: mounts.dnd, content: mounts.content, row, barEl, connector: dot, item: bar.item });
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
	// The mark's own left edge, which is NOT `--pbl-bar-left` for the diamond: the
	// milestone rule in `styles/timeline.css` carries `translateX(-50%)`, so a 12px
	// diamond drawn at `left` occupies `[left - 6, left + 6]`. Placing the label from
	// `left` instead left the `after` label 6px further out than the reserve intends and
	// put the `before` label's right edge across the diamond's own left half. Both
	// offsets below take this edge, so what the label clears is the mark as DRAWN.
	const markLeft = geometry.milestone && !geometry.outside ? left - width / 2 : left;
	const trackWidth = window.days * scale.dayPx;
	const after = markLeft + width + LABEL_RESERVE_PX <= trackWidth;
	// Dropped whenever there is no room after the mark's right edge AND the mark begins
	// within the reserve of the track's own left edge, since flipping the label before
	// such a mark would put it off the track behind the sticky lead column. Three ways
	// to reach that, and `MAX_TIMELINE_DAYS` is required for none of them:
	//   - a bar clipped at BOTH window edges;
	//   - a bar clipped at the right alone that merely BEGINS within `LABEL_RESERVE_PX`
	//     of the left edge without being clipped there itself;
	//   - a SHORT TRACK, with no clipping anywhere in it. The reserve is a pixel budget
	//     while the track is days times `dayPx`, so a backlog whose dates sit near today
	//     pads out to ~92 days, which at quarter zoom (2px/day) is a 184px track — under
	//     one reserve plus the other. All that still labels there is the first ~12 days
	//     (room after) and anything starting past 160px (room before), and both of those
	//     lie in the padding months `timelineWindow` adds either side, where no bar of
	//     such a backlog begins. At that zoom the feature is effectively absent, which is
	//     what `timelineFurniture.test.ts` drives with one bar rather than claiming of
	//     every position on the track.
	// Nothing is lost by dropping it — the row's lead carries the same title, which is
	// what makes this decoration rather than content, and squeezing it over the bar would
	// only trade a hidden label for an unreadable one.
	if (!after && markLeft < LABEL_RESERVE_PX) return;
	const label = track.createDiv({ cls: 'pbl-bar-label', text: bar.item.title, attr: { 'aria-hidden': 'true' } });
	if (after) {
		label.addClass('pbl-bar-label-after');
		label.setCssProps({ '--pbl-label-left': `${markLeft + width}px` });
	} else {
		label.addClass('pbl-bar-label-before');
		label.setCssProps({ '--pbl-label-right': `${trackWidth - markLeft}px` });
	}
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
	// Distinct from open-end, which also covers a bar with no target date at all. The two
	// want different connector placement: an open end has an on-screen edge to sit past,
	// a clamped one does not.
	if (geometry.clippedEnd) cls += ' pbl-bar-clipped-end';
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
