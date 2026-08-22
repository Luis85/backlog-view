import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { renderCardChildren } from './cardChildren';
import { renderPropCells, renderRollup, RowContext } from './columns';
import {
	renderAllDoneState,
	renderBoardExcludedFocusState,
	renderEmptyState,
	renderNoDeliverablesState,
} from './emptyStates';
import { fromRowControl, renderBadge, renderChevron } from './rows';
import { BacklogViewHost, BoardSnapshot, ColumnScope } from '../host';
import { uniqueElementId } from '../selection';
import { CardDragController } from '../interactions/cardDrag';
import { showColumnMenu } from '../interactions/columnMenu';
import { showItemMenu } from '../interactions/menu';
import {
	boardColumns,
	BoardColumn,
	BoardModel,
	deliverablesWorkflow,
	columnFoldValue,
	emptyNoState,
	overBy,
	ownWorkflowReading,
	requirementsFocusRoots,
	requirementsWorkflow,
} from '../../domain/board';
import { childTypeChoices, focusTarget, isDeliverableType } from '../../domain/itemTypes';
import { BacklogItem, inPlan } from '../../domain/model';

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
	 * The stray-column tooltip for THIS workflow (`renderColumnHeader`), so the hint
	 * points at the setting that actually holds this board's states — found by review: an
	 * unparametrized tooltip hardcoded the requirements option name, so a stray
	 * Deliverables column told the user to edit "Workflow states (in order)", a property
	 * this board ignores entirely.
	 *
	 * The WHOLE sentence per workflow rather than the option's name spliced into a shared
	 * frame: the name is `domain/viewOptions.ts`'s and still English, so a key for it here
	 * would be keying somebody else's string — the debt `board.undeclaredColumn` states.
	 *
	 * OPTIONAL, because a board whose columns are not a state vocabulary can have no stray
	 * to explain: `iterationBuckets` sets `outsideWorkflow: false` on all three of its
	 * fixed buckets, so the hint is unreachable there and a function passed for it would be
	 * dead. It was passed anyway until 2026-08-21 — invisible while it was a plain string,
	 * and reported as an uncovered function the moment it became a call.
	 */
	undeclaredColumn?: (state: string) => string;
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
 * they are rendering. Found by review: the first draft threaded these as separate
 * trailing parameters, which pushed `renderColumn` to six and past the repo's
 * `max-params: 5`. `renderCard` takes four, so flattening this pair there would land
 * on exactly five and lint green — the bundle is shared because the two are one
 * concern, and only one of them is held inside the rule by it. Naming which one is
 * what keeps this sentence checkable: count the parameters and the arithmetic
 * either holds or it does not.
 */
interface ColumnRenderCtx {
	dnd: CardDragController;
	opts: BoardRenderOptions;
}

/** What the column's own header draws differently, decided by `renderBoard` and passed down. */
interface ColumnFrame {
	/** The empty no-state column's leading drop strip — see `renderColumn`. */
	strip: boolean;
	/** Folded to that same strip by the reader, or by the done column's own default. */
	folded: boolean;
}

/**
 * The board projection: the same model the tree renders, projected onto the
 * workflow's columns. A card is a result row wearing a different layout — badge,
 * title, the same resolved property columns, the rollup — so switching projections
 * costs no information about an item. Shared by both board-shaped projections; what
 * differs between them (whose workflow, whose move, whose empty state) rides in `opts`.
 */
