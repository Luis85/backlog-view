import { setIcon, setTooltip } from 'obsidian';
import { renderPropCells, renderRollup, RowContext } from './columns';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { renderBadge, renderTitleText } from './rows';
import { BacklogViewHost, BoardSnapshot } from '../host';
import { uniqueElementId } from '../selection';
import { BoardDragController } from '../interactions/boardDrag';
import { showItemMenu } from '../interactions/menu';
import { boardColumns, BoardColumn, BoardModel, cardPaths, hiddenMatches } from '../../domain/board';
import { childTypeChoices } from '../../domain/itemTypes';
import { BacklogItem } from '../../domain/model';

/**
 * The board projection: the same model the tree renders, projected onto the
 * workflow's columns. A card is a result row wearing a different layout — badge,
 * title, the same resolved property columns, the rollup — so switching projections
 * costs no information about an item.
 */
export function renderBoard(ctx: RowContext, boardEl: HTMLElement, dnd: BoardDragController): BoardSnapshot {
	// Annotated rather than inferred from `ctx.host` so `npm run check` can see which
	// host members this file uses — fallow resolves interface members through an
	// explicit type and not through a property access. See the root CLAUDE.md.
	const host: BacklogViewHost = ctx.host;
	const model = host.model;
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [] };
	const board = boardColumns(
		model,
		host.settings,
		(item) => !host.isRowHidden(item),
		(item) => !host.isRowHiddenUnfiltered(item),
	);

	renderBoardInstructions(boardEl);
	const colsEl = boardEl.createDiv({ cls: 'pbl-board-cols' });
	// Which items have a card of their own, so a card naming the matches below it can
	// skip the ones already on screen. Built once per pass rather than searched per card.
	const carded = cardPaths(board);
	const colEls = board.columns.map((col) => renderColumn(ctx, colsEl, col, dnd, carded));
	dnd.wireBoard(boardEl);
	renderBoardAdvisory(ctx, boardEl, board);
	return { board, colEls };
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
function renderBoardAdvisory(ctx: RowContext, boardEl: HTMLElement, board: BoardModel): void {
	const host = ctx.host;
	const model = host.model;
	if (!model || board.columns.some((col) => col.cards.length > 0)) return;
	const aside = boardEl.createDiv({ cls: 'pbl-board-advisory' });
	if (model.results.length === 0) renderEmptyState(host, aside);
	else if (host.isFiltering()) renderFilterEmptyState(host, aside);
	else renderAllDoneState(host, aside, model.results.length);
}

function renderColumn(
	ctx: RowContext,
	colsEl: HTMLElement,
	col: BoardColumn,
	dnd: BoardDragController,
	carded: Set<string>,
): HTMLElement {
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
	renderColumnHeader(colEl, col, strip, filtering);
	const cardsEl = colEl.createDiv({ cls: 'pbl-board-col-cards' });
	for (const card of col.cards) renderCard(ctx, cardsEl, card, dnd, carded);
	dnd.wireColumn(colEl, col);
	dnd.wireBoard(cardsEl);
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
	if (filtering) return `${label}, ${col.count} of ${col.fullCount} cards match`;
	return `${label}, ${col.count} card${col.count === 1 ? '' : 's'}`;
}

function renderColumnHeader(colEl: HTMLElement, col: BoardColumn, strip: boolean, filtering: boolean): void {
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
	}
	if (col.outsideWorkflow) {
		const mark = header.createSpan({ cls: 'pbl-board-col-stray' });
		setIcon(mark, 'circle-help');
		setTooltip(
			colEl,
			`"${col.label}" is not one of the configured workflow states. Add it to "Workflow states (in order)" in the view options, or move its cards.`,
		);
	}
	if (strip) setTooltip(colEl, 'Drop a card here to clear its state');
	// The full column says what the strip says: same target, different size — and
	// the one column whose drop REMOVES rather than writes has to say so somewhere
	// a real state named like it cannot.
	else if (col.state === null) setTooltip(colEl, 'Items without the state property — dropping a card here removes it');
}

function renderCard(
	ctx: RowContext,
	cardsEl: HTMLElement,
	item: BacklogItem,
	dnd: BoardDragController,
	carded: Set<string>,
): void {
	const card = createCard(ctx, cardsEl, item);
	renderCardBody(ctx, card, item);
	// The board's own addition to the shared body: which items already have a card is
	// a question only the board can answer, so the roadmap does not get this and the
	// shared body stays the thing both projections agree on.
	renderCardMatches(ctx, card, item, carded);
	wireCardActivation(ctx, card, item);
	dnd.wireCard(card, item);
}

/**
 * A card's shell, registered in the row index so selection and targeted lookups
 * reach it. Shared with the roadmap: a card is a result row wearing the card
 * layout, whichever projection drew it.
 */
export function createCard(ctx: RowContext, containerEl: HTMLElement, item: BacklogItem): HTMLElement {
	const selected = ctx.host.selectedPath === item.file.path;
	const card = containerEl.createDiv({
		cls:
			'pbl-card' +
			(item.done ? ' pbl-done' : '') +
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
}

/** Click opens (selecting first), middle-click opens in a new tab — every projection's cards. */
export function wireCardActivation(ctx: RowContext, card: HTMLElement, item: BacklogItem): void {
	card.addEventListener('click', (evt) => {
		ctx.host.selectItem(item, false);
		ctx.host.openItem(item, evt);
	});
	card.addEventListener('auxclick', (evt) => {
		if (evt.button === 1) ctx.host.openItemInNewTab(item);
	});
	// The menu is the non-drag path, and on touch the only one — so a card carries it
	// exactly as a row does, whichever projection drew it. What it offers differs per
	// projection (see `buildItemMenu`): a board card has no visible neighbours to
	// rank against, and its Set state is the board's columns.
	card.addEventListener('contextmenu', (evt) => showItemMenu(ctx.host, evt, item, childTypeChoices(item)));
}

/**
 * The matches the search found beneath this card, named on its face so they can be
 * opened. Only for a card kept by something below it: a card that matched IS the
 * result, and listing its children under it would bury the thing the user searched for.
 *
 * Buttons with `tabindex="-1"`, exactly as the tree's per-row controls are — the board
 * is one tab stop, so Tab keeps skipping past the whole projection. That makes the
 * card MENU their keyboard path rather than an extra: `addMatchSection` offers the
 * same matches, from the same walk. Pointer-only links would fail this feature at its
 * own purpose, which is that a found match can be reached.
 */
function renderCardMatches(ctx: RowContext, card: HTMLElement, item: BacklogItem, carded: Set<string>): void {
	const host: BacklogViewHost = ctx.host;
	if (!host.isFiltering() || host.isFilterMatch(item)) return;
	const matches = hiddenMatches(item, (child) => host.isFilterMatch(child), carded);
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
		link.addEventListener('click', (evt) => {
			// Without this the card's own handler runs too and opens the PARENT — the
			// one note the user demonstrably did not click.
			evt.stopPropagation();
			host.openItem(match, evt);
		});
		// A middle click never fires `click`, so without its own handler it would reach
		// the card's `auxclick` and open the parent in a new tab — the same wrong note,
		// by the one route stopping the primary click does not cover.
		link.addEventListener('auxclick', (evt) => {
			if (evt.button !== 1) return;
			evt.stopPropagation();
			host.openItemInNewTab(match);
		});
	}
}
