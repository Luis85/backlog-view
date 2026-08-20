import type { EstimationView } from './estimationView';
import { renderPanel } from './panel';
import { renderCurrencyChip } from './currencyChip';
import { t } from '../../i18n/t';
import { EstimationItem, EstimationModel } from '../../domain/estimationItems';
import { Currency } from '../../domain/weightedScore';
import { uniqueElementId } from '../selection';
import { loadViewState, saveViewState } from '../../storage/viewStateStore';
import { resolveViewIdentity } from '../../storage/viewIdentity';

/**
 * The prioritized list's table (`docs/requirements/The prioritized list.md`): a header
 * plus one row per RESULT — this view draws no tree and no context rows, so there is
 * nothing here that reads `outsideFilter` the way `render/rows.ts` does. Rebuilt fresh
 * on every `EstimationView.render()` pass, the same "empty and redraw" contract Task 5
 * already gives the whole view — there is no row-reuse question here yet.
 *
 * A free function over the view, `renderPass.ts`'s own shape — but importing only
 * `EstimationView`'s TYPE, never its value: `estimationView.ts` calls `renderTable`, so
 * a value import back would be the two-file cycle `src/view/CLAUDE.md` keeps `host.ts`
 * free of runtime code to avoid. `domain/dependencies.ts` uses the identical
 * `import type` shape against `bars.ts` for the same reason.
 *
 * Selection is one field on the view (`selectedPath`) plus one DOM id per row for
 * `aria-activedescendant` — not the tree's `SelectionController`, which exists to share
 * one selection across several projections. This view has one flat list, so a second
 * idea of what a selection is would buy nothing.
 *
 * Sort is the same shape again, one field (`view.sortPick`) mutated by this module
 * alone: a header click resolves this view's identity and read-modify-writes the pick
 * through `storage/viewStateStore.ts` (`estimationSort`), exactly the "working
 * position, per saved view, per device" rule the backlog's own `ViewState` keeps for
 * its folds and its roadmap axis — mirrored here at the scale this view actually needs,
 * a single string, with none of that controller's debouncing or multi-field bookkeeping.
 * Sorting itself runs over a COPY of `model.items`; the model's own array, and the Base
 * order it carries, is never mutated.
 */

/** The table-wide state a pick needs, bundled into one param the way `HeaderSpec` bundles
 *  one header button's shape below — `selectRow` otherwise sits one over the parameter
 *  budget. */
interface TableCtx {
	view: EstimationView;
	tableEl: HTMLElement;
	model: EstimationModel;
	rows: Map<string, HTMLElement>;
}

/**
 * Delegated click and keydown, both wired once per render pass — the table's own root.
 * `items` is this pass's SORTED order (a copy, or `model.items` itself when unsorted —
 * see {@link sortedItems}); arrow-key stepping walks it rather than `model.items`, so
 * the keyboard follows the same order the rows are drawn in. `model.byPath` is order-
 * independent and stays the lookup for the click guard and Enter alike.
 */
function wireEvents(
	view: EstimationView,
	tableEl: HTMLElement,
	model: EstimationModel,
	items: EstimationItem[],
	rows: Map<string, HTMLElement>,
): void {
	const ctx: TableCtx = { view, tableEl, model, rows };
	// Resolved by `data-path` against THIS pass's model, never a per-row closure over an
	// item — the same rule `render/rows.ts` states for the tree, restated here because
	// this table wires no per-row listener at all to forget it.
	tableEl.addEventListener('click', (evt) => {
		const rowEl = evt.target instanceof Element ? evt.target.closest('.pbl-est-row') : null;
		const path = rowEl instanceof HTMLElement ? rowEl.dataset.path : undefined;
		if (path && model.byPath.has(path)) selectRow(ctx, path, false);
	});
	tableEl.addEventListener('keydown', (evt) => {
		// A sort header is a real button living inside this same root now, so its own
		// Enter/Space must stay its own — never fall through to the row list's reading
		// of Enter, the resize grips' own rule for the identical reason
		// (`src/view/CLAUDE.md`, "both `handleRoadmapKeydown` and `handleTreeKeydown`…").
		if (evt.target !== tableEl) return;
		if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
			const path = step(items, view.selectedPath, evt.key === 'ArrowDown' ? 1 : -1);
			if (path) {
				evt.preventDefault();
				selectRow(ctx, path, true);
			}
			return;
		}
		// Into the panel beside this row. `Enter` keeps opening the note (extension 4a), so
		// this adds a key rather than reassigning one.
		if (evt.key === 'ArrowRight') {
			// Two separate lookups, never a selector LIST: `querySelector('a, b')` returns the
			// first match in document order across either branch rather than trying "a" before
			// falling back to "b" — since every radio is also a `button`, that collapsed to the
			// panel's first button regardless of which one actually held the roving tab stop.
			// The fallback (any button — reaches the orphan cleanup control on a panel with no
			// radiogroup) is a deliberate "land somewhere plain" over swallowing the key.
			const first =
				view.panelEl?.querySelector<HTMLElement>('button.pbl-est-point[tabindex="0"]') ??
				view.panelEl?.querySelector<HTMLElement>('button');
			if (first) {
				evt.preventDefault();
				first.focus();
			}
			return;
		}
		if (evt.key === 'Enter') {
			const item = view.selectedPath ? model.byPath.get(view.selectedPath) : undefined;
			if (item) void view.app.workspace.getLeaf(false).openFile(item.file);
		}
	});
}

