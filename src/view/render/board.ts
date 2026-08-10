import { setIcon, setTooltip } from 'obsidian';
import { renderCardChildren } from './cardChildren';
import { renderPropCells, renderRollup, RowContext } from './columns';
import {
	renderAllDoneState,
	renderBoardExcludedFocusState,
	renderEmptyState,
	renderFilterEmptyState,
	renderNoDeliverablesState,
} from './emptyStates';
import { fromRowControl, renderBadge, renderTitleText } from './rows';
import { BacklogViewHost, BoardSnapshot } from '../host';
import { uniqueElementId } from '../selection';
import { CardDragController } from '../interactions/cardDrag';
import { showColumnMenu, showItemMenu } from '../interactions/menu';
import {
	boardColumns,
	BoardColumn,
	BoardModel,
	cardPaths,
	deliverablesWorkflow,
	overBy,
	ownWorkflowReading,
	requirementsFocusRoots,
	requirementsWorkflow,
} from '../../domain/board';
import { childTypeChoices, focusTarget, isDeliverableType } from '../../domain/itemTypes';
import { BacklogItem } from '../../domain/model';
import { undisclosedMatches } from '../childrenList';

/** What differs between the two board-shaped projections' render passes. */
interface BoardRenderOptions {
	move: (item: BacklogItem, state: string | null) => void;
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
	// Which items have a card of their own, so a card naming the matches below it can
	// skip the ones already on screen. Built once per pass rather than searched per card.
	const render: ColumnRenderCtx = { dnd, carded: cardPaths(board), opts };
	const colEls = board.columns.map((col) => renderColumn(ctx, colsEl, col, render));
	dnd.wireScroller(boardEl);
	renderBoardAdvisory(ctx, boardEl, board, opts.drawEmpty);
	return { board, colEls };
}