export function renderBoard(
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
	// board drawn before its results arrive — a Bases pass that has not warmed up — has an
	// empty Done like every other column,
	// and without this term it would shut Done for good and hand the work back folded. Same
	// hazard `collapseNewParents` states for a model that has not loaded, one projection
	// over. An empty column is also nothing to hide: "done columns stay lean" is about
	// finished work taking a stage's room, and no work takes none.
	//
	// `held` and not `count`, which was this term's first spelling and got the feature's
	// own case backwards: `count` is measured through the visibility rule, and the
	// completed-items toggle lives in that, so with finished work hidden a done column FULL
	// of finished work reported zero and refused the fold in exactly the configuration
	// extension 3b of the requirement is about. Found by review (Codex, PR #140).
	const foldsFinished = opts.foldsFinished ?? true;
	const folds = board.columns.map((col) =>
		// `columnFoldValue`, which is what the header below and the column menu ask. This
		// line spelled the same expression out until 2026-08-16 and AGREED with them — the
		// honest statement, since nothing was broken by it. What it was, was a second
		// spelling of an identity extracted into one function precisely because the render
		// and the two controls had already disagreed about it once (an Open bucket drawn
		// from `open` while its disclosure toggled `new`, found by review, PR #154).
		ctx.host.columnCollapsed(
			opts.scope,
			columnFoldValue(col),
			foldsFinished && col.done && col.held > 0 && !col.openWork,
		),
	);
	// A folded column draws no cards, and the SNAPSHOT is where that is said, because the
	// keyboard reads the snapshot: `boardPosition`, `nextBoardPosition` and Alt+arrow all
	// walk `snapshot.board.columns[].cards`, so emptying the list here is what stops the
	// selection landing on a card no longer on screen — without any of them asking about a
	// fold. `renderShelf` contributes to the roadmap's own card list the same way.
	const drawn: BoardModel = { ...board, columns: board.columns.map((col, i) => (folds[i] ? { ...col, cards: [] } : col)) };
	const render: ColumnRenderCtx = { dnd, opts };
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
	// nowhere: `boardColumns` already zeroes every `outsideFilter` card out of `count`
	// regardless of type.
	const board = boardColumns(
		// Its `observedValues` is already Deliverable-free — the stray-column half of
		// this same exclusion, stated in the workflow itself.
		requirementsWorkflow(model, host.settings),
		model.focused ? requirementsFocusRoots(model.roots) : model.results,
		(item) => !host.isRowHidden(item) && (item.outsideFilter || !isDeliverableType(item.typeName)),
		// What this board OWNS, and nothing about what is hidden inside it. The predicate
		// above carries the completed-items toggle, which is exactly what
		// `BoardColumn.held` may not be measured through — see the fold default in
		// `renderBoard`.
		//
		// MEMBERSHIP and the type, never the type alone: under a focus the candidates are
		// `requirementsFocusRoots(model.roots)`, which descends a non-context `Deliverable`
		// into its raw `children` — and those are not membership-filtered, so a `Test suite`
		// or an `Iteration` arrives among them. `visible` drops such a row by membership, so
		// it is no card; asking only the type still HELD it, and both readers of `held` then
		// spoke for a row this board never draws — a WIP badge one over on a column drawing
		// two cards under a limit of two, and a done column settling permanently folded on
		// evidence nobody could see.
		(item) => inPlan(item) && !isDeliverableType(item.typeName),
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		scope: 'board',
		move: (item, col) => void host.performBoardMove(item, col.state),
		undeclaredColumn: (state) => t('board.undeclaredColumn', { state }),
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
			else renderAllDoneState(h, aside, population.length, root);
		},
	});
}

