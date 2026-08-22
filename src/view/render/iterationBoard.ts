import { RowContext } from './columns';
import { renderBoard } from './board';
import { renderEmptyIterationState } from './emptyStates';
import { renderShelf, ShelfRemoval } from './shelf';
import { syncShelfTabStops } from './shelfControls';
import { t } from '../../i18n/t';
import { BacklogViewHost, BoardSnapshot } from '../host';
import { CardDragController } from '../interactions/cardDrag';
import { iterationBuckets, iterationCandidates } from '../../domain/board';
import { BacklogItem, BacklogModel, iterationResults } from '../../domain/model';
import { ShelfCard } from '../../domain/bars';

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
	const shelf = renderIterationShelf(ctx, boardEl, dnd, model);
	const board = iterationBuckets(
		population,
		host.settings,
		(item) => !host.isRowHidden(item),
		// What this board OWNS is its population outright — membership is a link, and
		// nothing about it is hidden by a toggle. The predicate above carries the
		// completed-items toggle, which is exactly what `held` may not be measured through.
		() => true,
	);
	const content = renderBoard(ctx, boardEl, dnd, board, {
		scope: 'iteration',
		foldsFinished: false,
		// The BUCKET, never the column's state: `Ready` and `New` can both read as Open,
		// and a move planned from the state would rewrite one as the other.
		move: (item, col) => void (col.bucket && host.performIterationBoardMove(item, col.bucket)),
		drawEmpty: (_h, aside) => renderEmptyIterationState(aside, iteration?.title ?? null),
	});
	// **The controls come back into the tab order when the pane holds no card**, which on this
	// board is reachable and is a trap rather than a curiosity: an iteration with nothing
	// committed draws empty columns, and a search or a type filter narrow enough to empty the
	// shelf then leaves no card anywhere — so no card menu, which is the ONLY keyboard path to
	// these controls, and `buildColumnMenu` on the empty columns carries folds and policy and
	// no shelf section at all. A keyboard reader would be left with a search they could not
	// clear. Hard-coding `true` here is what would do that, and the first draft of this plan
	// did (Codex, PR #187).
	//
	// **Asked of what was DRAWN, on both halves, and neither half may be a population count.**
	// `shelf.drawn` rather than `shelf.cards`: the second is the band's whole population, which
	// the card menu needs and which stays positive while a search hides every one of them. And
	// the columns are asked the way `renderBoardAdvisory` in this file already asks them —
	// `col.cards.length`, which a fold empties — rather than `board.cardCount`, which
	// `domain/board.ts` sums from the population before anything folds and which that
	// function's own comment calls "results-only by design". Every committed card in a folded
	// column plus a search that empties the shelf is the same trap through the other half.
	// (Codex, PR #187, three rounds — the first fix used the wrong array, the second the wrong
	// count.)
	syncShelfTabStops(shelf.el, content.board.columns.some((col) => col.cards.length > 0) || shelf.drawn.length > 0);
	return { ...content, shelfEl: shelf.el, shelf: shelf.cards, shelfDrawn: shelf.drawn.length };
}

/**
 * The work this sprint could still pull in, above its columns — the roadmap's own shelf,
 * over a population that is a LINK rather than an axis.
 *
 * Reused rather than rewritten, and what that buys is one component: the type groups and
 * their folds, the card shell, the drop target and the auto-scroll a long shelf needs are
 * the ones already driven on the roadmap. What it is handed differs in the two things that
 * are genuinely this board's — no axis (a board states nothing about dependencies) and its
 * own name (this shelf is a POPULATION, never the roadmap's placement).
 *
 * It carries the PICKS as of 2026-08-21. They were withheld because the keyboard path for
 * a `tabindex="-1"` control here is the card menu's shelf section, which was built for the
 * roadmap alone — a reason about a missing path rather than about this band, and
 * `addShelfSection` serves both now. The band that most needs narrowing is this one: the
 * roadmap shelves what an axis could not place, and this holds the whole uncommitted
 * backlog.
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
): { el: HTMLElement; cards: ShelfCard[]; drawn: BacklogItem[] } {
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
			fold: {
				collapsed: host.columnCollapsed('backlog', null, false),
				set: (collapsed) => host.setColumnCollapsed('backlog', null, collapsed),
			},
		},
		dnd,
		iterationRemoval(host),
	);
	// `cards` is the band's whole population, unnarrowed, which is what the card menu's type
	// filter has to be built from: hiding a type must never remove its own way back. `drawn`
	// is what `renderShelf` actually put on screen — narrowed by the search and the hidden
	// types, and empty when the band is collapsed or every group is folded. The tab-stop
	// decision in Task 3 is about what a reader can REACH, so it is the second of these; the
	// first stays positive on a band that is drawing nothing and would have kept the controls
	// out of the tab order in exactly the state they are needed.
	return { el: shelf.el, cards, drawn: shelf.cards };
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
