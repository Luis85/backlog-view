import { setIcon } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseFigure, ReleaseIndex, ReleaseRow } from '../../domain/releases';
import { formatCivil } from '../../domain/timeline';
import { drawIcon } from '../render/icons';

/**
 * The index screen (`docs/requirements/Every release in one list.md`): one row per release
 * over the five-column grid `styles/release.css` draws, and the two notes beneath it.
 *
 * A free function over the view, `estimation/renderTable.ts`'s own shape, importing the
 * view for its TYPE alone so the pair stays acyclic at runtime.
 *
 * **Nothing here re-sorts.** `releaseIndex` decided the order, the figures and the member
 * count, and this module draws what it was handed — the design's "one denominator, one
 * predicate, one answer", which is what stops an index row and a release header
 * disagreeing about the same release.
 *
 * **Nothing here writes**, and there is nothing to withhold to keep it that way: the only
 * gesture on this screen is picking a release, which is view state.
 */
export function renderIndex(view: ReleaseView, index: ReleaseIndex): void {
	const listEl = view.viewEl.createDiv({ cls: 'pbl-rel-list' });
	const gridEl = listEl.createDiv({ cls: 'pbl-rel-grid' });
	const columns = drawableColumns(index.rows);

	// The track list follows the columns actually drawn, so a dropped column takes its
	// track with it. The partial's own default covers all five; a shorter grid says so
	// here rather than leaving four cells to spread over five tracks.
	gridEl.setCssProps({ '--pbl-rel-columns': ['1fr', ...columns.map(() => 'auto')].join(' ') });

	const headEl = gridEl.createDiv({ cls: 'pbl-rel-head' });
	headEl.createDiv({ text: t('release.index.column.name') });
	for (const column of columns) headEl.createDiv({ cls: column.cls, text: column.label });

	for (const row of index.rows) drawRow(view, gridEl, row, columns);

	drawAbsences(listEl, index.rows);
	drawUnresolved(listEl, index);
}

/**
 * One figure column: its heading, how to reach its figure, and how to draw a value it
 * could read. The heading and the cells come off ONE list for the reason the tree's own
 * columns do — two lists in the same order is an order to keep in step, and the first
 * dropped column is where they would stop agreeing.
 *
 * A function rather than a constant because the headings are RESOLVED text: `t()` answers
 * against the locale `initLocale` installs at load, so a module-level array would spell
 * every heading before that ran. Resolved once here rather than carried as a key, so the
 * heading in the grid and the name in the absent-column note are literally one string.
 *
 * **A bound key the note does not carry draws an empty cell — except the target date, which
 * says so.** That is a THIRD answer beside the two [[Releases as their own type]] rules on:
 * 3a is a key nobody bound and 3b is a key holding something no reader will guess at, and
 * neither is a note that simply does not state its version. The register does not rule on
 * this one, so the rule applied is stated here and held by a test.
 *
 * The asymmetry is the point rather than an oversight. An absent target date is the only one
 * of the four that MOVED THE ROW: [[Every release in one list]] 3a puts an undated release
 * after every dated one, so a blank cell in the column the list is sorted by would leave the
 * reader no way to explain why the row is at the bottom. A missing version or status changes
 * nothing about where the row sits, so labelling those would be three italic placeholders on
 * one row saying nothing the empty cell does not. An unset member count is not this case at
 * all — it is a counted zero, and it is drawn.
 */
interface ColumnSpec {
	label: string;
	cls?: string;
	figure: (row: ReleaseRow) => ReleaseFigure<unknown>;
	draw: (cell: HTMLElement, row: ReleaseRow) => void;
}

function columnSpecs(): ColumnSpec[] {
	return [
		{
			label: t('release.index.column.version'),
			cls: 'pbl-rel-version',
			figure: (row) => row.version,
			draw: (cell, row) => cell.createSpan({ text: row.version.value ?? '' }),
		},
		{
			label: t('release.index.column.target'),
			figure: (row) => row.target,
			// An unset target date is a legitimate answer and says so, where an unreadable one
			// is somebody's mistake — the two are drawn differently on purpose, and
			// `releaseIndex` is what tells them apart.
			draw: (cell, row) =>
				row.target.value === null
					? cell.createSpan({ cls: 'pbl-rel-undated', text: t('release.index.noTarget') })
					: cell.createSpan({ text: formatCivil(row.target.value) }),
		},
		{
			label: t('release.index.column.status'),
			figure: (row) => row.status,
			draw: (cell, row) => {
				if (row.status.value === null) return;
				// The tree's read-only chip. This whole view is read-only, so every chip on it
				// is the static one — and it draws grey: `--pbl-state-color` belongs to the
				// legend and the card projections, not to a row chip.
				const chip = cell.createDiv({ cls: 'pbl-state-chip pbl-state-static' });
				chip.createSpan({ cls: 'pbl-state-text', text: row.status.value });
			},
		},
		{
			label: t('release.index.column.members'),
			cls: 'pbl-rel-num',
			figure: (row) => row.members,
			// A bare count in its own column is data, not a sentence — `estimation/renderTable`
			// draws its numeric cells the same way.
			draw: (cell, row) => cell.createSpan({ text: String(row.members.value ?? 0) }),
		},
	];
}

