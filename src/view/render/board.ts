import { setIcon, setTooltip } from 'obsidian';
import { renderPropCells, renderRollup, RowContext } from './columns';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { renderBadge, renderTitleText } from './rows';
import { BoardSnapshot } from '../host';
import { BoardDragController } from '../interactions/boardDrag';
import { boardColumns, BoardColumn, BoardModel, NO_STATE_LABEL } from '../../domain/board';
import { BacklogItem } from '../../domain/model';

/**
 * The board projection: the same model the tree renders, projected onto the
 * workflow's columns. A card is a result row wearing a different layout — badge,
 * title, the same resolved property columns, the rollup — so switching projections
 * costs no information about an item.
 */
export function renderBoard(ctx: RowContext, boardEl: HTMLElement, dnd: BoardDragController): BoardSnapshot {
	const host = ctx.host;
	const model = host.model;
	if (!model) return { board: { columns: [], cardCount: 0 }, colEls: [] };
	const board = boardColumns(model, host.settings, (item) => !host.isRowHidden(item));

	const colsEl = boardEl.createDiv({ cls: 'pbl-board-cols' });
	const colEls = board.columns.map((col) => renderColumn(ctx, colsEl, col, dnd));
	dnd.wireBoard(boardEl);
	renderBoardAdvisory(ctx, boardEl, board);
	return { board, colEls };
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
): HTMLElement {
	// The no-state column earns its room only while it holds cards; empty, it
	// shrinks to a leading drop strip so clearing a state by drag stays possible
	// without a permanently empty column.
	const strip = col.state === null && col.cards.length === 0;
	const colEl = colsEl.createDiv({
		cls:
			'pbl-board-col' +
			(col.done ? ' pbl-col-done' : '') +
			(col.outsideWorkflow ? ' pbl-col-outside' : '') +
			(col.state === null ? ' pbl-col-nostate' : '') +
			(strip ? ' pbl-board-strip' : ''),
		attr: { role: 'group', 'aria-label': columnLabel(col) },
	});
	renderColumnHeader(colEl, col, strip);
	const cardsEl = colEl.createDiv({ cls: 'pbl-board-col-cards' });
	for (const card of col.cards) renderCard(ctx, cardsEl, card, dnd);
	dnd.wireColumn(colEl, col);
	dnd.wireBoard(cardsEl);
	return colEl;
}

function columnLabel(col: BoardColumn): string {
	// Always col.label, never the constant: the synthetic column yields its name
	// when a real state claims it, and an accessible name that kept the old text
	// would disagree with the screen — unreachable by the very speech input that
	// targets columns by their visible name.
	const label = col.state === null ? `${col.label} — dropping here clears the state` : col.label;
	return `${label}, ${col.count} card${col.count === 1 ? '' : 's'}`;
}

function renderColumnHeader(colEl: HTMLElement, col: BoardColumn, strip: boolean): void {
	// The header doubles as the column's keyboard stop: an option-like element the
	// selection can make the listbox's active descendant, because the column itself
	// is a group and a group is not a valid active item — a screen reader told to
	// rest on one may announce nothing. See `.pbl-board-col-stop` in selection.ts.
	const header = colEl.createDiv({
		cls: 'pbl-board-col-header pbl-board-col-stop',
		attr: { role: 'option', 'aria-selected': 'false', 'aria-label': columnLabel(col) },
	});
	if (col.done) setIcon(header.createSpan({ cls: 'pbl-board-col-icon' }), 'circle-check');
	if (col.state === null) setIcon(header.createSpan({ cls: 'pbl-board-col-icon' }), 'circle-dashed');
	header.createSpan({ cls: 'pbl-board-col-name', text: col.label });
	if (!strip) header.createSpan({ cls: 'pbl-board-col-count', text: String(col.count) });
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

function renderCard(ctx: RowContext, cardsEl: HTMLElement, item: BacklogItem, dnd: BoardDragController): void {
	const host = ctx.host;
	const selected = host.selectedPath === item.file.path;
	const card = cardsEl.createDiv({
		cls:
			'pbl-card' +
			(item.done ? ' pbl-done' : '') +
			(item.outsideFilter ? ' pbl-card-context pbl-outside' : '') +
			(selected ? ' pbl-selected' : ''),
		attr: { role: 'option', 'aria-selected': String(selected) },
	});
	card.dataset.path = item.file.path;
	ctx.rows.set(item.file.path, card);

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

	card.addEventListener('click', (evt) => {
		host.selectItem(item, false);
		host.openItem(item, evt);
	});
	card.addEventListener('auxclick', (evt) => {
		if (evt.button === 1) host.openItemInNewTab(item);
	});
	dnd.wireCard(card, item);
}
