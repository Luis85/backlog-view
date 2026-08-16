import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { renderCardChildren } from './cardChildren';
import { renderPropCells, renderRollup, RowContext } from './columns';
import {
	renderAllDoneState,
	renderBoardExcludedFocusState,
	renderEmptyIterationState,
	renderEmptyState,
	renderFilterEmptyState,
	renderNoDeliverablesState,
} from './emptyStates';
import { fromRowControl, renderBadge, renderChevron, renderTitleText } from './rows';
import { BacklogViewHost, BoardSnapshot, ColumnScope, PlacedMount } from '../host';
import { uniqueElementId } from '../selection';
import { CardDragController } from '../interactions/cardDrag';
import { showColumnMenu } from '../interactions/columnMenu';
import { showItemMenu } from '../interactions/menu';
import {
	boardColumns,
	BoardColumn,
	BoardModel,
	cardPaths,
	deliverablesWorkflow,
	emptyNoState,
	iterationBuckets,
	overBy,
	ownWorkflowReading,
	requirementsFocusRoots,
	requirementsWorkflow,
} from '../../domain/board';
import { childTypeChoices, focusTarget, isDeliverableType } from '../../domain/itemTypes';
import { BacklogItem, iterationResults } from '../../domain/model';
import { listedChildren, undisclosedMatches } from '../childrenList';

/** What differs between the two board-shaped projections' render passes. */
interface BoardRenderOptions {
	/** Which screen these columns are drawn on, so two boards' `Done` are two folds. */
	scope: ColumnScope;
	/**
	 * What a drop on a column MEANS, handed the COLUMN rather than its state. A bucket is
	 * not its state — two of them can hold `state: null` meaning different things — so a
	 * signature taking the state alone cannot express an iteration move at all, and the
	 * one board where that matters would have had to reach round this option to plan its
	 * own write.
	 */
	move: (item: BacklogItem, col: BoardColumn) => void;
	// `root` is `boardEl` — the STABLE element this whole render pass was handed, never
	// `aside` itself: `aside` is the fresh `.pbl-board-advisory` div this same pass just
	// created, torn down and rebuilt on the next one, so `manualLink`'s default refocus
	// must resolve from something that survives it. See `renderEmptyState`'s doc comment
	// in `render/emptyStates.ts`.
	drawEmpty: (host: BacklogViewHost, aside: HTMLElement, root: HTMLElement) => void;
	/**
	 * The view-options display name of THIS workflow's state list, named in the
	 * stray-column tooltip (`renderColumnHeader`) so the hint points at the setting
	 * that actually holds this board's states — found by review: an unparametrized
	 * tooltip hardcoded the requirements option name, so a stray Deliverables column
	 * told the user to edit "Workflow states (in order)", a property this board
	 * ignores entirely.
	 */
	stateOptionLabel: string;
	/**
	 * Whether a done column holding only finished work folds itself the first time that is
	 * true of it. The two product-shaped boards say yes — "done columns stay lean", and
	 * finished work should not take a stage's room.
	 *
	 * The iteration board says no, for the reason `hidesCompleted` is false for it: its
	 * Resolved column IS what the sprint finished, so a default that shut it would fold
	 * away the answer to the question the board is opened to ask. Nothing stops a reader
	 * folding it by hand, and that fold is remembered per iteration.
	 */
	foldsFinished?: boolean;
}

/**
 * Everything `renderColumn`/`renderCard` need beyond `ctx` and the element/model
 * they are rendering — bundled so both stay within the repo's `max-params: 5` lint
 * rule. Found by review: the first draft threaded `dnd`, `carded` and `opts` as three
 * separate trailing parameters, which pushed both functions to six.
 */
interface ColumnRenderCtx {
	dnd: CardDragController;
	carded: Set<string>;
	opts: BoardRenderOptions;
}

/** What the column's own header draws differently, decided by `renderBoard` and passed down. */
interface ColumnFrame {
	/** The empty no-state column's leading drop strip — see `renderColumn`. */
	strip: boolean;
	/** Folded to that same strip by the reader, or by the done column's own default. */
	folded: boolean;
	filtering: boolean;
}

/**
 * The board projection: the same model the tree renders, projected onto the
 * workflow's columns. A card is a result row wearing a different layout — badge,
 * title, the same resolved property columns, the rollup — so switching projections
 * costs no information about an item. Shared by both board-shaped projections; what
 * differs between them (whose workflow, whose move, whose empty state) rides in `opts`.
 */
