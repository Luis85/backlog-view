import { setIcon } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseFigure, ReleaseIndex, ReleaseRow } from '../../domain/releases';
import { formatCivil } from '../../domain/timeline';
import { drawIcon } from '../render/icons';

/**
 * The index screen (`docs/requirements/Every release in one list.md`): one row per release
 * over the five columns `styles/release.css` draws, and the two notes beneath it.
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

	// One custom property per column actually drawn, so a dropped column takes its width
	// with it and the cells below read the columns this render has.
	const widths: Record<string, string> = {};
	for (const [i, column] of columns.entries()) widths[columnWidthVar(i)] = `${column.width}px`;
	gridEl.setCssProps(widths);

	const headEl = gridEl.createDiv({ cls: 'pbl-rel-head' });
	// The heading's own name cell carries no `.pbl-rel-name`: that class is how a row's name
	// is addressed, and the stylesheet gives the heading the same slack by position.
	headEl.createSpan({ text: t('release.index.column.name') });
	for (const [i, column] of columns.entries()) sizeCell(headEl.createSpan({ cls: column.cls, text: column.label }), i, column);

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
	/**
	 * How wide the column draws, in px. A number rather than a track that sizes itself,
	 * because the rows no longer share one grid — see {@link columnWidthVar}. Wide enough
	 * for the longest thing the column states about itself (`No target date`, `Unreadable`);
	 * anything longer is vault content and ellipsises, which the tree's own fixed property
	 * columns already do.
	 */
	width: number;
	figure: (row: ReleaseRow) => ReleaseFigure<unknown>;
	draw: (cell: HTMLElement, row: ReleaseRow) => void;
	/**
	 * What this column's figure SAYS, for the row's accessible name — or null to say
	 * nothing about it, which is how an empty cell is spoken.
	 *
	 * Beside `draw` rather than derived from it, because the two answer different
	 * questions and only one has a DOM to read: an empty version cell is silence, an
	 * unset target date is a sentence, and a status is a chip whose text is the whole of
	 * what it means. Each is one line here, and a column that grows a third rendition
	 * would be the point to stop and share one.
	 */
	speak: (row: ReleaseRow) => string | null;
}

/**
 * Where column `index`'s width is published: one custom property on the grid element,
 * inherited by the heading cell and by that column's cell on every row — `render/columns.ts`
 * and `interactions/columnResize.ts`'s shape, for the same reason read the other way round.
 * There the indirection lets a drag move every row without a re-render; here it is what lets
 * a row lay out its OWN cells and still line its figures up with the row above, now that
 * `display: contents` and the one shared grid are gone.
 */
function columnWidthVar(index: number): string {
	return `--pbl-rel-w-${index}`;
}

/** Point one cell at its column's published width — the reference, never the number. */
function sizeCell(cell: HTMLElement, index: number, column: ColumnSpec): HTMLElement {
	cell.setCssProps({ '--pbl-rel-w': `var(${columnWidthVar(index)}, ${column.width}px)` });
	return cell;
}