/** One row over, holding at either edge rather than wrapping — the roadmap's own rule for this shape of walk. */
function step(items: EstimationItem[], selectedPath: string | null, delta: 1 | -1): string | null {
	if (items.length === 0) return null;
	const at = items.findIndex((item) => item.file.path === selectedPath);
	const next = at === -1 ? 0 : Math.min(Math.max(at + delta, 0), items.length - 1);
	return items[next].file.path;
}

/**
 * The one place a row's selected-ness is APPLIED: the class, the ARIA state, and — only
 * for the row becoming selected — the id `aria-activedescendant` points at. Both the
 * initial build (`renderRows`, every row, so an unselected one still states
 * `aria-selected="false"`) and a pick's fast path (`selectRow`, the old row and the new
 * one) call this, rather than one spelling it as a class string at creation and the other
 * as a DOM mutation at pick time — the double spelling this used to be.
 */
function applySelection(tableEl: HTMLElement, row: HTMLElement, selected: boolean): void {
	row.toggleClass('pbl-selected', selected);
	row.setAttribute('aria-selected', String(selected));
	if (!selected) return;
	if (!row.id) row.id = uniqueElementId('pbl-est-row');
	tableEl.setAttribute('aria-activedescendant', row.id);
}

/**
 * Move the selection off the old row and onto the new one, publish `view.selectedPath`,
 * and rebuild the panel beside it — the fast path a click or an arrow key takes, never a
 * full `view.render()`. Both callers already guarantee `path` is a key of `rows` — the
 * click handler checks `model.byPath.has(path)` first, and `step` only ever returns a
 * path drawn from this pass's `items` — and `rows` is built from that same (possibly
 * sorted) list, so there is no state in which the lookup below can miss.
 *
 * `scroll` is true only from the keyboard: a click already lands on a row the pointer
 * could reach, so nothing off screen needs to be brought into view for it.
 */
function selectRow(ctx: TableCtx, path: string, scroll: boolean): void {
	const { view, tableEl, model, rows } = ctx;
	const row = rows.get(path)!;
	const previous = view.selectedPath ? rows.get(view.selectedPath) : undefined;
	if (previous) applySelection(tableEl, previous, false);
	view.selectedPath = path;
	applySelection(tableEl, row, true);
	if (scroll) row.scrollIntoView({ block: 'nearest' });
	// Straight off the panel on screen: this path tears nothing down first, so the element
	// still has a layout box and its own `scrollTop` is the honest answer.
	renderPanel(view, model, view.panelEl?.scrollTop ?? 0);
}

/**
 * The sortable column vocabulary — the store's own twelve `estimationSort` values are
 * this set crossed with `SortDirection`, spelled independently there because stored
 * state is read defensively rather than trusted as a type (`storage/CLAUDE.md`).
 */
type SortColumn = 'title' | 'total' | 'coverage' | 'confidence' | 'effort' | 'currency';
type SortDirection = 'asc' | 'desc';
const SORT_COLUMNS: readonly SortColumn[] = ['title', 'total', 'coverage', 'confidence', 'effort', 'currency'];

interface SortPick {
	column: SortColumn;
	direction: SortDirection;
}