/**
 * The columns this base can draw at all, read from the FIRST row: `releaseIndex` sets
 * `unconfigured` from the settings rather than from a note, so every row agrees and asking
 * one of them is asking the configuration.
 */
function drawableColumns(rows: ReleaseRow[]): ColumnSpec[] {
	const first = rows[0];
	if (first === undefined) return [];
	return columnSpecs().filter((column) => !column.figure(first).unconfigured);
}

function drawRow(view: ReleaseView, gridEl: HTMLElement, row: ReleaseRow, columns: ColumnSpec[]): void {
	// `role="button"` and a real tab stop, with Enter and Space beside the click — the
	// spelling `ui/estimationPresetDialog.ts` already uses for a row-shaped control.
	//
	// Not a real `<button>`, which the register prefers wherever it fits: `.pbl-rel-row` is
	// `display: contents` so that one grid holds every row's cells and the figures line up
	// down the screen, and `display: contents` on a form control is exactly the case CSS
	// leaves to the browser. The div keeps the layout the design settled and states its
	// semantics itself; that trade is unverifiable here and is owed a live-vault look.
	const rowEl = gridEl.createDiv({
		cls: 'pbl-rel-row',
		attr: { role: 'button', tabindex: '0', 'data-path': row.path },
	});
	const nameEl = rowEl.createDiv({ cls: 'pbl-rel-name' });
	drawIcon(nameEl.createSpan(), 'package');
	nameEl.createSpan({ text: row.name });

	for (const column of columns) {
		const cell = rowEl.createDiv({ cls: column.cls });
		// One refusal for every column: a key that is bound and holds something no reader
		// will guess at says so, per row, rather than reading as an unset key.
		if (column.figure(row).invalid) cell.createSpan({ cls: 'pbl-rel-unreadable', text: t('release.index.unreadable') });
		else column.draw(cell, row);
	}

	const open = (): void => view.pick(row.path);
	rowEl.addEventListener('click', open);
	rowEl.addEventListener('keydown', (evt) => {
		if (evt.key !== 'Enter' && evt.key !== ' ') return;
		evt.preventDefault();
		open();
	});
}

/**
 * The unconfigured columns, named ONCE beneath the grid — the register's rule for any
 * unconfigured figure, and the reason those columns are absent from every row above
 * rather than blank in each.
 */
function drawAbsences(listEl: HTMLElement, rows: ReleaseRow[]): void {
	const first = rows[0];
	if (first === undefined) return;
	const absent = columnSpecs().filter((column) => column.figure(first).unconfigured);
	if (absent.length === 0) return;
	// The names are joined by the CATALOG's grammar — an array parameter, never a joiner
	// written here.
	note(listEl, 'settings-2', t('release.index.absentColumns', { columns: absent.map((c) => c.label) }));
}

/**
 * The items whose membership value named no release — reported here because the index is
 * the only screen that can see them: they belong to no release, so they appear on no
 * release's screen.
 *
 * Exported for the ONE screen that draws no index and still has these to report: a base
 * holding no release at all, where `releaseView.render` returns before this module is ever
 * reached. That is the maximum-information case rather than a corner — with no release for
 * any value to resolve to, EVERY membership value is unresolved — and it read as "no
 * releases" and nothing else. [[Setting an item's release]] 1f's ruling is that an
 * unresolvable membership is reported rather than dropped in silence, so the empty state
 * carries this line beneath it.
 */
export function drawUnresolved(listEl: HTMLElement, index: ReleaseIndex): void {
	const count = index.unresolved.length;
	if (count === 0) return;
	note(listEl, 'circle-alert', t('release.index.unresolved', { count })).addClass('pbl-rel-unresolved');
}

/** A line ABOUT the list rather than a row in it, so it sits outside the grid. */
function note(listEl: HTMLElement, icon: string, text: string): HTMLElement {
	const el = listEl.createDiv({ cls: 'pbl-rel-note' });
	setIcon(el.createSpan(), icon);
	el.createSpan({ text });
	return el;
}