function columnSpecs(): ColumnSpec[] {
	return [
		{
			label: t('release.index.column.version'),
			cls: 'pbl-rel-version',
			width: 104,
			figure: (row) => row.version,
			draw: (cell, row) => cell.createSpan({ text: row.version.value ?? '' }),
			speak: (row) => row.version.value,
		},
		{
			label: t('release.index.column.target'),
			width: 132,
			figure: (row) => row.target,
			// An unset target date is a legitimate answer and says so, where an unreadable one
			// is somebody's mistake — the two are drawn differently on purpose, and
			// `releaseIndex` is what tells them apart.
			draw: (cell, row) =>
				row.target.value === null
					? cell.createSpan({ cls: 'pbl-rel-undated', text: t('release.index.noTarget') })
					: cell.createSpan({ text: formatCivil(row.target.value) }),
			// The one column whose ABSENCE is spoken, for the reason it is the one whose
			// absence is drawn: it moved the row to the bottom of the list.
			speak: (row) => (row.target.value === null ? t('release.index.noTarget') : formatCivil(row.target.value)),
		},
		{
			label: t('release.index.column.status'),
			width: 128,
			figure: (row) => row.status,
			draw: (cell, row) => {
				if (row.status.value === null) return;
				// The tree's read-only chip. This whole view is read-only, so every chip on it
				// is the static one — and it draws grey: `--pbl-state-color` belongs to the
				// legend and the card projections, not to a row chip.
				const chip = cell.createSpan({ cls: 'pbl-state-chip pbl-state-static' });
				chip.createSpan({ cls: 'pbl-state-text', text: row.status.value });
			},
			speak: (row) => row.status.value,
		},
		{
			label: t('release.index.column.members'),
			cls: 'pbl-rel-num',
			width: 64,
			figure: (row) => row.members,
			// A bare count in its own column is data, not a sentence — `estimation/renderTable`
			// draws its numeric cells the same way.
			draw: (cell, row) => cell.createSpan({ text: String(row.members.value ?? 0) }),
			// A bare number is data in a column and ambiguous in a sentence, so the spoken
			// form is the counted phrase the catalog already owns — with its plural rule.
			speak: (row) => t('count.releaseMembers', { count: row.members.value ?? 0 }),
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

/**
 * What one row SAYS, as opposed to what it shows.
 *
 * A `<button>`'s accessible name is its own contents run together, and the headings are a
 * separate element it does not reference — so the row announced as
 * "0.8 0.8.0 2026-09-12 In progress 0": five values with nothing saying which is which,
 * on a screen whose columns are the entire point. The grid gives the eye those pairs
 * through position, which is exactly the channel a screen reader does not have.
 *
 * Composed from the SAME `columns` the row drew, so a column dropped for an unbound key
 * leaves the spoken name with it and the two cannot come to disagree — the rule the
 * heading row and the cells already keep by sharing one list.
 *
 * Every piece goes through the catalog and the list is joined by `Intl.ListFormat` inside
 * it: a joiner written here would be grammar decided by whoever typed it, and it reads
 * wrong at two items in half the locales this plugin ships to.
 */
function rowLabel(row: ReleaseRow, columns: ColumnSpec[]): string {
	const figures: string[] = [];
	for (const column of columns) {
		// A column that says nothing about this row is silent here too, exactly as its cell
		// is empty — an announced "Version" with no version is worse than no mention.
		const value = column.figure(row).invalid ? t('release.index.unreadable') : column.speak(row);
		if (value === null) continue;
		figures.push(t('release.index.rowFigure', { label: column.label, value }));
	}
	return t('release.index.rowLabel', { name: row.name, figures });
}

function drawRow(view: ReleaseView, gridEl: HTMLElement, row: ReleaseRow, columns: ColumnSpec[]): void {
	// A real `<button>`, which is what makes the tab stop, Enter, Space and Space NOT
	// scrolling the list the browser's job rather than a handler somebody has to remember —
	// `renderScope.ts`'s back control, one screen over, for the same reason.
	//
	// It was a `role="button"` div until 2026-08-23, because `.pbl-rel-row` was
	// `display: contents` and a form control was thought not to survive that. Measured in
	// headless Chromium, NOTHING survives it: a `display: contents` element has no box, so
	// Tab skips it, `.focus()` on it does nothing, and `:focus-visible` can never match — a
	// real `<button style="display: contents">` measured exactly the same. The element was
	// never what decided it, and the whole index was closed to the keyboard. See
	// `.superpowers/sdd/…/display-contents-focus-measurement.md`.
	//
	// The cells are spans rather than divs so the row is legal button content.
	const rowEl = gridEl.createEl('button', {
		cls: 'pbl-rel-row',
		// `aria-label` REPLACES the contents as the accessible name, which is the point:
		// what the cells run together say is the defect (see `rowLabel`). The visible text
		// is unchanged, so the two never differ in content — only in whether the headings
		// come with it.
		attr: { type: 'button', 'data-path': row.path, 'aria-label': rowLabel(row, columns) },
	});
	const nameEl = rowEl.createSpan({ cls: 'pbl-rel-name' });
	drawIcon(nameEl.createSpan({ cls: 'pbl-rel-icon' }), 'package');
	nameEl.createSpan({ text: row.name });

	for (const [index, column] of columns.entries()) {
		const cell = sizeCell(rowEl.createSpan({ cls: column.cls }), index, column);
		// One refusal for every column: a key that is bound and holds something no reader
		// will guess at says so, per row, rather than reading as an unset key.
		if (column.figure(row).invalid) cell.createSpan({ cls: 'pbl-rel-unreadable', text: t('release.index.unreadable') });
		else column.draw(cell, row);
	}

	rowEl.addEventListener('click', () => view.pick(row.path));
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
 * releases" and nothing else. [[The scope of a release as a tree]] 1b's ruling is that such
 * an item is reported among the unresolved "rather than silently dropped", so the empty state
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
