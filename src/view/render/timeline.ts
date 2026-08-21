import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { renderBarLabel } from './barLabel';
import { bandMount, renderBarProgress } from './barProgress';
import { RowContext } from './columns';
import {
	barClasses,
	drawBandCollision,
	drawMarkerDiamonds,
	drawnCards,
	drawnSpans,
	renderLaneContextRow,
	renderLaneHead,
	renderLaneRowDescription,
	spanText,
	stateNote,
	TimelineEntry,
	wireBarHolds,
} from './lanes';
import { createCard, wireCardActivation } from './board';
import { foldOnClick, renderBadge, renderChevron } from './rows';
import { renderMilestoneLines } from './milestoneLines';
import { dependencyNote, NO_CONFLICTS, renderDependencyArrows } from './timelineArrows';
import { CardDragController } from '../interactions/cardDrag';
import { wireBarLink, wireLinkPreview } from '../interactions/linkDrag';
import { effectiveLeadWidth, renderLeadResize } from '../interactions/timelineLeadResize';
import { BacklogViewHost, BarColors, DrawnColors } from '../host';
import { BacklogItem } from '../../domain/model';
import { barHolds, ShelfCard, TimelineBar, TimelineRow } from '../../domain/bars';
import { dependencyArrows } from '../../domain/dependencies';
import {
	ownWorkflowReading,
	paletteFor,
	stateColorPaint,
	stateKeyFor,
	StatePalette,
	WorkflowReading,
} from '../../domain/board';
import {
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
import { ResourceLane } from '../../domain/roadmap';
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
	/**
	 * The one drop target spanning the day area — see `renderTimeline`'s own comment.
	 * Null on an axis that positions nothing by the pointer, which is where drawing it
	 * would swallow the drops its rows are the targets for.
	 */
	overlay: HTMLElement | null;
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
	 * deliberate fallback (this grid's own floor plus every capped band can exceed a short
	 * or embedded pane — the rule rather than a count, which was already stale twice),
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
	/**
	 * The resources axis's own lanes, so the window can be widened to hold every stretch
	 * they carry (`drawnSpans`) even though a stretch is no longer an entry of its own —
	 * see that function's doc comment for the bug this exists to keep fixed. Empty on the
	 * dated axis, which has no lanes and therefore nothing here to widen the window for.
	 *
	 * NOT a second way to ask which axis is on screen: `rows` below is still derived from
	 * `laneElement` alone, so there is only ever one discriminator for that question. A
	 * dated-axis caller that happened to pass lanes here would widen its own window for
	 * nothing, since it has no bands to draw them into either way.
	 */
	lanes: ResourceLane[];
	/**
	 * Report one element of a resource's band, and which row it belongs to. Null on the
	 * dated axis, which has no rows to belong to — and that null is the one thing the two
	 * grid axes do not share, so everything downstream that differs between them reads
	 * THIS rather than an axis name: whether the grid-wide drop overlay is drawn, whether
	 * the full-height marks let events through, and whether a bar is a handle for a row as
	 * well as for its dates.
	 *
	 * It REPORTS rather than wires, because a drop on a band needs the window, the scale
	 * and the lead width this pass drew and none of them exists while the pass is running.
	 * What landing on one should write is the caller's either way — this module knows
	 * which elements belong to which row and nothing else about them. Called per ELEMENT —
	 * the header, each bar row, each absence stretch, each excluded note's row — because
	 * they are siblings positioned against one shared day grid and there is no container
	 * to name.
	 */
	laneElement: ((el: HTMLElement, lane: ResourceLane) => void) | null;
}

