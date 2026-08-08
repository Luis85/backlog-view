import { renderBoard } from './board';
import { RowContext } from './columns';
import { renderBoardNoWorkflowState, renderRoadmapNoAxisState } from './emptyStates';
import { renderRoadmap } from './roadmap';
import { renderTree } from './rows';
import { TIMELINE_LEAD_PX } from './timeline';
import { BoardSnapshot, Projection, RoadmapSnapshot, ScrollBox } from '../host';
import { CardDragController } from '../interactions/cardDrag';
import { CivilDate } from '../../domain/noteFields';
import { activeAxis } from '../../domain/roadmap';
import { daysBetween, dayAt } from '../../domain/timeline';

/**
 * The content-pane fork: which projection draws into the scroller, and what the
 * pane claims to be while it does. One decision, stated once — the view applies
 * the result (snapshots, role, label) and keeps the state; this module only
 * renders. The listbox role is a promise of options, so it is made only where
 * options exist: the board's columns always are (an empty column's stop is one),
 * the roadmap's only while cards render, and guidance is a plain labelled region
 * rather than an empty listbox a screen reader may announce as nothing at all.
 */
export interface ProjectionContent {
	board: BoardSnapshot | null;
	roadmap: RoadmapSnapshot | null;
	role: string;
	label: string;
}

/** The scroller's memory across renders: what it drew, at what scale, and where each band sat. */
export interface ScrollAnchor {
	content: string;
	/**
	 * Today's offset WITHIN THE DAY TRACK — `todayLeft` minus the lead width it was drawn
	 * under — never the lead-inclusive pixel. The day track starts at `leadWidth` in
	 * content coordinates and the sticky lead covers exactly that much of the viewport, so
	 * the date at the visible leading edge is a function of `scrollLeft` alone; a lead
	 * resize changes `todayLeft` without the window moving at all, and the lead term has
	 * to cancel out of the comparison rather than being read as a shift to correct for.
	 */
	todayTrackLeft: number | null;
	/** The scale the offsets were measured at; null off the dated axis. */
	scale: string | null;
	/** Each band's own offsets, by identity — never by position in a collection. */
	offsets: Record<string, { top: number; left: number }>;
	/** The civil date at the timeline's leading edge, which is what a zoom change preserves. */
	leadingDate: CivilDate | null;
}

/** The pane plus whatever bands the frame owns. One list, so capture and restore agree. */
function scrollBoxes(treeEl: HTMLElement, roadmap: RoadmapSnapshot | null): ScrollBox[] {
	// The pane is one of these, not an exception to them: it stops scrolling on the
	// dated axis in the ordinary case, but the short-pane fallback gives it a vertical
	// offset again. Conditioning the capture on whether that fallback is active would be
	// a second question to keep in step with the layout; capturing a zero costs nothing.
	return [{ key: 'pane', el: treeEl }, ...(roadmap?.boxes ?? [])];
}

/**
 * Read every band's offset off the DOM that is about to be destroyed. Called from the
 * view BEFORE `treeEl.empty()`, against the PREVIOUS snapshot — reading the pane there
 * would capture a box that no longer scrolls on this axis, and restoring that would
 * discard the reader's pan on every refresh.
 */
export function captureScroll(treeEl: HTMLElement, roadmap: RoadmapSnapshot | null, anchor: ScrollAnchor): ScrollAnchor {
	const offsets: Record<string, { top: number; left: number }> = {};
	for (const box of scrollBoxes(treeEl, roadmap)) {
		offsets[box.key] = { top: box.el.scrollTop, left: box.el.scrollLeft };
	}
	const scroller = roadmap?.scroller ?? null;
	// `scrollLeft` IS the day-track offset of the first visible date, and no lead-column
	// term belongs here. The lead is `position: sticky; left: 0`, so it stays pinned at
	// the scrollport's edge and covers the track beneath it: the first day a reader can
	// actually see sits at viewport x = the lead's own width, which is content x =
	// scrollLeft + that width, which is day-track offset scrollLeft — for every lead,
	// including the ones a reader has dragged. Subtracting it names a date hidden
	// underneath — at 4px/day, scrollLeft 620 and the DEFAULT 220px lead, day 100 while
	// the reader is looking at day 155 — and it was doing so in an earlier revision of
	// this plan, together with a guard for the negative offsets it produced near zero.
	// Both are gone: a sticky element shifts what is painted, not where the content is.
	const leadingDate =
		scroller && roadmap?.window && roadmap.scale ? dayAt(roadmap.window, roadmap.scale, scroller.scrollLeft) : null;
	return { ...anchor, offsets, leadingDate };
}