function renderBoard(
	ctx: RowContext,
	boardEl: HTMLElement,
	dnd: CardDragController,
	board: BoardModel,
	opts: BoardRenderOptions,
): BoardSnapshot {
	renderBoardInstructions(boardEl);
	const colsEl = boardEl.createDiv({ cls: 'pbl-board-cols' });
	// A done column holding finished work and nothing else folds itself the first time that
	// is true of it — the tree's own once-only default, asked of the column rather than of
	// a parent. The answer is asked once here and carried down, never re-derived per
	// header: the getter SETTLES on the way past (see `columnCollapsed` in
	// `view/viewState.ts`).
	//
	// `held > 0` is the load-bearing term and not a tidy-up: settling is permanent, so a
	// default taken while the column holds NOTHING is a default taken on no evidence. A
	// board drawn before its results arrive — a Bases pass that has not warmed up, a filter
	// the reader has just narrowed to nothing — has an empty Done like every other column,
	// and without this term it would shut Done for good and hand the work back folded. Same
	// hazard `collapseNewParents` states for a model that has not loaded, one projection
	// over. An empty column is also nothing to hide: "done columns stay lean" is about
	// finished work taking a stage's room, and no work takes none.
	//
	// `held` and not `fullCount`, which was this term's first spelling and got the feature's
	// own case backwards: `fullCount` is measured through the population predicate, and the
	// completed-items toggle lives in that, so with finished work hidden a done column FULL
	// of finished work reported zero and refused the fold in exactly the configuration
	// extension 3b of the requirement is about. Found by review (Codex, PR #140).
	const foldsFinished = opts.foldsFinished ?? true;
	const folds = board.columns.map((col) =>
		// The BUCKET is the identity where there is one: two buckets with nothing to write
		// both carry `state: null`, so a fold keyed on the state alone shuts them together.
		ctx.host.columnCollapsed(
			opts.scope,
			col.bucket ?? col.state,
			foldsFinished && col.done && col.held > 0 && !col.openWork,
		),
	);
	// A folded column draws no cards, and the SNAPSHOT is where that is said, because the
	// keyboard reads the snapshot: `boardPosition`, `nextBoardPosition` and Alt+arrow all
	// walk `snapshot.board.columns[].cards`, so emptying the list here is what stops the
	// selection landing on a card no longer on screen — without any of them asking about a
	// fold. `renderShelf` contributes to the roadmap's own card list the same way.
	const drawn: BoardModel = { ...board, columns: board.columns.map((col, i) => (folds[i] ? { ...col, cards: [] } : col)) };
	// Which items have a card of their own, so a card naming the matches below it can
	// skip the ones already on screen. Built once per pass rather than searched per card,
	// and off the DRAWN board: a match folded away is not on screen and may be named again.
	const render: ColumnRenderCtx = { dnd, carded: cardPaths(drawn), opts };
	const colEls = drawn.columns.map((col, i) => renderColumn(ctx, colsEl, col, render, folds[i]));
	dnd.wireScroller(boardEl);
	// The UNFOLDED board: "why has this board no cards" must never be answered about a
	// board whose cards are merely folded away, or a fully folded board would be told
	// that everything is done or that nothing matches.
	renderBoardAdvisory(ctx, boardEl, board, opts.drawEmpty);
	return { board: drawn, colEls, scope: opts.scope };
}

/** The requirements board — `renderBoard`'s original, only caller until now. */
export function renderRequirementsBoard(ctx: RowContext, boardEl: HTMLElement, dnd: CardDragController): BoardSnapshot {
	// Annotated rather than inferred from `ctx.host` so `npm run check` can see which
	// host members this file uses — fallow resolves interface members through an
	// explicit type and not through a property access. See the root CLAUDE.md.
	const host: BacklogViewHost = ctx.host;
	const model = host.model;
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [], scope: 'board' };
	// Deliverables are managed on their own board now — never a REAL card, never a
	// stray column and never counted here, whatever state they carry. Their Task
	// children are untouched: Task-typed, so this predicate does not reach them, and
	// they keep their own card and column placement even though their parent has none
	// here — under a focus too, which takes `requirementsFocusRoots` to be true, since
	// a focus makes the roots the candidates and an excluded root takes its subtree off
	// screen with it. `item.outsideFilter ||` exempts a Deliverable acting purely as CONTEXT
	// (an excluded ancestor placing a visible descendant, admitted as a focus root under
	// PBI focus exactly as an Issue or a Bug already is) — every other extra type keeps
	// the "a context row renders whenever it has a visible child" guarantee, and this
	// exclusion must not be the one place a Deliverable alone loses it. It still counts
	// nowhere: `population` below is unchanged, and `boardColumns` already zeroes every
	// `outsideFilter` card out of both `count` and `fullCount` regardless of type.
	const board = boardColumns(
		// Its `observedValues` is already Deliverable-free — the stray-column half of
		// this same exclusion, stated in the workflow itself.
		requirementsWorkflow(model, host.settings),
		model.focused ? requirementsFocusRoots(model.roots) : model.results,
		(item) => !host.isRowHidden(item) && (item.outsideFilter || !isDeliverableType(item.typeName)),
		(item) => !host.isRowHiddenUnfiltered(item) && !isDeliverableType(item.typeName),
		// What this board OWNS, and nothing about what is hidden inside it: the type alone.
		// Both predicates above carry the completed-items toggle, which is exactly what
		// `BoardColumn.held` may not be measured through — see the fold default in
		// `renderBoard`.
		(item) => !isDeliverableType(item.typeName),
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		scope: 'board',
		move: (item, col) => void host.performBoardMove(item, col.state),
		stateOptionLabel: 'Workflow states (in order)',
		drawEmpty: (h, aside, root) => {
			const m = h.model;
			if (!m) return;
			// Asked of the board's OWN population, never `m.results`: Deliverables are
			// managed elsewhere, so counting them here reported "all N items are done and
			// hidden" over a board that simply had nothing of its own to show — a flat lie
			// in a base of Deliverables alone, and again under a `Deliverable` focus, where
			// every focus root is a type this board excludes.
			const population = m.results.filter((item) => !isDeliverableType(item.typeName));
			// That focus gets its own state rather than the ordinary empty one: the ordinary
			// one would name the focused type and offer to create another — a fifth surface
			// offering the one type this board cannot show.
			if (m.focused && isDeliverableType(focusTarget(h.settings))) renderBoardExcludedFocusState(h, aside);
			else if (population.length === 0) renderEmptyState(h, aside, root);
			else if (h.isFiltering()) renderFilterEmptyState(h, aside, root);
			else renderAllDoneState(h, aside, population.length, root);
		},
	});
}

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
		(item) => !host.isRowHiddenUnfiltered(item),
		// What this board OWNS is its population outright — membership is a link, and
		// nothing about it is hidden by a toggle. Both predicates above carry the
		// completed-items filter, which is exactly what `held` may not be measured through.
		() => true,
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		scope: 'iteration',
		foldsFinished: false,
		// The BUCKET, never the column's state: `Ready` and `New` can both read as Open,
		// and a move planned from the state would rewrite one as the other.
		move: (item, col) => void (col.bucket && host.performIterationBoardMove(item, col.bucket)),
		stateOptionLabel: 'Workflow states (in order)',
		drawEmpty: (h, aside, root) => {
			if (h.isFiltering()) renderFilterEmptyState(h, aside, root);
			else renderEmptyIterationState(aside, iteration?.title ?? 'this iteration');
		},
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

