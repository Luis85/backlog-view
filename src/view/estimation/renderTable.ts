import type { EstimationView } from './estimationView';
import { renderPanel } from './panel';
import { t } from '../../i18n/t';
import { EstimationItem, EstimationModel } from '../../domain/estimationItems';
import { Currency } from '../../domain/weightedScore';
import { uniqueElementId } from '../selection';

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
 */

/** Delegated click and keydown, both wired once per render pass — the table's own root. */
function wireEvents(view: EstimationView, tableEl: HTMLElement, model: EstimationModel, rows: Map<string, HTMLElement>): void {
	// Resolved by `data-path` against THIS pass's model, never a per-row closure over an
	// item — the same rule `render/rows.ts` states for the tree, restated here because
	// this table wires no per-row listener at all to forget it.
	tableEl.addEventListener('click', (evt) => {
		const rowEl = evt.target instanceof Element ? evt.target.closest('.pbl-est-row') : null;
		const path = rowEl instanceof HTMLElement ? rowEl.dataset.path : undefined;
		if (path && model.byPath.has(path)) selectRow(view, tableEl, rows, model, path);
	});
	tableEl.addEventListener('keydown', (evt) => {
		if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
			const path = step(model, view.selectedPath, evt.key === 'ArrowDown' ? 1 : -1);
			if (path) {
				evt.preventDefault();
				selectRow(view, tableEl, rows, model, path);
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
function step(model: EstimationModel, selectedPath: string | null, delta: 1 | -1): string | null {
	if (model.items.length === 0) return null;
	const at = model.items.findIndex((item) => item.file.path === selectedPath);
	const next = at === -1 ? 0 : Math.min(Math.max(at + delta, 0), model.items.length - 1);
	return model.items[next].file.path;
}

/**
 * Move `pbl-selected`/`aria-selected` off the old row and onto the new one, publish
 * `view.selectedPath`, and rebuild the panel beside it — the fast path a click or an
 * arrow key takes, never a full `view.render()`. Both callers already guarantee `path`
 * is a key of `rows` — the click handler checks `model.byPath.has(path)` first, and
 * `step` only ever returns a path drawn from `model.items` — and `rows` is built from
 * that same item list, so there is no state in which the lookup below can miss.
 */
function selectRow(
	view: EstimationView,
	tableEl: HTMLElement,
	rows: Map<string, HTMLElement>,
	model: EstimationModel,
	path: string,
): void {
	const row = rows.get(path)!;
	const previous = view.selectedPath ? rows.get(view.selectedPath) : undefined;
	previous?.removeClass('pbl-selected');
	previous?.setAttribute('aria-selected', 'false');
	view.selectedPath = path;
	row.addClass('pbl-selected');
	row.setAttribute('aria-selected', 'true');
	if (!row.id) row.id = uniqueElementId('pbl-est-row');
	tableEl.setAttribute('aria-activedescendant', row.id);
	renderPanel(view, model);
}

function renderHead(tableEl: HTMLElement): void {
	const head = tableEl.createDiv({ cls: 'pbl-est-head' });
	head.createDiv({ cls: 'pbl-est-title', text: t('estimation.column.item') });
	head.createDiv({ cls: 'pbl-est-total', text: t('estimation.column.value') });
	head.createDiv({ cls: 'pbl-est-coverage', text: t('estimation.column.coverage') });
	head.createDiv({ cls: 'pbl-est-cell', text: t('estimation.column.confidence') });
	head.createDiv({ cls: 'pbl-est-cell', text: t('estimation.column.effort') });
	head.createDiv({ cls: 'pbl-est-currency', text: t('estimation.column.currency') });
}

function currencyWord(currency: Currency): string {
	switch (currency) {
		case 'current':
			return t('estimation.currency.current');
		case 'stale':
			return t('estimation.currency.stale');
		case 'foreign':
			return t('estimation.currency.foreign');
		case 'handwritten':
			return t('estimation.currency.handwritten');
		case 'orphan':
			return t('estimation.currency.orphan');
		case 'none':
			return t('estimation.currency.none');
	}
}

/**
 * Left EMPTY rather than a literal dash when there is no value: `styles/estimation.css`'s
 * `:empty::before` rule supplies the dash, so a computed absence and a row still mid-render
 * are never spelled the same way one keystroke apart from a real value (Task 2's deferred
 * `:empty` case, closed by `test/view/estimation/table.test.ts`).
 */
function numberCell(el: HTMLElement, value: number | null): void {
	if (value !== null) el.setText(String(value));
}

function renderRow(tableEl: HTMLElement, item: EstimationItem, selectedPath: string | null): HTMLElement {
	const selected = item.file.path === selectedPath;
	const row = tableEl.createDiv({
		cls: 'pbl-est-row' + (selected ? ' pbl-selected' : ''),
		attr: { role: 'option', 'aria-selected': String(selected) },
	});
	row.dataset.path = item.file.path;
	row.createDiv({ cls: 'pbl-est-title', text: item.title });
	numberCell(row.createDiv({ cls: 'pbl-est-total' }), item.result?.total ?? null);
	const coverage = row.createDiv({ cls: 'pbl-est-coverage' });
	if (item.result) coverage.setText(`${item.result.coverage.answered}/${item.result.coverage.enabled}`);
	numberCell(row.createDiv({ cls: 'pbl-est-cell', attr: { 'data-col': 'confidence' } }), item.confidence);
	numberCell(row.createDiv({ cls: 'pbl-est-cell', attr: { 'data-col': 'effort' } }), item.effort);
	row.createDiv({
		cls: 'pbl-est-currency' + (item.currency === 'stale' ? ' pbl-est-stale' : ''),
		text: currencyWord(item.currency),
	});
	return row;
}

/**
 * The rows, or the ordinary results empty state in their place — `estimation.empty.noResults`,
 * the same key a zero-result base already answers with elsewhere in this view.
 */
function renderRows(tableEl: HTMLElement, model: EstimationModel, selectedPath: string | null): Map<string, HTMLElement> {
	if (model.items.length === 0) {
		tableEl.createDiv({ text: t('estimation.empty.noResults') });
		return new Map();
	}
	const rows = new Map<string, HTMLElement>();
	for (const item of model.items) {
		const row = renderRow(tableEl, item, selectedPath);
		rows.set(item.file.path, row);
		if (item.file.path === selectedPath) {
			row.id = uniqueElementId('pbl-est-row');
			tableEl.setAttribute('aria-activedescendant', row.id);
		}
	}
	return rows;
}

/** The table frame: header, one row per result (or the empty state), selection and keyboard. */
export function renderTable(view: EstimationView, model: EstimationModel): void {
	const tableEl = view.viewEl.createDiv({ cls: 'pbl-est-table', attr: { role: 'listbox', tabindex: '0' } });
	renderHead(tableEl);
	const rows = renderRows(tableEl, model, view.selectedPath);
	wireEvents(view, tableEl, model, rows);
}