/** `view.sortPick` (or a stored value on its way in) narrowed to a real pick, or null for anything else — including no value at all. */
function parseSort(value: string | null): SortPick | null {
	if (!value) return null;
	const sep = value.indexOf(':');
	const column = value.slice(0, sep);
	const direction = value.slice(sep + 1);
	if (!SORT_COLUMNS.includes(column as SortColumn)) return null;
	if (direction !== 'asc' && direction !== 'desc') return null;
	return { column: column as SortColumn, direction };
}

function sortValue(pick: SortPick): string {
	return `${pick.column}:${pick.direction}`;
}

function flip(direction: SortDirection): SortDirection {
	return direction === 'asc' ? 'desc' : 'asc';
}

/**
 * Every column but the title is a value the reader is scanning for extremes, so
 * descending — biggest, or (for currency) least trustworthy, first — is the useful
 * first look; title is words, and reading starts at A.
 */
function firstDirection(column: SortColumn): SortDirection {
	return column === 'title' ? 'asc' : 'desc';
}

/**
 * Stable rank for the currency word, current < stale < foreign < handwritten < orphan
 * < none — the reading order for a reader hunting for rows that need attention, chosen
 * over alphabetical because the words themselves carry no such order ("Another model"
 * sorts before "Current" alphabetically, which says nothing about trust). One of the
 * two orders the task brief allowed; this is the one committed to, and
 * `test/view/estimation/sort.test.ts` pins the exact sequence it produces.
 */
const CURRENCY_ORDER: Record<Currency, number> = {
	current: 0,
	stale: 1,
	foreign: 2,
	handwritten: 3,
	orphan: 4,
	none: 5,
};

/**
 * What a column sorts BY. Null means unanswered — never a low value, so the comparator
 * below always sends it to the end regardless of direction, exactly as
 * `src/storage/CLAUDE.md`'s absence rule reads for a stored pick. `coverage` sorts by
 * the answered count alone rather than the answered/enabled ratio the cell displays:
 * `enabled` is `model.dimensions.length`, the same for every item in one model, so the
 * two orders coincide.
 */
function columnValue(item: EstimationItem, column: SortColumn): number | string | null {
	switch (column) {
		case 'title':
			return item.title;
		case 'total':
			return item.result?.total ?? null;
		case 'coverage':
			return item.result?.coverage.answered ?? null;
		case 'confidence':
			return item.confidence;
		case 'effort':
			return item.effort;
		case 'currency':
			return CURRENCY_ORDER[item.currency];
	}
}

function compareItems(a: EstimationItem, b: EstimationItem, pick: SortPick): number {
	const av = columnValue(a, pick.column);
	const bv = columnValue(b, pick.column);
	// Absence partitions AFTER the sorted block in both directions — never negated by
	// `pick.direction`, which is what keeps it out of the ascending/descending swap below.
	if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
	const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : av - (bv as number);
	return pick.direction === 'asc' ? cmp : -cmp;
}

/** A COPY in sorted order, or `items` itself, untouched, when nothing is sorted — `model.items` and its Base order are never mutated. */
function sortedItems(items: EstimationItem[], pick: SortPick | null): EstimationItem[] {
	return pick ? [...items].sort((a, b) => compareItems(a, b, pick)) : items;
}

/**
 * Read this view's saved pick fresh, every render — there is no restore-once controller
 * here the way `view/viewState.ts` has for the backlog, and a single string is cheap
 * enough not to need one. Identity null means session-only (`resolveViewIdentity`'s own
 * rule): `view.sortPick` is simply left as whatever a click already put there, and the
 * store is never touched.
 */
function restoreSort(view: EstimationView): void {
	const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	if (id === null) return;
	view.sortPick = loadViewState(view.app, id).prefs.estimationSort ?? null;
}

/**
 * Reflect a pick on the view immediately and persist it where this view can be
 * identified. `pick` is always a real value from a header click today — the store
 * already turns `undefined` into no entry at all (`saveViewState`'s absence rule), so a
 * future "clear sort" control needs no new plumbing here, only a caller.
 */
function setSort(view: EstimationView, pick: string): void {
	view.sortPick = pick;
	const id = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	if (id === null) return;
	const snapshot = loadViewState(view.app, id);
	saveViewState(view.app, id, { ...snapshot, prefs: { ...snapshot.prefs, estimationSort: pick } });
}

