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
	// **The controls come back into the tab order when no COLUMN card can open a menu to
	// reach them** — the question is reachability, not whether the pane drew a card
	// anywhere. A shelf card is on no column, so it is out of this board's roving
	// selection entirely and the card menu can never open from one
	// ([[The iteration shelf is out of the keyboard's walk]], extension 5b of
	// [[Pulling work into an iteration]]) — an iteration with nothing committed leaves no
	// reachable menu even while the shelf still draws cards, which is why the shelf half
	// of this expression was removed rather than kept beside the columns term. Hard-coding
	// `true`, or counting the shelf, both leave a reader with a search they could not
	// clear at `-1` (Codex, PR #187, three rounds, the last of which was this file
	// counting the shelf too).
	//
	// The roadmap's own `activeShelf` branch does NOT drop this term: its shelf cards ARE
	// in its linear keyboard walk (`RoadmapSnapshot.cards`), so there a shelf card genuinely
	// keeps the pane a composite with a reachable menu. The two surfaces differ because
	// their keyboard walks do.
	//
	// `col.cards.length` the way `renderBoardAdvisory` in this file already asks it — empty
	// by a FOLD as well as by nothing committed — rather than `board.cardCount`, which
	// `domain/board.ts` sums from the population before anything folds and which that
	// function's own comment calls "results-only by design".
	syncShelfTabStops(shelf.el, content.board.columns.some((col) => col.cards.length > 0));
	return { ...content, shelfEl: shelf.el, shelf: shelf.cards };
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
): { el: HTMLElement; cards: ShelfCard[] } {
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
	// filter has to be built from: hiding a type must never remove its own way back. What
	// `renderShelf` actually put ON screen is not this function's question any more: the
	// tab-stop decision reads column cards alone (see `renderIterationBoard`'s own comment),
	// since a shelf card is never reachable by this board's keyboard walk regardless of
	// whether it is drawn.
	return { el: shelf.el, cards };
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