/**
 * The Deliverables board — every Deliverable-typed item the base holds, in every
 * focus state. It reads `model.deliverableResults`, never `model.results` or
 * `model.roots`: the human's own request is that a focus level set on another
 * projection must never make a Deliverable invisible here, and `model.results` is
 * itself narrowed to the focused subtree while a focus is active (`buildModel`'s
 * `shown()`) — `domain/model.ts` builds `deliverableResults` off the whole, unfocused
 * tree for exactly this projection. Every candidate here is already Deliverable-typed
 * by construction, so `population` (the filter-ignoring `fullCount` count) is
 * unconditional. Also regardless of either workflow's completion state (Scope: no
 * "Show completed items" concept here).
 */
export function renderDeliverablesBoard(ctx: RowContext, boardEl: HTMLElement, dnd: CardDragController): BoardSnapshot {
	const host: BacklogViewHost = ctx.host;
	const model = host.model;
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [], scope: 'deliverables' };
	const board = boardColumns(
		deliverablesWorkflow(model, host.settings),
		model.deliverableResults,
		(item) => !host.isRowHidden(item),
		() => true,
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		scope: 'deliverables',
		move: (item, col) => void host.performDeliverablesBoardMove(item, col.state),
		stateOptionLabel: 'Deliverable workflow states (in order)',
		drawEmpty: (h, aside, root) => {
			const m = h.model;
			if (!m) return;
			if (m.deliverableResults.length === 0) renderNoDeliverablesState(aside);
			else if (h.isFiltering()) renderFilterEmptyState(h, aside, root);
		},
	});
}

/**
 * What the board can do without a pointer, told rather than left to be discovered.
 * Visually hidden and attached with `aria-describedby`, so it is read once when
 * focus arrives on the board and never again — the shortcuts are exactly the part
 * a screen-reader user cannot see a hint for, and a drag they cannot make is not
 * an alternative they should have to guess at. The id is minted per element
 * because two saved boards can sit in split panes and `aria-describedby` resolves
 * across the whole document.
 *
 * `aria-hidden` AND described-by, which only looks contradictory: the board is a
 * listbox, whose children are options, and a stray div among them is content a
 * reader may try to announce in its own right. Hiding it keeps the option list
 * clean — and a referenced description is still read from a hidden element, which
 * is the whole reason the visually-hidden-description pattern works at all.
 */
function renderBoardInstructions(boardEl: HTMLElement): void {
	const help = boardEl.createDiv({
		cls: 'pbl-sr-only',
		attr: { 'aria-hidden': 'true' },
		text:
			'Arrow keys move between cards and columns. Alt with left or right arrow moves the selected card ' +
			'one column, writing the same change a drop writes. The menu key opens the card menu, where set ' +
			'state offers every column — the path that works without a drag on every device. Enter opens the note.',
	});
	help.id = uniqueElementId('pbl-board-help');
	boardEl.setAttribute('aria-describedby', help.id);
}