/**
 * The Deliverables board — every Deliverable-typed item the base holds, in every
 * focus state. It reads `model.deliverableResults`, never `model.results` or
 * `model.roots`: the human's own request is that a focus level set on another
 * projection must never make a Deliverable invisible here, and `model.results` is
 * itself narrowed to the focused subtree while a focus is active (`buildModel`'s
 * `shown()`) — `domain/model.ts` builds `deliverableResults` off the whole, unfocused
 * tree for exactly this projection. Every candidate here is already Deliverable-typed
 * by construction. Also regardless of either workflow's completion state (Scope: no
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
		undeclaredColumn: (state) => t('board.undeclaredDeliverableColumn', { state }),
		drawEmpty: (h, aside, root) => {
			const m = h.model;
			if (!m) return;
			if (m.deliverableResults.length === 0) renderNoDeliverablesState(aside);
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
		text: t('board.instructions'),
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
	// without a permanently empty column. "Empty" is the CARDS DRAWN, and it is one
	// reading rather than a choice between two: `emptyNoState` read a lifted population
	// until the quick filter took that field with it (2026-08-17). The strip is what a
	// stage with no name of its own and nothing to SHOW shrinks to, and the cards are
	// what it shows — the argument for which reading, and the one thing that can still be
	// said structurally about the toggle here, is at `emptyNoState` in `domain/board.ts`.
	// A folded column reaches the strip WITHOUT being one: `strip` is the empty no-state
	// column's own case and suppresses the count, while a fold keeps name and count
	// visible. Two states, one width — see `.pbl-board-collapsed` in `styles/board.css`.
	const frame: ColumnFrame = {
		strip: emptyNoState(col) && !folded,
		folded,
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
	const label = col.state === null && col.takesDrop ? t('board.clearingColumn', { label: col.label }) : col.label;
	// The fold is spoken HERE and not left to the disclosure's own `aria-expanded`, which
	// nothing on the keyboard path reaches: this string is the stop's `aria-label`, and an
	// accessible name overrides the children it is set on, so a reader arriving by
	// `aria-activedescendant` hears the name, the count, and no button at all. Without the
	// word, a folded column announces cards it is not showing — the one thing a count that
	// deliberately survives the fold makes worse rather than better.
	// Whole sentences picked between, never a frame with clauses appended: the fold, the
	// limit and the overage each change the sentence, and the count is a plural form OF it
	// rather than a rendered figure spliced in — `roadmap.groupLabel`'s shape.
	const count = col.count;
	if (col.limit === null) {
		return frame.folded
			? t('board.columnLabelFolded', { name: label, count })
			: t('board.columnLabel', { name: label, count });
	}
	// The overage is spoken because the icon beside it is not: an over-limit column
	// has to say so to someone who cannot see either the colour or the shape.
	const over = overBy(col);
	const limit = col.limit;
	if (over > 0) {
		return frame.folded
			? t('board.columnLabelFoldedOver', { name: label, count, limit, over })
			: t('board.columnLabelOver', { name: label, count, limit, over });
	}
	return frame.folded
		? t('board.columnLabelFoldedLimit', { name: label, count, limit })
		: t('board.columnLabelLimit', { name: label, count, limit });
}

function renderColumnHeader(
	ctx: RowContext,
	colEl: HTMLElement,
	col: BoardColumn,
	frame: ColumnFrame,
	opts: BoardRenderOptions,
): void {
	const { strip } = frame;
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
	if (!strip) renderColumnFold(ctx.host, header, opts.scope, columnFoldValue(col), { folded: frame.folded, label: col.label });
	if (col.done) drawIcon(header.createSpan({ cls: 'pbl-board-col-icon' }), 'circle-check');
	if (col.state === null) drawIcon(header.createSpan({ cls: 'pbl-board-col-icon' }), 'circle-dashed');
	header.createSpan({ cls: 'pbl-board-col-name', text: col.label });
	if (!strip) renderColumnCount(header, col);
	renderColumnHints(colEl, header, col, strip, opts.undeclaredColumn);
	renderColumnPolicy(header, col);
	// On the header rather than inside `renderColumnPolicy`, because the menu is no longer
	// the policy's: every column has a fold to offer, so every column has a menu — which
	// is also what makes the fold's keyboard path the one the column stop already answers.
	header.addEventListener('contextmenu', (evt) => showColumnMenu(ctx.host, evt, opts.scope, col));
}

/** How many cards, and how many the stage agreed to. */
function renderColumnCount(header: HTMLElement, col: BoardColumn): void {
	header.createSpan({ cls: 'pbl-board-col-count', text: String(col.count) });
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
	undeclaredColumn?: (state: string) => string,
): void {
	// Both halves: a stray column can only exist on a board whose columns came from a
	// state vocabulary, and only such a board supplies the sentence that explains one.
	if (col.outsideWorkflow && undeclaredColumn) {
		drawIcon(header.createSpan({ cls: 'pbl-board-col-stray' }), 'circle-help');
		setTooltip(colEl, undeclaredColumn(col.label));
	}
	if (strip) setTooltip(colEl, t('board.stripTooltip'));
	else if (col.state === null) setTooltip(colEl, t('board.noStateColumn'));
}

