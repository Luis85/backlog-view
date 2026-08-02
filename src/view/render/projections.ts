import { renderBoard } from './board';
import { RowContext } from './columns';
import { renderBoardNoWorkflowState, renderRoadmapNoAxisState } from './emptyStates';
import { renderRoadmap } from './roadmap';
import { renderTree } from './rows';
import { BoardSnapshot, Projection, RoadmapSnapshot } from '../host';
import { CardDragController } from '../interactions/cardDrag';
import { CivilDate } from '../../domain/noteFields';
import { activeAxis } from '../../domain/roadmap';

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

/** The scroller's memory across renders: what it drew, and where today sat. */
export interface ScrollAnchor {
	content: string;
	todayLeft: number | null;
}

/**
 * Where the horizontal scroll belongs after a render. An offset belongs to the
 * content that made it: the same content restores it — corrected by how far
 * today moved, because a data update can shift the timeline window's origin by
 * months and a raw pixel offset would then show a different stretch of
 * calendar — while a switch resets it, and entering the dated timeline centers
 * on today. Tracked through the anchor, never read off the position: zero is a
 * place a user can pan to.
 */
function anchorScrollLeft(
	anchor: ScrollAnchor,
	drawn: string,
	todayLeft: number | null,
	saved: number,
	viewport: number,
): number {
	if (drawn !== anchor.content) return todayLeft == null ? 0 : Math.max(todayLeft - viewport / 2, 0);
	if (todayLeft != null && anchor.todayLeft != null) return Math.max(saved + (todayLeft - anchor.todayLeft), 0);
	return saved;
}

/**
 * Put the scroller back where the content about to be shown left it, and return
 * the anchor the next pass is measured against. Both offsets belong to the content
 * that made them, and what was DRAWN is finer than which projection ran — the
 * roadmap's two axes are different content on one scroller — so the name is derived
 * here, beside the fork that chose it. Vertical keeps the horizontal rule without
 * the centering: the same content keeps the reader's place, a switch starts at the
 * top, because a tree's depth means nothing to a row of buckets.
 */
export function restoreScroll(
	el: HTMLElement,
	anchor: ScrollAnchor,
	roadmap: RoadmapSnapshot | null,
	projection: Projection,
	saved: { top: number; left: number },
): ScrollAnchor {
	const todayLeft = roadmap?.todayLeft ?? null;
	const drawn = todayLeft != null ? 'dates' : roadmap ? 'horizons' : projection;
	el.scrollTop = drawn === anchor.content ? saved.top : 0;
	el.scrollLeft = anchorScrollLeft(anchor, drawn, todayLeft, saved.left, el.clientWidth);
	return { content: drawn, todayLeft };
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
		renderBoardNoWorkflowState(treeEl);
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