/**
 * Why the board has no cards, said beside the columns rather than instead of them:
 * an empty board is empty stages, never no stages. The explanations are the tree's
 * own empty states, rendered into an aside — one vocabulary for both projections.
 *
 * "No cards" means no RENDERED cards, context included — not `cardCount`, which is
 * results-only by design. A focused board can be nothing but context cards placing
 * visible results, and an advisory claiming everything is done or nothing matches,
 * beside a card whose rollup shows open work, would be the board contradicting
 * itself. A context card renders only while it places a visible result, so gating
 * on rendered cards agrees with the visibility rule by construction.
 */
function renderBoardAdvisory(
	ctx: RowContext,
	boardEl: HTMLElement,
	board: BoardModel,
	drawEmpty: (host: BacklogViewHost, aside: HTMLElement, root: HTMLElement) => void,
): void {
	if (board.columns.some((col) => col.cards.length > 0)) return;
	drawEmpty(ctx.host, boardEl.createDiv({ cls: 'pbl-board-advisory' }), boardEl);
}

function renderColumn(
	ctx: RowContext,
	colsEl: HTMLElement,
	col: BoardColumn,
	render: ColumnRenderCtx,
	folded: boolean,
): HTMLElement {
	// The no-state column earns its room only while it holds cards; empty, it
	// shrinks to a leading drop strip so clearing a state by drag stays possible
	// without a permanently empty column. "Empty" is about the POPULATION, not the
	// matches: a filter that hid every stateless card would otherwise collapse the
	// column to a strip, which says the work is gone rather than merely unmatched —
	// a stronger lie than the "0" the pair counts exist to prevent.
	// A folded column reaches the strip WITHOUT being one: `strip` is the empty no-state
	// column's own case and suppresses the count, while a fold keeps name and count
	// visible. Two states, one width — see `.pbl-board-collapsed` in `styles/board.css`.
	const frame: ColumnFrame = {
		strip: emptyNoState(col) && !folded,
		folded,
		filtering: ctx.host.isFiltering(),
	};
	const colEl = colsEl.createDiv({
		cls:
			'pbl-board-col' +
			(col.done ? ' pbl-col-done' : '') +
			(col.outsideWorkflow ? ' pbl-col-outside' : '') +
			// The key-removal column, which is a `state: null` that TAKES a drop — an
			// unwritable bucket holds the same null and means the opposite.
			(col.state === null && col.takesDrop ? ' pbl-col-nostate' : '') +
			(frame.strip ? ' pbl-board-strip' : '') +
			(folded ? ' pbl-board-collapsed' : ''),
		attr: { role: 'group', 'aria-label': columnLabel(col, frame) },
	});
	renderColumnHeader(ctx, colEl, col, frame, render.opts);
	const cardsEl = colEl.createDiv({ cls: 'pbl-board-col-cards' });
	for (const card of col.cards) renderCard(ctx, cardsEl, card, render);
	// What a drop on this column MEANS is the board's; the controller only resolves
	// the card that was dragged and hands it here.
	// A column with nothing to write is not wired as a target at all: the refusal belongs
	// at the gesture rather than after it, and every other affordance below asks the same
	// bit, so the board never promises a drop that cannot land.
	if (col.takesDrop) render.dnd.wireDropTarget(colEl, (source) => render.opts.move(source.item, col));
	render.dnd.wireScroller(cardsEl);
	return colEl;
}

function columnLabel(col: BoardColumn, frame: ColumnFrame): string {
	// Always col.label, never the constant: the synthetic column yields its name
	// when a real state claims it, and an accessible name that kept the old text
	// would disagree with the screen — unreachable by the very speech input that
	// targets columns by their visible name.
	// Only where the drop actually clears the key: an unwritable bucket carries the same
	// `state: null` and would otherwise promise a clearing drop it never takes.
	const label = col.state === null && col.takesDrop ? `${col.label} — dropping here clears the state` : col.label;
	// Filtered, the count is a pair and has to be spoken as one: "2 cards" in a column
	// of eleven would tell a screen-reader user the stage had emptied.
	const counts = frame.filtering
		? t('count.cardsMatching', { count: col.count, total: col.fullCount })
		: t('count.cards', { count: col.count });
	// The fold is spoken HERE and not left to the disclosure's own `aria-expanded`, which
	// nothing on the keyboard path reaches: this string is the stop's `aria-label`, and an
	// accessible name overrides the children it is set on, so a reader arriving by
	// `aria-activedescendant` hears the name, the count, and no button at all. Without the
	// word, a folded column announces cards it is not showing — the one thing a count that
	// deliberately survives the fold makes worse rather than better.
	const said = frame.folded ? `${label}, collapsed` : label;
	if (col.limit === null) return `${said}, ${counts}`;
	// The overage is spoken because the icon beside it is not: an over-limit column
	// has to say so to someone who cannot see either the colour or the shape.
	const over = overBy(col);
	return `${said}, ${counts}, limit ${col.limit}${over > 0 ? `, over by ${over}` : ''}`;
}

