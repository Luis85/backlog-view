import { RowContext } from './columns';
import { renderBoard } from './board';
import { renderEmptyIterationState } from './emptyStates';
import { renderShelf, ShelfRemoval } from './shelf';
import { t } from '../../i18n/t';
import { BacklogViewHost, BoardSnapshot } from '../host';
import { CardDragController } from '../interactions/cardDrag';
import { iterationBuckets, iterationCandidates } from '../../domain/board';
import { BacklogItem, BacklogModel, iterationResults } from '../../domain/model';

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
	const shelfEl = renderIterationShelf(ctx, boardEl, dnd, model);
	const board = iterationBuckets(
		population,
		host.settings,
		(item) => !host.isRowHidden(item),
		// What this board OWNS is its population outright — membership is a link, and
		// nothing about it is hidden by a toggle. The predicate above carries the
		// completed-items toggle, which is exactly what `held` may not be measured through.
		() => true,
	);
	return {
		...renderBoard(ctx, boardEl, dnd, board, {
			scope: 'iteration',
			foldsFinished: false,
			// The BUCKET, never the column's state: `Ready` and `New` can both read as Open,
			// and a move planned from the state would rewrite one as the other.
			move: (item, col) => void (col.bucket && host.performIterationBoardMove(item, col.bucket)),
			drawEmpty: (_h, aside) => renderEmptyIterationState(aside, iteration?.title ?? null),
		}),
		shelfEl,
	};
}

/**
 * The work this sprint could still pull in, above its columns — the roadmap's own shelf,
 * over a population that is a LINK rather than an axis.
 *
 * Reused rather than rewritten, and what that buys is one component: the type groups and
 * their folds, the card shell, the drop target and the auto-scroll a long shelf needs are
 * the ones already driven on the roadmap. What it is handed differs in the three things
 * that are genuinely this board's — no axis (a board states nothing about dependencies),
 * its own name (this shelf is a POPULATION, never the roadmap's placement), and no sort,
 * filter or search picks: their keyboard path is the card menu's shelf section, which is
 * the roadmap's alone, and the base's own search already narrows what arrives here.
 *
 * Every card carries `reason: null` — nothing here failed to be placed. The shelf holds
 * what has not been committed to a fortnight, which is a fact about the plan rather than
 * a refusal to read a value.
 *
 * It renders before the columns and is therefore ABOVE them, the horizon board's own
 * arrangement and for its reason: a card is dragged FROM here INTO a column.
 */
function renderIterationShelf(
	ctx: RowContext,
	boardEl: HTMLElement,
	dnd: CardDragController,
	model: BacklogModel,
): HTMLElement {
	const host: BacklogViewHost = ctx.host;
	const cards = iterationCandidates(model).map((item) => ({ item, reason: null }));
	const shelf = renderShelf(
		ctx,
		boardEl,
		{
			cards,
			conflicts: NO_CONFLICTS,
			axis: null,
			name: t('shelf.backlog'),
			picks: false,
			fold: {
				collapsed: host.columnCollapsed('backlog', null, false),
				set: (collapsed) => host.setColumnCollapsed('backlog', null, collapsed),
			},
		},
		dnd,
		iterationRemoval(host),
	);
	return shelf.el;
}

/** No board states what a card waits for, so this map is empty on every render. */
const NO_CONFLICTS: ReadonlyMap<string, ReadonlySet<string>> = new Map();

/**
 * What a drop on this shelf MEANS: the card leaves the iteration.
 *
 * The horizon axis's rule, arrived at from the other side — the shelf is where
 * un-placing lives, and here the placement is the sprint itself. A card already on the
 * shelf is accepted rather than refused, exactly as the horizon axis accepts one: it may
 * still carry an `iteration` key nothing resolves, which is a real thing to clear, and a
 * re-drop with nothing to clear plans no write and no-ops.
 */
function iterationRemoval(host: BacklogViewHost): ShelfRemoval {
	return {
		plan: (source) => void host.performIterationRemove(source.item),
		tooltip: t('shelf.removeIteration'),
		// A board card and a shelf card both hold `null`; there is no grip on a board to
		// tell apart from either.
		accepts: (source) => source.hold === null,
		outcome: null,
		canDrag: () => true,
	};
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