/** One header button's fixed shape — bundled into one param so `sortHeader` stays under the parameter-count budget. */
interface HeaderSpec {
	column: SortColumn;
	/** Keeps the column's own width/alignment rule (`styles/estimation.css`). */
	cls: string;
	label: string;
}

/**
 * One header cell — a real button now, not a label: `data-col` gives the row cells'
 * existing disambiguation (confidence and effort share `.pbl-est-cell`) a header
 * counterpart, and `aria-sort` is set only on the active column. A click computes the
 * NEXT pick from the CURRENT one — flip if this is already the active column, else that
 * column's own first direction — and hands it to `setSort`, then asks for a redraw the
 * same way every other pick in this view does (`view.refresh()`).
 */
function sortHeader(view: EstimationView, head: HTMLElement, spec: HeaderSpec, pick: SortPick | null): void {
	const { column, cls, label } = spec;
	const active = pick && pick.column === column ? pick : null;
	const btn = head.createEl('button', { cls: `${cls} pbl-est-sort`, text: label, attr: { 'data-col': column } });
	if (active) btn.setAttribute('aria-sort', active.direction === 'asc' ? 'ascending' : 'descending');
	btn.addEventListener('click', () => {
		setSort(view, sortValue({ column, direction: active ? flip(active.direction) : firstDirection(column) }));
		view.refresh();
	});
}

function renderHead(view: EstimationView, tableEl: HTMLElement, pick: SortPick | null): void {
	const head = tableEl.createDiv({ cls: 'pbl-est-head' });
	sortHeader(view, head, { column: 'title', cls: 'pbl-est-title', label: t('estimation.column.item') }, pick);
	sortHeader(view, head, { column: 'total', cls: 'pbl-est-total', label: t('estimation.column.value') }, pick);
	sortHeader(view, head, { column: 'coverage', cls: 'pbl-est-coverage', label: t('estimation.column.coverage') }, pick);
	sortHeader(view, head, { column: 'confidence', cls: 'pbl-est-cell', label: t('estimation.column.confidence') }, pick);
	sortHeader(view, head, { column: 'effort', cls: 'pbl-est-cell', label: t('estimation.column.effort') }, pick);
	sortHeader(view, head, { column: 'currency', cls: 'pbl-est-currency', label: t('estimation.column.currency') }, pick);
}

/**
 * A row's numeric cell: the exact number, and — where the cell is one of the two the reader
 * scans for extremes — a strip under it saying how much of a DECLARED range it reached.
 *
 * Left EMPTY rather than a literal dash when there is no value: `styles/estimation.css`'s
 * `:empty::before` rule supplies the dash, so a computed absence and a row still mid-render
 * are never spelled the same way one keystroke apart from a real value (Task 2's deferred
 * `:empty` case, closed by `test/view/estimation/table.test.ts`). A cell with no value gets
 * no strip either — an empty track would read as "low" rather than as "not answered".
 *
 * `range` null means no strip at all, which is confidence and effort. Both had one and it
 * was cut: at 3px under a right-aligned digit it reads as a stray underline, and a stored
 * `-2` effort clamps to an empty strip, saying *low* where the truth is *invalid* directly
 * beside the cell showing the number the user typed.
 */
function numberCell(el: HTMLElement, value: number | null, range: [number, number] | null): void {
	if (value === null) return;
	el.createSpan({ cls: 'pbl-est-num', text: String(value) });
	if (!range) return;
	const [min, max] = range;
	if (max <= min) return;
	const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
	el.createDiv({ cls: 'pbl-est-strip' }).style.setProperty('--pbl-progress', `${Math.round(ratio * 100)}%`);
}