function renderColumnHeader(
	ctx: RowContext,
	colEl: HTMLElement,
	col: BoardColumn,
	frame: ColumnFrame,
	opts: BoardRenderOptions,
): void {
	const { strip, filtering } = frame;
	// The header doubles as the column's keyboard stop: an option-like element the
	// selection can make the listbox's active descendant, because the column itself
	// is a group and a group is not a valid active item — a screen reader told to
	// rest on one may announce nothing. See `.pbl-board-col-stop` in selection.ts.
	const header = colEl.createDiv({
		cls: 'pbl-board-col-header pbl-board-col-stop',
		attr: { role: 'option', 'aria-selected': 'false', 'aria-label': columnLabel(col, frame) },
	});
	// The empty no-state strip is the one header with nothing to fold: it holds no card
	// in any filter state, so a disclosure there would offer to shut what is already shut.
	if (!strip) renderColumnFold(ctx.host, header, opts.scope, col.state, { folded: frame.folded, label: col.label });
	if (col.done) drawIcon(header.createSpan({ cls: 'pbl-board-col-icon' }), 'circle-check');
	if (col.state === null) drawIcon(header.createSpan({ cls: 'pbl-board-col-icon' }), 'circle-dashed');
	header.createSpan({ cls: 'pbl-board-col-name', text: col.label });
	if (!strip) renderColumnCount(header, col, filtering);
	renderColumnHints(colEl, header, col, strip, opts.stateOptionLabel);
	renderColumnPolicy(header, col);
	// On the header rather than inside `renderColumnPolicy`, because the menu is no longer
	// the policy's: every column has a fold to offer, so every column has a menu — which
	// is also what makes the fold's keyboard path the one the column stop already answers.
	header.addEventListener('contextmenu', (evt) => showColumnMenu(ctx.host, evt, opts.scope, col));
}

/**
 * How many cards, and how many the stage agreed to. A column is a stage of the workflow,
 * not a search result: while the filter narrows the cards the header says how many of the
 * stage's work it matched, so nobody reads a filtered board as a column that emptied.
 */
function renderColumnCount(header: HTMLElement, col: BoardColumn, filtering: boolean): void {
	const count = filtering ? `${col.count} of ${col.fullCount}` : String(col.count);
	header.createSpan({ cls: 'pbl-board-col-count' + (filtering ? ' pbl-board-col-count-filtered' : ''), text: count });
	if (col.limit === null) return;
	header.createSpan({ cls: 'pbl-board-col-limit', text: `/ ${col.limit}` });
	// More than colour alone: the class carries the colour, the icon carries the shape,
	// and `columnLabel` carries the words.
	if (overBy(col) === 0) return;
	header.addClass('pbl-board-col-over');
	drawIcon(header.createSpan({ cls: 'pbl-board-col-over-icon' }), 'triangle-alert');
}

/**
 * What this column is, said in a tooltip: a value outside the agreed workflow, or the
 * one column whose drop REMOVES rather than writes — which has to say so somewhere a
 * real state named like it cannot. The strip says what the full column says; same target,
 * different size.
 */
function renderColumnHints(
	colEl: HTMLElement,
	header: HTMLElement,
	col: BoardColumn,
	strip: boolean,
	stateOptionLabel: string,
): void {
	if (col.outsideWorkflow) {
		drawIcon(header.createSpan({ cls: 'pbl-board-col-stray' }), 'circle-help');
		setTooltip(
			colEl,
			`"${col.label}" is not one of the configured workflow states. Add it to "${stateOptionLabel}" in the view options, or move its cards.`,
		);
	}
	if (strip) setTooltip(colEl, 'Drop a card here to clear its state');
	else if (col.state === null) setTooltip(colEl, 'Items without the state property — dropping a card here removes it');
}

/**
 * A column's own disclosure — `renderChevron`, the control every other fold in this plugin
 * draws, so the filter override, the real `disabled` flag, the middle click and the focus
 * report all arrive with it rather than being remembered here.
 *
 * Exported because a horizon bucket's header is the same control over the same host method
 * (`render/roadmap.ts`): what differs between a column and a bucket is the scope it keys
 * under, which is a parameter.
 *
 * A `label` is passed, so this is the BUTTON form carrying `aria-expanded` — the board's
 * header already claims `role="option"`, which does not support that state, exactly the
 * position the timeline's row chevron is in. The deviation is the one
 * `docs/issues/A disclosure nested in an option role.md` records; no new argument here.
 */
export function renderColumnFold(
	host: BacklogViewHost,
	headerEl: HTMLElement,
	scope: ColumnScope,
	value: string | null,
	col: { folded: boolean; label: string },
): void {
	const state = {
		hasChildren: true,
		collapsed: col.folded,
		label: `${col.folded ? 'Expand' : 'Collapse'} ${col.label}`,
		toggle: () => host.setColumnCollapsed(scope, value, !col.folded),
	};
	// Focus to the PANE and never to the replacement control, `render/shelfControls.ts`'
	// rule: the projection is rebuilt whole by the toggle, and the pane's key handler
	// ignores any event whose target is not the pane itself, so focus on a `tabindex="-1"`
	// control inside it would look right and silently kill the arrow keys.
	//
	// Resolved NOW rather than in the callback: by then this header is detached and
	// `closest` answers null from a node with no parents. The pane itself survives — a
	// content render empties `treeEl`, it does not replace it — so the reference is still
	// the element on screen.
	const pane = headerEl.closest<HTMLElement>('.pbl-tree');
	renderChevron(host, headerEl, state, (heldFocus) => {
		if (heldFocus) pane?.focus();
	});
}