/**
 * A column's own disclosure — `renderChevron`, the control every other fold in this plugin
 * draws, so the two forms, the `tabindex="-1"` that keeps the pane one tab stop, and the
 * focus report all arrive with it rather than being remembered here.
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
		label: t(col.folded ? 'fold.expandColumn' : 'fold.collapseColumn', { name: col.label }),
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
export function renderCardBody(
	ctx: RowContext,
	card: HTMLElement,
	item: BacklogItem,
	// Where the children disclosure goes, when that is not `card` itself. The shelf's
	// compact row is the one caller that passes it: its summary is a one-line flex ROW, and
	// a child list inside that row would sit beside the title rather than beneath it — so
	// the row hands its own card element here while the summary takes everything else. A
	// wrapper, never different content: the same children are built either way.
	//
	// `holdEmpty` is the same shape for the same kind of difference, and it is the TREE's
	// rule rather than a new one. A card DROPS a cell with nothing in it, because it stacks
	// its cells and sizes each to content, so a blank one is a chip-shaped gap the layout has
	// no reason to reserve. A ROW's cells are fixed width and shared with every row beside
	// it, so a dropped cell shifts every cell after it and the column stops being one.
	//
	// `rollupEl` is `kidsEl`'s own shape, for the third time and the last. A compact row
	// needs its trailing geometry FIXED, and the rollup is one of three things that are
	// present on some rows and absent on others; a box that is always drawn and always
	// reserved is what turns three absences into one width. `renderRollup` fills it or
	// draws nothing into it, and the row is the same either way.
	//
	// `toggleEl` is `renderCardChildren`'s own option, passed straight through: a compact
	// row's summary is a line, so the toggle belongs ON it while the list stays beneath in
	// `kidsEl`. Absent, the card stacks and the toggle builds inside its own wrapper.
	{
		kidsEl,
		holdEmpty = false,
		rollupEl,
		toggleEl,
	}: { kidsEl?: HTMLElement; holdEmpty?: boolean; rollupEl?: HTMLElement; toggleEl?: HTMLElement } = {},
): void {
	const host = ctx.host;
	const head = card.createDiv({ cls: 'pbl-card-head' });
	renderBadge(host, head, item);
	if (item.outsideFilter) {
		const marker = head.createSpan({ cls: 'pbl-outside-marker' });
		drawIcon(marker, 'corner-left-down');
		setTooltip(marker, t('board.contextMarker'));
		// A description, not a label: a label would REPLACE the content-derived
		// accessible name and cost a screen reader the badge, the parent line and
		// the rollup — the very details that say what this inert card stands for.
		card.setAttribute('aria-description', t('board.contextCard'));
	}
	const title = card.createDiv({ cls: 'pbl-card-title' });
	title.setText(item.title);

	// Where in the tree the card sits — on a board, the hierarchy travels on the
	// card. An excluded parent still labels it: reading is what context is for.
	if (item.parent) {
		const parent = card.createDiv({ cls: 'pbl-card-parent' });
		drawIcon(parent.createSpan({ cls: 'pbl-card-parent-icon' }), 'corner-left-up');
		parent.createSpan({ text: item.parent.title });
		setTooltip(parent, t('board.cardParent', { title: item.parent.title }));
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
	if (cardColumns.length > 0) renderPropCells(ctx, card, item, cardColumns, { dropEmpty: !holdEmpty });
	renderRollup(host, rollupEl ?? card, item);
	// One call, three surfaces: board cards, roadmap bucket cards and shelf cards all
	// come through here. Timeline rows never do — they use the card SHELL with a
	// bar-grid row layout — which is exactly why they get no disclosure.
	renderCardChildren(ctx, kidsEl ?? card, item, { toggleEl });
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
	wireOpenGestures(ctx.host, card, item, (evt) => {
		ctx.host.selectItem(item, false);
		// Selected first either way, and opened only if the fold did not spend the click —
		// the tree's own order in `wireRowEvents`, so one gesture cannot both fold a row
		// and open its note.
		return fold?.(evt) ?? false;
	});
	wireItemMenu(ctx.host, card, item);
}

/**
 * The two gestures that OPEN a note, wired as a pair because they are one affordance and
 * a browser splits them: a middle click never fires `click` at all, so a surface that
 * wires only the primary one silently loses "open in a new tab" — which is how it left a
 * milestone's diamond when that mark inherited the row's job (review, 2026-08-16).
 *
 * Both ask `fromRowControl`, the receiver's own filter: a card contains buttons (the
 * disclosure, the match links, the chips, the add), a timeline row contains two that are
 * not buttons (the bar grips), and a diamond contains the dependency connector. None of
 * them means "open this note".
 *
 * `before` runs on the primary click only and returns whether it SPENT the gesture — the
 * one thing that differs between a card, which selects and may fold, and a mark that is no
 * selection stop at all. A middle click has no such question: it always opens a tab.
 */
export function wireOpenGestures(
	host: BacklogViewHost,
	el: HTMLElement,
	item: BacklogItem,
	before?: (evt: MouseEvent) => boolean,
): void {
	el.addEventListener('click', (evt) => {
		if (fromRowControl(evt)) return;
		if (before?.(evt)) return;
		host.openItem(item, evt);
	});
	el.addEventListener('auxclick', (evt) => {
		if (evt.button === 1 && !fromRowControl(evt)) host.openItemIn(item, 'tab');
	});
}

/**
 * The item menu, which is the non-drag path to everything a pointer drag does and on touch
 * the only one — so every surface that draws an item carries it, whichever projection drew
 * it. What it OFFERS differs per surface (see `buildItemMenu`): a board card has no visible
 * neighbours to rank against, and its Set state is the board's columns.
 */
export function wireItemMenu(host: BacklogViewHost, el: HTMLElement, item: BacklogItem): void {
	el.addEventListener('contextmenu', (evt) => showItemMenu(host, evt, item, childTypeChoices(item)));
}

