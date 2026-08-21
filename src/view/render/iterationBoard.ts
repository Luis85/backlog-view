import { RowContext } from './columns';
import { renderBoard } from './board';
import { renderEmptyIterationState } from './emptyStates';
import { BacklogViewHost, BoardSnapshot } from '../host';
import { CardDragController } from '../interactions/cardDrag';
import { iterationBuckets } from '../../domain/board';
import { BacklogItem, iterationResults } from '../../domain/model';

/**
 * The board for ONE iteration, drawn through `renderBoard` like the other two.
 *
 * Its own module rather than a third renderer in `board.ts`, which reached its 400-line
 * cap on 2026-08-16 when the dated axis's milestone lane landed beside this. What comes
 * out is the projection least entangled with the rest: `board.ts` keeps the shared frame
 * — the columns, the cards, the advisory — and this holds the one board whose population
 * is a link and whose columns are buckets.
 */

/**
 * The board for ONE iteration: its goal above three columns over the PRODUCT workflow.
 *
 * Its population is `iterationResults` — the carriers plus the excluded ancestors that
 * place them — and its columns are `iterationBuckets`, which reads `settings.stateKey`
 * directly rather than through `stateKeyFor`: that function dispatches on the item, so a
 * `Deliverable` would answer with the Deliverables key and one board would be drawing two
 * vocabularies. A sprint holds whatever kind of work was committed to the fortnight.
 *
 * The scope is already resolved (`host.effectiveScope`) — a caller that reached here with
 * a stale path would be drawing a board the rest of the view has fallen back from.
 */
export function renderIterationBoard(
	ctx: RowContext,
	boardEl: HTMLElement,
	dnd: CardDragController,
	scope: string,
): BoardSnapshot {
	const host: BacklogViewHost = ctx.host;
	const model = host.model;
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [], scope: 'iteration' };
	const iteration = model.byPath.get(scope);
	const population = iterationResults(model, scope);
	renderIterationGoal(host, boardEl, iteration);
	const board = iterationBuckets(
		population,
		host.settings,
		(item) => !host.isRowHidden(item),
		// What this board OWNS is its population outright — membership is a link, and
		// nothing about it is hidden by a toggle. The predicate above carries the
		// completed-items toggle, which is exactly what `held` may not be measured through.
		() => true,
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		scope: 'iteration',
		foldsFinished: false,
		// The BUCKET, never the column's state: `Ready` and `New` can both read as Open,
		// and a move planned from the state would rewrite one as the other.
		move: (item, col) => void (col.bucket && host.performIterationBoardMove(item, col.bucket)),
		drawEmpty: (_h, aside) => renderEmptyIterationState(aside, iteration?.title ?? null),
	});
}

/**
 * What this iteration is FOR, above its columns — and three refusals rather than a
 * conditional: no goal draws no line at all (never an empty one, and never a placeholder
 * inviting a value), an unconfigured goal property is the same absence, and the line is
 * TEXT. Nothing in it is focusable or clickable: a goal is a fact about the sprint, and a
 * control here would be a second way to edit a note whose own dialog owns that.
 */
function renderIterationGoal(host: BacklogViewHost, boardEl: HTMLElement, iteration: BacklogItem | undefined): void {
	const goal = host.settings.iterationGoalKey ? (iteration?.iterationGoalValue ?? '') : '';
	if (goal.trim() === '') return;
	boardEl.createDiv({ cls: 'pbl-iteration-goal', text: goal.trim() });
}