/**
 * The column's working agreement, described rather than named: the policy says
 * what the column is FOR, and folding it into the accessible NAME would make
 * speech input target a column by a paragraph. Extension 3a keeps it off the tab
 * order — the affordance is a span, and the keyboard path is the column's menu.
 * A column with nothing agreed gets no affordance at all (extension 1a).
 *
 * The menu itself is no longer wired here. It was, while the policy was the only thing in
 * it and a column without one had no menu at all; the fold made every column worth a menu,
 * so the listener moved to `renderColumnHeader` where it is attached unconditionally.
 */
function renderColumnPolicy(header: HTMLElement, col: BoardColumn): void {
	if (!col.policy) return;
	const description = header.createSpan({ cls: 'pbl-sr-only', text: col.policy });
	description.id = uniqueElementId('pbl-col-policy');
	header.setAttribute('aria-describedby', description.id);
	const affordance = header.createSpan({ cls: 'pbl-board-col-policy' });
	drawIcon(affordance, 'info');
	setTooltip(affordance, col.policy);
}

function renderCard(ctx: RowContext, cardsEl: HTMLElement, item: BacklogItem, render: ColumnRenderCtx): void {
	const card = createCard(ctx, cardsEl, item);
	renderCardBody(ctx, card, item);
	// Called INLINE here and not from the shared body, because "which items already have
	// a card" is answerable now on this projection alone: a `BoardModel` is already
	// narrowed to what draws, so `cardPaths` is the whole answer. The roadmap's model is
	// not, so it names its own matches in a second pass once every surface has drawn
	// (`nameMatches` in `render/roadmap.ts`). The mount is stated rather than registered
	// for the same reason, and both of its answers are this surface's own: a board card
	// lists its children on its face, and it has the width to name each match.
	renderCardMatches(ctx, render.carded, { item, mount: card, listsChildren: true, face: 'links' });
	wireCardActivation(ctx, card, item);
	render.dnd.wireCard(card, item);
}

/**
 * A card's shell, registered in the row index so selection and targeted lookups
 * reach it. Shared with the roadmap: a card is a result row wearing the card
 * layout, whichever projection drew it.
 *
 * Finished styling is the ITEM's own workflow, asked HERE and taking no parameter, so
 * every projection that draws a card gets the same answer. It was a parameter with an
 * `item.done` default and a per-board override, which is a category invariant asked at
 * the places someone thought of: the Deliverables board passed its own workflow and the
 * timeline passed its own reading, while the horizon buckets, the shelf and the context
 * strip took the default and styled a Deliverable by a workflow that does not track it —
 * in both directions. `ownWorkflowReading` is the same rule `stateKeyFor` states for the
 * key; a non-Deliverable's answer is `item.done` exactly as before.
 */
export function createCard(ctx: RowContext, containerEl: HTMLElement, item: BacklogItem): HTMLElement {
	const done = ownWorkflowReading(item).done;
	const selected = ctx.host.selectedPath === item.file.path;
	const card = containerEl.createDiv({
		cls:
			'pbl-card' +
			(done ? ' pbl-done' : '') +
			(item.outsideFilter ? ' pbl-card-context pbl-outside' : '') +
			(selected ? ' pbl-selected' : ''),
		attr: { role: 'option', 'aria-selected': String(selected) },
	});
	card.dataset.path = item.file.path;
	ctx.rows.set(item.file.path, card);
	return card;
}

/**
 * What a card shows — badge, title, the parent line, the resolved property
 * columns, the rollup. One body for the board's cards and the roadmap's, so an
 * item cannot look different per projection.
 */