export function renderTimeline(
	ctx: RowContext,
	containerEl: HTMLElement,
	entries: TimelineEntry[],
	drawing: TimelineDrawing,
): TimelineRender {
	const { today, scale, dnd, palettes, available, shelf } = drawing;
	// Whether this grid's ROWS mean something. Derived once from the one field that
	// differs between the axes, so the overlay, the mark's pointer events and a bar's row
	// handle cannot end up disagreeing about which axis is on screen.
	const rows = drawing.laneElement !== null;
	// Every bar THIS LIST draws, in draw order — the milestone lines and the dependency
	// arrows are both computed from it and are axis-independent. What a collapsed row
	// hides, it hides from this list: a row-collapsed subtree's bar is off it, exactly as
	// the state filter hiding completed work already takes one off it.
	// The milestones' row draws no `'row'` entry — one header holds every diamond — and its
	// bars belong on this list all the same: the lines and the arrows are the two things
	// computed from it, and both are exactly what a marker contributes to a grid. Left off,
	// the resources axis would draw diamonds no line crosses and drop every arrow drawn to
	// one. It is NOT the card list for that reason — see `cards` below.
	const bars = entries.flatMap((entry) =>
		entry.kind === 'row' ? [entry.row.bar] : entry.kind === 'lane' && entry.lane.markers ? entry.lane.bars : [],
	);
	// Every span this grid DRAWS, which is NOT the list above — see `drawnSpans`. A folded
	// BAND's own bars are in it even though none of its rows are in `entries`, because the
	// rail draws them where the entries list draws nothing; a row-collapsed SUBTREE inside
	// an open band draws nothing either way and is correctly absent from both lists. A mark
	// the window was never widened for is clamped to the edge and painted on days it does
	// not cover.
	const window = timelineWindow(drawnSpans(entries, drawing.lanes), today);
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
	// `pbl-timeline-flat` says nothing on this grid is positioned by the pointer, which
	// is what decides whether the full-height marks may intercept events — see the drop
	// overlay below, and `.pbl-timeline-flat .pbl-today` in `styles/timeline.css`.
	const content = grid.createDiv({
		cls: 'pbl-timeline-content' + (rows ? ' pbl-timeline-flat' : ''),
	});
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
	const header = renderCellHeader(ctx, content, window, scale, { width: leadWidth, available });
	const headerTrack = header.cells;
	renderGridLines(content, window, scale, leadWidth);
	// Before the rows, so the bars — positioned elements later in the DOM — paint over
	// them. A line says what falls either side of a date; a bar is the thing being asked
	// about, and must not be obscured by the question.
	// Reported, because a milestone's LINE is cyan whatever its bar does: the done
	// override repaints the diamond green and leaves the line alone, so a grid whose only
	// marker is done draws cyan that no diamond accounts for. Asking the bars alone left
	// that line unkeyed.
	// The label goes in the COARSE tier, never the cell tier — see `renderMilestoneLines`.
	const milestoneLines = renderMilestoneLines({ grid: content, headerTrack: header.coarse }, window, bars, today, {
		scale,
		leadWidth,
		iterationBars: ctx.host.settings.iterationBars,
	});
	const tracks = new Map<string, HTMLElement>();
	const anchors = new Map<string, HTMLElement>();
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
		anchors,
		palettes,
		conflictedPrereqs: dependencies.conflicts,
	};
	const drawn: DrawnColors = {
		done: false,
		milestone: milestoneLines.milestone,
		iteration: milestoneLines.iteration,
		accent: false,
		absence: false,
		daysLost: false,
	};
	drawEntries(entries, { ctx, mounts, window, drawing, drawn });
	// After every row exists, never before: an edge's arrow anchors on the ROWS the
	// prerequisite and the dependent actually drew, and its Y comes from where those
	// rows really landed rather than a guessed row height — see `renderDependencyArrows`,
	// which draws from the same `dependencies.arrows` list computed above.
	renderDependencyArrows({ layer: arrowLayer, content, anchors }, window, dependencies.arrows, { scale, leadWidth });
	const todayLeft = leadWidth + todayOffset(window, today, scale);
	const line = content.createDiv({ cls: 'pbl-today', attr: { 'aria-hidden': 'true' } });
	line.setCssProps({ '--pbl-today-left': `${todayLeft}px` });
	setTooltip(line, t('timeline.todayLine', { date: formatCivil(today) }));
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
	//
	// Drawn only where a position on the WHOLE GRID means something. On the resources axis
	// the targets are the rows — each of which reads the same pointer X for the same date,
	// plus the row it belongs to — and an overlay left standing there would take pointer
	// events for the entire day area and swallow every one of them. This is not the empty
	// shelf's case, which stays in the DOM because it can always be dropped on: here it
	// never can.
	const overlay = rows ? null : content.createDiv({ cls: 'pbl-timeline-drop', attr: { 'aria-hidden': 'true' } });
	return {
		// Read from the ENTRIES, which is what keeps the milestones' row off this list
		// without a rule of its own: that row draws every marker into its own header track
		// and produces no `'row'` or `'context'` entry at all. A diamond in a shared header
		// is not an `option` and has no element the roving selection could point
		// `aria-activedescendant` at, so listing one would put the keyboard walk on a stop
		// that does not exist. What that costs — no keyboard route to a marker on this axis
		// — is recorded in [[Milestones out of the resource rows]] 3c; the dated axis still
		// draws each one as its own selectable row.
		cards: drawnCards(entries),
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
 * Everything the entry walk needs beyond the entries — one object, not six arguments.
 * `drawing` whole rather than the two fields taken out of it: it already carries both the
 * scale and `laneTarget`, and naming them here would be a second list to keep in step.
 */
interface EntryPass {
	ctx: RowContext;
	mounts: BarRowMounts;
	window: TimelineWindow;
	drawing: TimelineDrawing;
	/** Filled as each bar row reports what it painted — see `TimelineRender.drawn`. */
	drawn: DrawnColors;
}

/**
 * Draw every entry the axis handed over, in order — the one place the three entry kinds
 * are told apart.
 *
 * Its own function rather than a loop inside `renderTimeline`, which is at the
 * complexity budget `npm run analyze` enforces: the grid's own setup (the window, the
 * header, the lines, the layers, the overlay) and the walk over what it contains are two
 * jobs, and telling the entry kinds apart is what made keeping them in one measurably too
 * much.
 *
 * **The stripe counts drawn ROWS only.** A lane header is chrome — its own stretches
 * included, since 2026-08-14 — so it never reaches the counter, and counting it would flip
 * the parity of every work row beneath it.
 */
/**
 * One band's header, and whatever that header itself draws — its resource's stretches, its
 * load rail while it is folded, and on the milestones' row every diamond on the axis.
 *
 * Its own function rather than three more lines inside `drawEntries`, which is at the
 * cognitive budget `npm run analyze` enforces just telling the three entry kinds apart: a
 * header that draws marks of its own is a fourth job, and the walk should go on asking only
 * what kind of entry it is holding.
 *
 * The legend keys what the grid actually PAINTED — asked of the DOM the header just
 * produced, not of `entry.lane.absences` (a MODEL predicate `renderLaneAbsences`' own early
 * return could drift out of step with by hand). Since 2026-08-14 the header paints its own
 * resource's stretches whether the band is open or shut, so this is the one place left to
 * ask.
 */
function drawBand(entry: { lane: ResourceLane; collapsed: boolean }, pass: EntryPass): HTMLElement {
	const { ctx, mounts, window, drawn } = pass;
	const { scale, today } = pass.drawing;
	const { head, track } = renderLaneHead(ctx, mounts.content, entry, { window, scale, today });
	if (head.querySelector('.pbl-absence') !== null) drawn.absence = true;
	if (entry.lane.markers) drawMarkerDiamonds(ctx, mounts, { head, track, lane: entry.lane }, { window, scale }, drawn);
	return head;
}

function drawEntries(entries: TimelineEntry[], pass: EntryPass): void {
	const { ctx, mounts, window, drawn } = pass;
	const { scale, laneElement } = pass.drawing;
	let drawnRows = 0;
	let lane: ResourceLane | null = null;
	// Both things a ROW of a band owes, from the ONE place a row is finished: whose row it is
	// in (the header is a sibling div and cannot label what follows it) and its membership of
	// the band, which has no container to name and so is a LIST of siblings. A header needs
	// neither — it names itself, and it registers as its OWN lane below.
	const inBand = (el: HTMLElement): void => {
		if (!lane) return;
		renderLaneRowDescription(el, lane.name);
		laneElement?.(el, lane);
	};
	for (const entry of entries) {
		if (entry.kind === 'lane') {
			// Drawn on its own line and reported after, NEVER as `laneElement?.(drawBand(…))`:
			// an optional call whose callee is null skips its ARGUMENTS too, so on the dated
			// axis — where `laneElement` is null by definition — that spelling drew no header
			// at all and the milestones' row silently vanished while its lines still crossed
			// the grid.
			const head = drawBand(entry, pass);
			// The header belongs to its own row whatever that row is, the milestones' included:
			// a release in it is a real gesture, and what it MEANS is the caller's business.
			laneElement?.(head, entry.lane);
			// It opens no BAND for the rows after it, though. The milestones' row stands for no
			// resource, and on the DATED axis it is the first entry with every work row behind
			// it and no resource lane ever following — so left set, each of those rows would be
			// described as "Assigned to Milestones" and washed with absences it cannot have.
			lane = entry.lane.markers ? null : entry.lane;
			continue;
		}
		let row: HTMLElement;
		if (entry.kind === 'context') {
			row = renderLaneContextRow(ctx, mounts.content, entry.item);
		} else {
			const bar = renderBarRow(ctx, mounts, window, entry.row, scale);
			row = reportColors(bar, drawn);
			// The band's unavailable days, shaded behind this row's own bar. A WORK row only:
			// the stretch's own line already carries the mark, a context row makes no
			// positional claim at all, and on the dated axis `lane` is null because there is
			// no band to be a member of.
			if (lane) drawBandCollision(bar, entry.row, lane, { window, scale }, drawn);
		}
		inBand(row);
		// Assigned at render because CSS has no nth-of-class, and nth-child would
		// count the header, the lines and the layers interleaved in this container.
		if (drawnRows % 2 === 1) row.addClass('pbl-row-even');
		drawnRows++;
	}
}




/**
 * The cell tiers are presentational, like the tree's column header: every row
 * carries its own dates, so the month/quarter labels add nothing a screen reader
 * needs. The LEAD cell is not: it now carries the resize grip, a real control, so
 * `aria-hidden` sits on the tiers alone rather than the whole header — an
 * `aria-hidden` ancestor removes every focusable descendant from the accessibility
 * tree along with the decoration, and this cell is no longer only decoration.
 *
 * Returns BOTH tiers, because two different things mount into them and they want opposite
 * neighbourhoods: the drop ghost belongs beside the dates it is read against (`cells`,
 * carried out as `TimelineRender.headerTrack`), and a milestone's label belongs where there
 * is room for it (`coarse`). It once also handed back an empty band reserved for the Today
 * pill; the legend strip above the grid took over naming the today line's colour, so the
 * pill and its band are gone and these are plain tracks again.
 */
function renderCellHeader(
	ctx: RowContext,
	content: HTMLElement,
	window: TimelineWindow,
	scale: TimelineScale,
	// `available` rides along only so the grip can state a real `aria-valuemax` — see
	// `renderLeadResize`.
	lead: { width: number; available: number },
): { coarse: HTMLElement; cells: HTMLElement } {
	const header = content.createDiv({ cls: 'pbl-timeline-header' });
	const leadEl = header.createDiv({ cls: 'pbl-timeline-lead' });
	renderLeadResize(ctx.host, leadEl, content, { current: lead.width, defaultWidth: TIMELINE_LEAD_PX, available: lead.available });
	// Two stacked tiers in the track slot: the coarser orientation tier, then the cells.
	const tiers = header.createDiv({ cls: 'pbl-timeline-tiers', attr: { 'aria-hidden': 'true' } });
	const coarse = renderHeaderTier(tiers, superCells(window, scale), scale, 'pbl-timeline-super', 'pbl-timeline-cell pbl-timeline-cell-super');
	return { coarse, cells: renderHeaderTier(tiers, timelineCells(window, scale), scale, '', 'pbl-timeline-cell') };
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
	/**
	 * What an item OCCUPIES vertically, by path — the element `renderDependencyArrows`
	 * reads a Y off. A second map beside `tracks` rather than the track's own parent,
	 * because the two questions have one answer on a bar row and two on the milestones'
	 * row: a bar row's track is its own, so its parent IS the row, while every marker
	 * shares one header track and each diamond sits on its own sub-lane inside it. Read
	 * through the track there, every arrow anchored on the header's centre — between two
	 * stacked diamonds and on neither.
	 */
	anchors: Map<string, HTMLElement>;
	/** Which of a dependent's prerequisites conflict, by the dependent's path — see `DependencyArrows.conflicts`. */
	conflictedPrereqs: ReadonlyMap<string, ReadonlySet<string>>;
	/** See `TimelineDrawing.palettes`. */
	palettes: StatePalette[];
}

/** A bar row's element, with the colours it drew folded into the pass's own report. */
function reportColors(rendered: { row: HTMLElement; colors: BarColors }, drawn: DrawnColors): HTMLElement {
	if (rendered.colors.done) drawn.done = true;
	if (rendered.colors.milestone) drawn.milestone = true;
	if (rendered.colors.accent) drawn.accent = true;
	return rendered.row;
}

function renderBarRow(
	ctx: RowContext,
	mounts: BarRowMounts,
	window: TimelineWindow,
	entry: TimelineRow,
	scale: TimelineScale,
): { row: HTMLElement; colors: BarColors; lead: HTMLElement; track: HTMLElement; label: HTMLElement | null } {
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
	// The class and the inline colour both come from `stateColorPaint`, which the legend's
	// swatch also asks — two things that must agree now, from one answer.
	const paint = palette ? stateColorPaint(ctx.host.settings, palette, own.value) : null;
	if (paint) {
		row.addClass(paint.cls);
		// Inline, so it overrides whatever the class above set — see `StatePaint`.
		if (paint.color) row.setCssProps({ '--pbl-state-color': paint.color });
	}
	const lead = row.createDiv({ cls: 'pbl-timeline-lead' });
	renderRowChevron(ctx, lead, entry);
	renderBadge(ctx.host, lead, bar.item);
	const title = lead.createDiv({ cls: 'pbl-card-title' });
	title.setText(bar.item.title);
	setTooltip(lead, bar.item.title);
	// A row is a surface like a card, so it registers by path: `cardedPaths` reads the
	// register and `menuChildren` subtracts it, so a bar drawn and not registered would be
	// offered as `Open child "…"` by the menu of the very bar it is nested under.
	ctx.placed.add(bar.item.file.path);

	const track = row.createDiv({ cls: 'pbl-timeline-track' });
	mounts.tracks.set(bar.item.file.path, track);
	// A bar row occupies the whole row, so the row is what an arrow anchors on — the same
	// element the track's parent used to supply, said directly now that the milestones'
	// row needs a different answer. See `BarRowMounts.anchors`.
	mounts.anchors.set(bar.item.file.path, row);
	const geometry = barGeometry(window, bar.span);
	// Asked ONCE, of `barHolds`, shared by the class that advertises a body drag and
	// the wiring that actually registers one — so what the cursor promises and what a drop
	// registers cannot disagree. The body hold IS the bar; the grips are its two edges.
	const holds = barHolds(bar.item, ctx.host.settings, bar);
	// The same answer on both grids, which is the rule rather than a convenience: a span
	// the note does not state has no baseline for any gesture to move from, so an inferred
	// bar is not a drag source on either axis. It is still reassignable — by Set assignee
	// and by Alt+Up/Down, which name a value rather than displacing one.
	const holdable = holds.includes('body');
	const el = track.createDiv({ cls: barClasses(bar, geometry, holdable) });
	const drawnWidthPx = Math.max(geometry.spanDays * scale.dayPx, MIN_BAR_PX);
	el.setCssProps({
		'--pbl-bar-left': `${geometry.startDay * scale.dayPx}px`,
		'--pbl-bar-width': `${drawnWidthPx}px`,
	});
	const dates = spanText(bar);
	el.setAttribute('aria-label', dates);
	setTooltip(el, dates);
	// Every hold this bar offers, wired through the one function a marker's own mark
	// shares (`wireBarHolds`, `./lanes.ts`) — the body hold IS `el`, the edges are its
	// own children, and `timelineDrag.test.ts` "a grip is a handle, not a link" is what
	// proves a click on a grip stays silent while a click on the bar still opens it.
	wireBarHolds(el, bar.item, holds, mounts.dnd, () => mounts.scroller.scrollLeft);
	wireBarLink(ctx, { dnd: mounts.dnd, content: mounts.content, row, barEl: el, outside: geometry.outside, item: bar.item });
	const label = renderBarLabel(track, bar, geometry, scale, window);
	renderBarProgress(ctx.host, { row, bar: bandMount(el, drawnWidthPx, geometry), lead }, bar.item);
	renderRowFacts(row, ctx, bar, { own, conflictedPrereqs: mounts.conflictedPrereqs, lead });
	// The one caller that passes a fold: this row has a chevron, so "clicking an item
	// expands or collapses it" means here exactly what it means in the tree. Its two
	// answers are this axis's own — `entry.hasChildren` is what `timelineRows` decided
	// draws a disclosure, never `item.children`, and the redraw is the whole projection
	// for the same reason `renderRowChevron`'s is.
	wireCardActivation(ctx, row, bar.item, (evt) =>
		foldOnClick(ctx.host, bar.item, evt, { hasChildren: entry.hasChildren, redraw: () => ctx.host.render() }),
	);
	// The same three overrides `styles/timeline.css` gives a bar, asked in the same
	// order: done wins outright (the row class overrides regardless of geometry), then
	// a milestone diamond only where `barClasses` actually added `pbl-bar-milestone` —
	// never for `geometry.milestone` alone, since the early return for `geometry.outside`
	// withholds that class from a marker whose date lies outside the window, and that
	// bar draws the plain accent like any other. A bar can draw an ordinary PBI's own
	// coincident start/target as the same diamond (`timelineFurniture.test.ts`'s "Ship
	// it"), so this is asked of the geometry alone, never narrowed to marker items.
	const milestoneDrawn = geometry.milestone && !geometry.outside;
	const colors: BarColors = {
		done: own.done,
		milestone: !own.done && milestoneDrawn,
		// `paint === null` IS "no slot", and a choice never creates one, so the plain accent
		// is still exactly the case where the state is outside its own vocabulary.
		accent: !own.done && paint === null && !milestoneDrawn,
		// A bar ROW is never an iteration: an Iteration draws as a point in the milestones'
		// shared row (`drawMarkerDiamonds`), which has no rows of its own — this report has
		// nothing to say here.
		iteration: false,
	};
	return { row, colors, lead, track, label };
}

/**
 * Every fact this row states beyond the bar's own colour and shape: its workflow
 * state, what it waits for, and which of that conflicts — extracted out of
 * `renderBarRow` to keep that function's own branching under budget, since these
 * guards are independent of everything else it does.
 *
 * The row is left to its content-derived name — badge, title, and the bar's own
 * `aria-label` (`dates`), which the accessible-name computation already folds in — the
 * same reason `createCard`'s outside marker uses `aria-description` rather than
 * `aria-label`: an explicit label REPLACES that name instead of adding to it, and would
 * cost every dated row its type word for a fact the bar already states.
 *
 * **There is no marker branch here any more, and its absence is the rule rather than an
 * omission.** One stood here writing a marker's explicit label — its dates, its state, what
 * it waits for and its rollup, folded into one string because the label replaced the row's
 * own content. Since 2026-08-16 a marker draws in the milestones' shared row on BOTH grid
 * axes, so `renderBarRow` never sees one and the branch was unreachable; a branch nothing can
 * reach is a claim nothing keeps. What that costs a marker with descendants — the rollup it
 * announced and nothing else states — is recorded in
 * [[Milestones out of the resource rows]] rather than kept as dead code.
 */
function renderRowFacts(
	row: HTMLElement,
	ctx: RowContext,
	bar: TimelineBar,
	said: {
		own: WorkflowReading;
		conflictedPrereqs: ReadonlyMap<string, ReadonlySet<string>>;
		lead: HTMLElement;
	},
): void {
	// Said in words on the row itself, because on this axis the state is otherwise a
	// bar COLOUR and nothing else — see `stateNote`.
	const { own, conflictedPrereqs, lead } = said;
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
		drawIcon(lead.createSpan({ cls: 'pbl-timeline-dependency-flag', attr: { 'aria-hidden': 'true' } }), 'alert-triangle');
		// The words the glyph stands for, so a pointer reader gets what the span gives a
		// screen reader. The row's own accessible name already carries it, so the tooltip
		// is a second route to one fact rather than the only route to a hidden one.
		setTooltip(lead, t('timeline.waitsTooltip', { title: bar.item.title, waits }));
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
	// which also states what that does and does not buy on a `role="option"` row. The row
	// menu's own entry reads the SAME two keys, because the row's NAME is the part a screen
	// reader gets either way and the two surfaces must not describe one act differently.
	// One catalog key each way is what makes that impossible rather than merely agreed —
	// two literals kept in step by a comment is what this used to be.
	const label = entry.collapsed ? t('fold.showChildren') : t('fold.hideChildren');
	const fold = (): void => void host.setCollapsed(item.file.path, !host.isCollapsed(item.file.path));
	renderChevron(host, lead, { ...entry, label, toggle: fold }, (heldFocus) => {
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


function todayOffset(window: TimelineWindow, today: CivilDate, scale: TimelineScale): number {
	const days = Math.min(Math.max(daysBetween(window.start, today), 0), window.days - 1);
	return days * scale.dayPx;
}