/** The requirements board — `renderBoard`'s original, only caller until now. */
export function renderRequirementsBoard(ctx: RowContext, boardEl: HTMLElement, dnd: CardDragController): BoardSnapshot {
	// Annotated rather than inferred from `ctx.host` so `npm run check` can see which
	// host members this file uses — fallow resolves interface members through an
	// explicit type and not through a property access. See the root CLAUDE.md.
	const host: BacklogViewHost = ctx.host;
	const model = host.model;
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [] };
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
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		move: (item, state) => void host.performBoardMove(item, state),
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
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [] };
	const board = boardColumns(
		deliverablesWorkflow(model, host.settings),
		model.deliverableResults,
		(item) => !host.isRowHidden(item),
		() => true,
	);
	return renderBoard(ctx, boardEl, dnd, board, {
		move: (item, state) => void host.performDeliverablesBoardMove(item, state),
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

function renderColumn(ctx: RowContext, colsEl: HTMLElement, col: BoardColumn, render: ColumnRenderCtx): HTMLElement {
	// The no-state column earns its room only while it holds cards; empty, it
	// shrinks to a leading drop strip so clearing a state by drag stays possible
	// without a permanently empty column. "Empty" is about the POPULATION, not the
	// matches: a filter that hid every stateless card would otherwise collapse the
	// column to a strip, which says the work is gone rather than merely unmatched —
	// a stronger lie than the "0" the pair counts exist to prevent.
	const strip = col.state === null && col.cards.length === 0 && col.fullCount === 0;
	const filtering = ctx.host.isFiltering();
	const colEl = colsEl.createDiv({
		cls:
			'pbl-board-col' +
			(col.done ? ' pbl-col-done' : '') +
			(col.outsideWorkflow ? ' pbl-col-outside' : '') +
			(col.state === null ? ' pbl-col-nostate' : '') +
			(strip ? ' pbl-board-strip' : ''),
		attr: { role: 'group', 'aria-label': columnLabel(col, filtering) },
	});
	renderColumnHeader(colEl, col, strip, filtering, render.opts.stateOptionLabel);
	const cardsEl = colEl.createDiv({ cls: 'pbl-board-col-cards' });
	for (const card of col.cards) renderCard(ctx, cardsEl, card, render);
	// What a drop on this column MEANS is the board's; the controller only resolves
	// the card that was dragged and hands it here.
	render.dnd.wireDropTarget(colEl, (source) => render.opts.move(source.item, col.state));
	render.dnd.wireScroller(cardsEl);
	return colEl;
}

function columnLabel(col: BoardColumn, filtering: boolean): string {
	// Always col.label, never the constant: the synthetic column yields its name
	// when a real state claims it, and an accessible name that kept the old text
	// would disagree with the screen — unreachable by the very speech input that
	// targets columns by their visible name.
	const label = col.state === null ? `${col.label} — dropping here clears the state` : col.label;
	// Filtered, the count is a pair and has to be spoken as one: "2 cards" in a column
	// of eleven would tell a screen-reader user the stage had emptied.
	const counts = filtering
		? `${col.count} of ${col.fullCount} cards match`
		: `${col.count} card${col.count === 1 ? '' : 's'}`;
	if (col.limit === null) return `${label}, ${counts}`;
	// The overage is spoken because the icon beside it is not: an over-limit column
	// has to say so to someone who cannot see either the colour or the shape.
	const over = overBy(col);
	return `${label}, ${counts}, limit ${col.limit}${over > 0 ? `, over by ${over}` : ''}`;
}

function renderColumnHeader(
	colEl: HTMLElement,
	col: BoardColumn,
	strip: boolean,
	filtering: boolean,
	stateOptionLabel: string,
): void {
	// The header doubles as the column's keyboard stop: an option-like element the
	// selection can make the listbox's active descendant, because the column itself
	// is a group and a group is not a valid active item — a screen reader told to
	// rest on one may announce nothing. See `.pbl-board-col-stop` in selection.ts.
	const header = colEl.createDiv({
		cls: 'pbl-board-col-header pbl-board-col-stop',
		attr: { role: 'option', 'aria-selected': 'false', 'aria-label': columnLabel(col, filtering) },
	});
	if (col.done) setIcon(header.createSpan({ cls: 'pbl-board-col-icon' }), 'circle-check');
	if (col.state === null) setIcon(header.createSpan({ cls: 'pbl-board-col-icon' }), 'circle-dashed');
	header.createSpan({ cls: 'pbl-board-col-name', text: col.label });
	if (!strip) {
		// A column is a stage of the workflow, not a search result: while the filter
		// narrows the cards the header says how many of the stage's work it matched, so
		// nobody reads a filtered board as a column that emptied.
		const count = filtering ? `${col.count} of ${col.fullCount}` : String(col.count);
		header.createSpan({ cls: 'pbl-board-col-count' + (filtering ? ' pbl-board-col-count-filtered' : ''), text: count });
		if (col.limit !== null) {
			header.createSpan({ cls: 'pbl-board-col-limit', text: `/ ${col.limit}` });
			// More than colour alone: the class carries the colour, the icon carries the
			// shape, and `columnLabel` carries the words.
			if (overBy(col) > 0) {
				header.addClass('pbl-board-col-over');
				setIcon(header.createSpan({ cls: 'pbl-board-col-over-icon' }), 'triangle-alert');
			}
		}
	}
	if (col.outsideWorkflow) {
		const mark = header.createSpan({ cls: 'pbl-board-col-stray' });
		setIcon(mark, 'circle-help');
		setTooltip(
			colEl,
			`"${col.label}" is not one of the configured workflow states. Add it to "${stateOptionLabel}" in the view options, or move its cards.`,
		);
	}
	if (strip) setTooltip(colEl, 'Drop a card here to clear its state');
	// The full column says what the strip says: same target, different size — and
	// the one column whose drop REMOVES rather than writes has to say so somewhere
	// a real state named like it cannot.
	else if (col.state === null) setTooltip(colEl, 'Items without the state property — dropping a card here removes it');
	renderColumnPolicy(header, col);
}

/**
 * The column's working agreement, described rather than named: the policy says
 * what the column is FOR, and folding it into the accessible NAME would make
 * speech input target a column by a paragraph. Extension 3a keeps it off the tab
 * order — the affordance is a span, and the keyboard path is the column's menu.
 * A column with nothing agreed gets no affordance at all (extension 1a).
 */
function renderColumnPolicy(header: HTMLElement, col: BoardColumn): void {
	if (!col.policy) return;
	const description = header.createSpan({ cls: 'pbl-sr-only', text: col.policy });
	description.id = uniqueElementId('pbl-col-policy');
	header.setAttribute('aria-describedby', description.id);
	const affordance = header.createSpan({ cls: 'pbl-board-col-policy' });
	setIcon(affordance, 'info');
	setTooltip(affordance, col.policy);
	header.addEventListener('contextmenu', (evt) => showColumnMenu(evt, col.policy));
}

function renderCard(ctx: RowContext, cardsEl: HTMLElement, item: BacklogItem, render: ColumnRenderCtx): void {
	const card = createCard(ctx, cardsEl, item);
	renderCardBody(ctx, card, item);
	// The board's own addition to the shared body: which items already have a card is
	// a question only the board can answer, so the roadmap does not get this and the
	// shared body stays the thing both projections agree on.
	renderCardMatches(ctx, card, item, render.carded);
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
		setIcon(marker, 'corner-left-down');
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
		setIcon(parent.createSpan({ cls: 'pbl-card-parent-icon' }), 'corner-left-up');
		parent.createSpan({ text: item.parent.title });
		setTooltip(parent, `Under "${item.parent.title}"`);
	}

	if (ctx.chips.length > 0) renderPropCells(ctx, card, item);
	renderRollup(host, card, item);
	// One call, three surfaces: board cards, roadmap bucket cards and shelf cards all
	// come through here. Timeline rows never do — they use the card SHELL with a
	// bar-grid row layout — which is exactly why they get no disclosure.
	renderCardChildren(ctx, card, item);
}

/** Click opens (selecting first), middle-click opens in a new tab — every projection's cards. */
export function wireCardActivation(ctx: RowContext, card: HTMLElement, item: BacklogItem): void {
	// The same filter the tree's rows ask — see `fromRowControl`. A card contains buttons
	// (the disclosure, the match links, the chips, the add) and a timeline row contains
	// two more that are not buttons (the bar grips, the connector's neighbours), and none
	// of them means "open this note".
	card.addEventListener('click', (evt) => {
		if (fromRowControl(evt)) return;
		ctx.host.selectItem(item, false);
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
 * The matches the search found beneath this card, named on its face so they can be
 * opened. Whether the card ITSELF matched makes no difference: a match below it is a
 * second, distinct result, and one card cannot stand for two. Suppressing these
 * because the card matched too is how the deeper one becomes unreachable — the exact
 * failure this exists to prevent. Nothing is rendered when nothing hides below,
 * which is the ordinary case and needs no special test.
 *
 * Buttons with `tabindex="-1"`, exactly as the tree's per-row controls are — the board
 * is one tab stop, so Tab keeps skipping past the whole projection. That makes the
 * card MENU their keyboard path rather than an extra: `addMatchSection` offers the
 * same matches, from the same walk. Pointer-only links would fail this feature at its
 * own purpose, which is that a found match can be reached.
 */
function renderCardMatches(ctx: RowContext, card: HTMLElement, item: BacklogItem, carded: Set<string>): void {
	const host: BacklogViewHost = ctx.host;
	if (!host.isFiltering()) return;
	const matches = undisclosedMatches(host, item, carded);
	if (matches.length === 0) return;
	const list = card.createDiv({ cls: 'pbl-card-matches' });
	setIcon(list.createSpan({ cls: 'pbl-card-matches-icon' }), 'search');
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