export function renderCardBody(ctx: RowContext, card: HTMLElement, item: BacklogItem): void {
	const host = ctx.host;
	const head = card.createDiv({ cls: 'pbl-card-head' });
	renderBadge(host, head, item);
	if (item.outsideFilter) {
		const marker = head.createSpan({ cls: 'pbl-outside-marker' });
		drawIcon(marker, 'corner-left-down');
		setTooltip(marker, "Not in this base's filter — shown to place its items");
		// A description, not a label: a label would REPLACE the content-derived
		// accessible name and cost a screen reader the badge, the parent line and
		// the rollup — the very details that say what this inert card stands for.
		card.setAttribute('aria-description', "Outside this base's filter — shown for context");
	}
	const title = card.createDiv({ cls: 'pbl-card-title' });
	renderTitleText(host, title, item.title);

	// Where in the tree the card sits — on a board, the hierarchy travels on the
	// card. An excluded parent still labels it: reading is what context is for.
	if (item.parent) {
		const parent = card.createDiv({ cls: 'pbl-card-parent' });
		drawIcon(parent.createSpan({ cls: 'pbl-card-parent-icon' }), 'corner-left-up');
		parent.createSpan({ text: item.parent.title });
		setTooltip(parent, `Under "${item.parent.title}"`);
	}

	// A card draws the plain columns, the tag pills, and the assignee chip. State and
	// horizon stay chips of the TREE only: a board card's column already IS its state
	// and a bucket already IS its horizon, so either chip on the card would repeat what
	// the card's own position says. The assignee has no such equivalent on any
	// projection — nothing about a card's position ever says who is on it — so it keeps
	// its row's chip shape rather than becoming a value with no edit affordance. Risk is
	// in the identical position and stays excluded regardless, not by the same argument:
	// nobody has asked for it on a card yet (ADR 0027 records the amendment and its
	// scope). Filtered from the ONE resolved list rather than resolved a second time —
	// two derivations of "what is on screen" is how the tag menu once came to offer
	// editing for a column the renderer had skipped.
	//
	// The DATE ends are here too, and they are the case that shows the rule above is about
	// REPETITION rather than about which kinds are chips. A board column already is a
	// card's state and a bucket already is its horizon, so those chips would say twice what
	// the card's position says once — but no board column and no bucket says anything about
	// WHEN, so a date on a card is the only place that value appears. Dropping them was a
	// silent regression the moment `columnKind` stopped calling them `value` (found by
	// review, PR #152): they had always drawn on cards, as values, and nothing about this
	// feature was a reason to take them away. `renderCell` is what keeps them read-only
	// there — see its own note on the projection.
	const cardColumns = ctx.columns.filter(
		(column) =>
			column.kind === 'value' ||
			column.kind === 'tags' ||
			column.kind === 'assignee' ||
			column.kind === 'start' ||
			column.kind === 'target',
	);
	// Cards stack their cells and size each to content (`styles/cards.css`) rather than
	// sharing the tree's fixed-width, header-aligned columns, so a cell with nothing to
	// show is not a value that happens to be blank — it is a chip-shaped gap the layout
	// has no reason to reserve. `dropEmpty` is the tree/card difference stated once, in
	// `renderPropCells` itself, rather than here as a second opinion about it.
	if (cardColumns.length > 0) renderPropCells(ctx, card, item, cardColumns, { dropEmpty: true });
	renderRollup(host, card, item);
	// One call, three surfaces: board cards, roadmap bucket cards and shelf cards all
	// come through here. Timeline rows never do — they use the card SHELL with a
	// bar-grid row layout — which is exactly why they get no disclosure.
	renderCardChildren(ctx, card, item);
}

/**
 * Click opens (selecting first), middle-click opens in a new tab — every projection's
 * cards.
 *
 * `fold` is the one caller's exception and is deliberately a parameter rather than a
 * question asked here: the dated axis's timeline ROWS come through this function too, and
 * they are the only thing it wires that has a fold to do (`renderTimelineRow` passes
 * `foldOnClick`). A card's disclosure lists children on the card's own face and a card
 * with none draws no disclosure at all, so "clicking an item folds it" has nothing to mean
 * on one — asking the setting here would make the commonest card inert. Passing it in
 * keeps that a fact about the call sites rather than a branch every card projection has to
 * be read against.
 */
export function wireCardActivation(
	ctx: RowContext,
	card: HTMLElement,
	item: BacklogItem,
	fold?: (evt: MouseEvent) => boolean,
): void {
	// The same filter the tree's rows ask — see `fromRowControl`. A card contains buttons
	// (the disclosure, the match links, the chips, the add) and a timeline row contains
	// two more that are not buttons (the bar grips, the connector's neighbours), and none
	// of them means "open this note".
	card.addEventListener('click', (evt) => {
		if (fromRowControl(evt)) return;
		ctx.host.selectItem(item, false);
		// Selected first either way, and opened only if the fold did not spend the click —
		// the tree's own order in `wireRowEvents`, so one gesture cannot both fold a row
		// and open its note.
		if (fold?.(evt)) return;
		ctx.host.openItem(item, evt);
	});
	card.addEventListener('auxclick', (evt) => {
		if (evt.button === 1 && !fromRowControl(evt)) ctx.host.openItemIn(item, 'tab');
	});
	// The menu is the non-drag path, and on touch the only one — so a card carries it
	// exactly as a row does, whichever projection drew it. What it offers differs per
	// projection (see `buildItemMenu`): a board card has no visible neighbours to
	// rank against, and its Set state is the board's columns.
	card.addEventListener('contextmenu', (evt) => showItemMenu(ctx.host, evt, item, childTypeChoices(item)));
}