/**
 * Where the scroller must sit for today to be centred in the part of it a reader can
 * SEE. The lead column is `position: sticky; left: 0`, so it covers viewport 0…`leadWidth`
 * at every scroll position and the day area is the band from `leadWidth` to the right
 * edge — the width a reader has actually resized it to, never the default alone, or the
 * band this centres in would disagree with the column that is really covering the view.
 * Centring on `clientWidth / 2` therefore hides today behind the labels in any pane
 * narrower than twice the lead — a 320px split puts it at viewport 160, under an opaque
 * column — which defeats both the opening scroll and Jump to today in exactly the narrow
 * panes the timeline note says are the common case. Clamped at zero for a pane narrower
 * than the lead itself, where the best available answer is the first visible pixel of
 * day.
 */
export function centreOnToday(todayLeft: number, viewport: number, leadWidth: number): number {
	const band = Math.max(viewport - leadWidth, 0);
	return Math.max(todayLeft - leadWidth - band / 2, 0);
}

/**
 * The width THIS render drew, or the default off the dated axis. Kept as a function
 * rather than inlined at its two callers because `anchorScrollLeft` is at 16 of ESLint's
 * `complexity` 16 without it: the `??` is the seventeenth branch and inlining it fails
 * lint. That is the whole reason, and it is checked rather than argued.
 */
function resolvedLeadWidth(roadmap: RoadmapSnapshot | null): number {
	return roadmap?.leadWidth ?? TIMELINE_LEAD_PX;
}

/** `todayLeft` minus the lead width it was drawn under — see `ScrollAnchor.todayTrackLeft`. */
function todayTrackLeft(todayLeft: number | null, roadmap: RoadmapSnapshot | null): number | null {
	return todayLeft == null ? null : todayLeft - resolvedLeadWidth(roadmap);
}

/** What the render just drew, named finer than the projection: the roadmap's two axes are different content on one frame. */
function drawnContent(roadmap: RoadmapSnapshot | null, todayLeft: number | null, projection: Projection): string {
	if (todayLeft != null) return 'dates';
	if (roadmap) return 'horizons';
	return projection;
}

/** One band's own offset, restored by its key — never by its position in the pass. */
function restoreBox(box: ScrollBox, scroller: HTMLElement, same: boolean, anchor: ScrollAnchor): void {
	const saved = same ? anchor.offsets[box.key] : undefined;
	box.el.scrollTop = saved?.top ?? 0;
	// The one box whose horizontal offset is decided by the anchor policy below.
	if (box.el === scroller) return;
	box.el.scrollLeft = saved?.left ?? 0;
}

export function restoreScroll(
	treeEl: HTMLElement,
	anchor: ScrollAnchor,
	roadmap: RoadmapSnapshot | null,
	projection: Projection,
): ScrollAnchor {
	const todayLeft = roadmap?.todayLeft ?? null;
	const drawn = drawnContent(roadmap, todayLeft, projection);
	const scale = roadmap?.scale?.id ?? null;
	// Band identity applies WITHIN the same drawn content, which is the rule that was
	// already here: both frames have a band called the shelf, holding different cards
	// under different layouts, so matching on the band name alone would restore a
	// deeply scrolled dated shelf onto the horizon one.
	const same = drawn === anchor.content;
	const scroller = roadmap?.scroller ?? treeEl;
	for (const box of scrollBoxes(treeEl, roadmap)) restoreBox(box, scroller, same, anchor);
	scroller.scrollLeft = anchorScrollLeft(anchor, same, todayLeft, roadmap, scroller.clientWidth);
	return { content: drawn, todayTrackLeft: todayTrackLeft(todayLeft, roadmap), scale, offsets: {}, leadingDate: null };
}

/**
 * The same content at a DIFFERENT scale: keep the DATE at the leading edge, not the
 * pixel count — a zoom redefines what a pixel is worth, and `anchorScrollLeft`'s
 * today-correction cannot see it, because it corrects for the window moving rather
 * than for the ruler changing. Null where there is nothing to convert (no capture, or
 * a render with no window/scale of its own), which asks `anchorScrollLeft` to fall
 * through to the pixel-carry case instead.
 */