function renderRow(tableEl: HTMLElement, item: EstimationItem, output: [number, number]): HTMLElement {
	const row = tableEl.createDiv({ cls: 'pbl-est-row', attr: { role: 'option' } });
	row.dataset.path = item.file.path;
	row.createDiv({ cls: 'pbl-est-title', text: item.title });
	// The model's own declared output range, never the spread of what the base returned.
	numberCell(row.createDiv({ cls: 'pbl-est-total' }), item.result?.total ?? null, output);
	const coverage = row.createDiv({ cls: 'pbl-est-coverage' });
	if (item.result) {
		coverage.createSpan({ cls: 'pbl-est-num', text: `${item.result.coverage.answered}/${item.result.coverage.enabled}` });
		const ratio = item.result.coverage.enabled === 0 ? 0 : item.result.coverage.answered / item.result.coverage.enabled;
		coverage.createDiv({ cls: 'pbl-est-strip' }).style.setProperty('--pbl-progress', `${Math.round(ratio * 100)}%`);
	}
	numberCell(row.createDiv({ cls: 'pbl-est-cell', attr: { 'data-col': 'confidence' } }), item.confidence, null);
	numberCell(row.createDiv({ cls: 'pbl-est-cell', attr: { 'data-col': 'effort' } }), item.effort, null);
	// The cell is the COLUMN and keeps a fixed width; the chip inside it hugs its own words.
	// `.pbl-est-stale` is gone with them: the state is now one class per currency on the
	// chip, so five treatments are declared in one place instead of one being special-cased
	// in the markup.
	renderCurrencyChip(row.createDiv({ cls: 'pbl-est-currency' }), item.currency);
	return row;
}

/**
 * The rows, or the ordinary results empty state in their place — `estimation.empty.noResults`,
 * the same key a zero-result base already answers with elsewhere in this view. `items`
 * is this pass's sorted order (see {@link sortedItems}).
 */
function renderRows(
	tableEl: HTMLElement,
	items: EstimationItem[],
	selectedPath: string | null,
	output: [number, number],
): Map<string, HTMLElement> {
	if (items.length === 0) {
		tableEl.createDiv({ text: t('estimation.empty.noResults') });
		return new Map();
	}
	const rows = new Map<string, HTMLElement>();
	for (const item of items) {
		const row = renderRow(tableEl, item, output);
		rows.set(item.file.path, row);
		applySelection(tableEl, row, item.file.path === selectedPath);
	}
	return rows;
}

/**
 * The table frame: header, one row per result (or the empty state), selection and keyboard.
 *
 * `previousScrollTop` is the OLD table's position and is the CALLER's to read, for the
 * reason `panel.ts` states at length: `EstimationView.render()` empties `viewEl` before
 * this runs, and a detached element has no layout box — so a browser answers 0 to
 * `scrollTop` there however far the reader had scrolled, and this restored nothing while
 * jsdom (which answers with whatever was assigned) reported it working. Every rebuild
 * here redraws the same list rather than a different note's own content, so — unlike the
 * panel — there is no "different item" case that should start it back at row one.
 */
export function renderTable(view: EstimationView, model: EstimationModel, previousScrollTop: number): void {
	restoreSort(view);
	// Validated once, here, rather than left for `step`'s own `-1` fallback to paper
	// over: a path from a previous pass that this one's model no longer has (the note
	// left the base's results) used to reach `step` unresolved and teleport an arrow
	// press to row 0 regardless of direction — a stale selection silently discarded
	// rather than an honest "nothing is selected". Cleared here, the same key press
	// means what it already means for that honest case: select the first row.
	if (view.selectedPath !== null && !model.byPath.has(view.selectedPath)) view.selectedPath = null;
	const pick = parseSort(view.sortPick);
	// Nothing here reads `view.tableEl` for its position: see the note above. Into
	// `contentEl` (the grid), never `viewEl` (the shell) directly — the toolbar sits
	// beside `viewEl`'s other child, not inside the grid whose tracks this table shares
	// with the panel.
	const tableEl = view.contentEl.createDiv({ cls: 'pbl-est-table', attr: { role: 'listbox', tabindex: '0' } });
	view.tableEl = tableEl;
	renderHead(view, tableEl, pick);
	const items = sortedItems(model.items, pick);
	// The model's own declared output range, never the spread of what this base returned —
	// `EstimationModel` carries no `ScoringModel`, so the range comes off the view.
	const output: [number, number] = [view.settings.model.outputMin, view.settings.model.outputMax];
	const rows = renderRows(tableEl, items, view.selectedPath, output);
	wireEvents(view, tableEl, model, items, rows);
	// Clamped to the fresh `scrollHeight` so a rebuild with fewer rows (a note leaving the
	// base's results) cannot park the pane below its own last row.
	tableEl.scrollTop = Math.min(previousScrollTop, tableEl.scrollHeight);
}