/**
 * The matches the search found beneath this item, named on the surface that drew it so
 * they can be opened. Whether the surface's own item matched makes no difference: a match
 * below it is a second, distinct result, and one card cannot stand for two. Suppressing
 * these because the card matched too is how the deeper one becomes unreachable — the exact
 * failure this exists to prevent. Nothing is rendered when nothing hides below,
 * which is the ordinary case and needs no special test.
 *
 * Exported, because it is not the board's alone: every roadmap surface calls it through
 * `nameMatches` (`render/roadmap.ts`). It takes the surface's own `PlacedMount` rather
 * than the pieces, because three of that record's fields are exactly the three answers
 * only the surface has — where the links go, what it already lists, and which FACE it can
 * afford — and passing them flat put this function over the repo's `max-params` budget.
 *
 * `listsChildren` decides the subtraction: a board card lists its children and passes
 * `true`; a timeline row draws no disclosure at all and passes `false`, or the
 * subtraction would delete its one direct-child match.
 *
 * `face` decides what is drawn, and the two are separate questions — see `PlacedMount`.
 * A CARD gets a button per match. A ROW gets one fixed-width count chip, because a sticky
 * lead column's only shrinkable items are the row's title and this, so a variable-width
 * list here is width taken out of the row's own name.
 *
 * Buttons with `tabindex="-1"` either way, exactly as the tree's per-row controls are — a
 * card projection is one tab stop, so Tab keeps skipping past the whole projection. That
 * makes the row MENU their keyboard path rather than an extra: `addMatchSection` offers
 * the same matches, from the same walk. Pointer-only links would fail this feature at its
 * own purpose, which is that a found match can be reached.
 */
export function renderCardMatches(ctx: RowContext, carded: Set<string>, placed: PlacedMount): void {
	const host: BacklogViewHost = ctx.host;
	if (!host.isFiltering()) return;
	const { item, mount, listsChildren } = placed;
	const matches = undisclosedMatches(host, item, carded, listsChildren ? listedChildren(host, item) : []);
	if (matches.length === 0) return;
	if (placed.face === 'count') return renderMatchCount(ctx, mount, item, matches.length);
	const list = mount.createDiv({ cls: 'pbl-card-matches' });
	drawIcon(list.createSpan({ cls: 'pbl-card-matches-icon' }), 'search');
	for (const match of matches) {
		const link = list.createEl('button', {
			cls: 'pbl-card-match',
			text: match.title,
			attr: { type: 'button', tabindex: '-1' },
		});
		setTooltip(link, `Open "${match.title}"`);
		// No `stopPropagation`: `fromRowControl` filters this button out of the card's
		// own handler, so the two cannot both fire and open two different notes.
		link.addEventListener('click', (evt) => host.openItem(match, evt));
		link.addEventListener('auxclick', (evt) => {
			if (evt.button === 1) host.openItemIn(match, 'tab');
		});
	}
}

/**
 * A ROW's answer to the same question: how many, not which — one chip that opens the row's
 * own menu, where the matches are named in full.
 *
 * **It SUBSTITUTES rather than adds, and that is the whole design.** A sticky lead is a
 * fixed-width column whose only shrinkable item is the row's own title, so anything added
 * to it is taken from the row's name — measured twice in the browser harness and wrong
 * both times: match titles in the lead left one character of the row's name at the DEFAULT
 * width (`O… 4/17 ⌕O…`), and a fixed-width chip beside the rollup still cost 34px there
 * and, being unable to yield, hung 28.95px out of the column at the narrowest.
 *
 * The lead already carries a count slot — `.pbl-bar-count`, the rollup — and matches exist
 * only while the quick filter runs. So the slot shows the rollup unfiltered and the match
 * count while filtering, never both: the width budget does not move. It is the better
 * number during a search on its own merits, since a rollup counts every descendant
 * regardless of what the filter narrowed to, and the rollup stays ANNOUNCED either way
 * through `renderBarProgress`'s `.pbl-sr-only` span, which costs no width at all.
 *
 * Replaced in the slot's own PLACE rather than appended after it: `margin-inline-start:
 * auto` on that slot is what anchors the end of the lead, and `renderRowFacts` may draw a
 * dependency flag after it. Where the rollup is off entirely there is no slot and no
 * substitution to make, so the chip is simply the last thing in the lead — which is where
 * its own auto margin puts it.
 *
 * `tabindex="-1"` and no `stopPropagation`, the match link's own bargain: `ROW_CONTROL`
 * covers every `button`, so `fromRowControl` already keeps this out of the row's activation
 * handler — a per-control guard here would be the eleventh of the ten that rule replaced.
 */
function renderMatchCount(ctx: RowContext, mount: HTMLElement, item: BacklogItem, count: number): void {
	const said = t('row.searchMatches', { count });
	const chip = mount.createEl('button', {
		cls: 'pbl-row-matches',
		attr: { type: 'button', tabindex: '-1', 'aria-label': said },
	});
	drawIcon(chip.createSpan({ cls: 'pbl-row-matches-icon' }), 'search');
	chip.createSpan({ text: String(count) });
	setTooltip(chip, `${said} — open the menu to reach them`);
	chip.addEventListener('click', (evt) => showItemMenu(ctx.host, evt, item, childTypeChoices(item)));
	// `replaceWith` MOVES the chip into the slot's position, so the element created above
	// lands where the rollup was rather than after everything drawn since.
	mount.querySelector('.pbl-bar-count')?.replaceWith(chip);
}
