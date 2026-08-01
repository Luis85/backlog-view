import { renderBoard } from './board';
import { RowContext } from './columns';
import { renderBoardNoWorkflowState, renderRoadmapNoAxisState } from './emptyStates';
import { renderRoadmap } from './roadmap';
import { renderTree } from './rows';
import { BoardSnapshot, Projection, RoadmapSnapshot } from '../host';
import { BoardDragController } from '../interactions/boardDrag';
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

export function renderProjectionContent(
	projection: Projection,
	ctx: RowContext,
	treeEl: HTMLElement,
	boardDnd: BoardDragController,
): ProjectionContent {
	if (projection === 'board') return renderBoardContent(ctx, treeEl, boardDnd);
	if (projection === 'roadmap') return renderRoadmapContent(ctx, treeEl);
	renderTree(ctx, treeEl);
	return { board: null, roadmap: null, role: 'tree', label: 'Product backlog' };
}

/**
 * The board projection of the same model. Without a state property there is no
 * workflow to project, so board mode is guidance instead of columns — the one
 * case with no board, and never a blank pane.
 */
function renderBoardContent(ctx: RowContext, treeEl: HTMLElement, boardDnd: BoardDragController): ProjectionContent {
	const label = 'Product backlog board';
	if (!ctx.host.settings.stateKey) {
		renderBoardNoWorkflowState(treeEl);
		return { board: null, roadmap: null, role: 'region', label };
	}
	return { board: renderBoard(ctx, treeEl, boardDnd), roadmap: null, role: 'listbox', label };
}

/**
 * The roadmap projection of the same model. Without an axis there is no roadmap
 * to draw, so the mode is guidance naming both ways to get one — and with an
 * axis the frame always renders, empty or not: an empty roadmap is an empty
 * frame, never no frame.
 */
function renderRoadmapContent(ctx: RowContext, treeEl: HTMLElement): ProjectionContent {
	const host = ctx.host;
	const label = 'Product backlog roadmap';
	const axis = activeAxis(host.settings, host.axisPick);
	if (axis === null) {
		renderRoadmapNoAxisState(host, treeEl);
		return { board: null, roadmap: null, role: 'region', label };
	}
	const roadmap = renderRoadmap(ctx, treeEl, axis, todayCivil());
	return { board: null, roadmap, role: roadmap.cards.length > 0 ? 'listbox' : 'region', label };
}

/** The reader's own calendar date — the one thing on the roadmap that is theirs, not the notes'. */
function todayCivil(): CivilDate {
	const now = new Date();
	return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}