function scaleChangeScrollLeft(anchor: ScrollAnchor, roadmap: RoadmapSnapshot): number | null {
	if (!anchor.leadingDate || !roadmap.window || !roadmap.scale) return null;
	// The mirror of the capture, and just as free of the lead: put the same date back
	// at the scrollport's edge under the new ruler.
	const day = daysBetween(roadmap.window.start, anchor.leadingDate);
	return Math.max(day * roadmap.scale.dayPx, 0);
}

/**
 * Where the horizontal offset belongs. Three cases, in the order they are decided:
 *
 * - different content — the switch — centres on today, or starts at 0 where there is
 *   no today to centre on;
 * - the same content at a different scale keeps the date at the leading edge
 *   (`scaleChangeScrollLeft`);
 * - the same content at the same scale keeps the pixel carry, corrected by how far
 *   today moved WITHIN THE DAY TRACK — a lead resize changes `todayLeft` without the
 *   window moving, and comparing track-relative offsets is what cancels the lead term
 *   out rather than reading a widen as a pan.
 */
function anchorScrollLeft(
	anchor: ScrollAnchor,
	same: boolean,
	todayLeft: number | null,
	roadmap: RoadmapSnapshot | null,
	viewport: number,
): number {
	if (!same) return todayLeft == null ? 0 : centreOnToday(todayLeft, viewport, resolvedLeadWidth(roadmap));
	const scale = roadmap?.scale?.id ?? null;
	if (scale !== anchor.scale && roadmap) {
		const zoomed = scaleChangeScrollLeft(anchor, roadmap);
		if (zoomed !== null) return zoomed;
	}
	const saved = anchor.offsets['timeline']?.left ?? anchor.offsets['pane']?.left ?? 0;
	const track = todayTrackLeft(todayLeft, roadmap);
	if (track != null && anchor.todayTrackLeft != null) return Math.max(saved + (track - anchor.todayTrackLeft), 0);
	return saved;
}

export function renderProjectionContent(
	projection: Projection,
	ctx: RowContext,
	treeEl: HTMLElement,
	dnd: CardDragController,
): ProjectionContent {
	if (projection === 'board') return renderBoardContent(ctx, treeEl, dnd);
	if (projection === 'roadmap') return renderRoadmapContent(ctx, treeEl, dnd);
	renderTree(ctx, treeEl);
	return { board: null, roadmap: null, role: 'tree', label: 'Product backlog' };
}

/**
 * The board projection of the same model. Without a state property there is no
 * workflow to project, so board mode is guidance instead of columns — the one
 * case with no board, and never a blank pane.
 */
function renderBoardContent(ctx: RowContext, treeEl: HTMLElement, dnd: CardDragController): ProjectionContent {
	const label = 'Product backlog board';
	if (!ctx.host.settings.stateKey) {
		renderBoardNoWorkflowState(ctx.host, treeEl);
		return { board: null, roadmap: null, role: 'region', label };
	}
	return { board: renderBoard(ctx, treeEl, dnd), roadmap: null, role: 'listbox', label };
}

/**
 * The roadmap projection of the same model. Without an axis there is no roadmap
 * to draw, so the mode is guidance naming both ways to get one — and with an
 * axis the frame always renders, empty or not: an empty roadmap is an empty
 * frame, never no frame.
 */
function renderRoadmapContent(ctx: RowContext, treeEl: HTMLElement, dnd: CardDragController): ProjectionContent {
	const host = ctx.host;
	const label = 'Product backlog roadmap';
	const axis = activeAxis(host.settings, host.axisPick);
	if (axis === null) {
		renderRoadmapNoAxisState(host, treeEl);
		return { board: null, roadmap: null, role: 'region', label };
	}
	const roadmap = renderRoadmap(ctx, treeEl, axis, todayCivil(), dnd);
	return { board: null, roadmap, role: roadmap.cards.length > 0 ? 'listbox' : 'region', label };
}

/** The reader's own calendar date — the one thing on the roadmap that is theirs, not the notes'. */
function todayCivil(): CivilDate {
	const now = new Date();
	return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}
