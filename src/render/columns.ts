import { BasesPropertyId, NullValue, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { DragDropController } from '../interactions/dragDrop';
import { showStateMenu, showTagMenu } from '../interactions/menu';
import { removeTag } from '../interactions/tags';
import { BacklogItem } from '../model';
import { BacklogSettings } from '../settings';

/** A visible property and its display name, resolved once instead of per row. */
export interface ChipProp {
	prop: BasesPropertyId;
	label: string;
	/** Render as editable tag pills instead of a plain value. */
	tags: boolean;
}

/**
 * State shared by one render pass. Config lookups live here so per-row work stays
 * proportional to the rows themselves — repeating a handful of Bases config calls
 * on every row is what makes a few hundred items feel slow.
 */
export interface RowContext {
	host: BacklogViewHost;
	dnd: DragDropController;
	/** Rendered rows by path — the view's O(1) lookup for selection and subtree updates. */
	rows: Map<string, HTMLElement>;
	chips: ChipProp[];
}

export function rowContext(
	host: BacklogViewHost,
	dnd: DragDropController,
	rows: Map<string, HTMLElement>,
): RowContext {
	return { host, dnd, rows, chips: host.settings.showChips ? chipProps(host) : [] };
}

/** Widths of the fixed columns, mirroring the defaults of their CSS custom properties. */
const STATE_COL_WIDTH = 116;
const META_COL_WIDTH = 84;
/** What a row at the top level keeps for itself: grip, chevron, badge, a usable title. */
const ROW_LEAD_WIDTH = 260;
/** Indent one depth level adds, mirroring the row padding in styles.css. */
const INDENT_PER_DEPTH = 24;

/**
 * Which columns still fit in a pane this wide. Columns never shrink — that is what
 * keeps them aligned — so a pane too narrow for them has to drop them instead, and
 * the threshold has to come from what the rows actually need rather than a fixed
 * breakpoint: two 280px columns need more than twice the room of two 100px ones,
 * and every level of indent takes another 24px away from the deepest row's title.
 * Columns go in reverse order of usefulness, the state chip being the last to survive.
 */
export function columnFit(
	settings: BacklogSettings,
	chipCount: number,
	depth: number,
	width: number,
): { hideProps: boolean; hideMeta: boolean } {
	const state = settings.stateKey ? STATE_COL_WIDTH : 0;
	const meta = settings.stateKey || settings.showCounts ? META_COL_WIDTH : 0;
	const props = settings.showChips ? settings.propColumnWidth * chipCount : 0;
	const base = ROW_LEAD_WIDTH + depth * INDENT_PER_DEPTH + state;
	return { hideProps: width < base + meta + props, hideMeta: width < base + meta };
}

/**
 * The deepest row currently on screen. Depth is what the fit has to answer for: a
 * collapsed or hidden branch costs nothing, and an expanded one narrows every row's
 * usable width by its indent. Walks the rendered forest, not the model, for exactly
 * that reason — expanding a deep branch is what makes the columns stop fitting.
 */
export function renderedDepth(host: BacklogViewHost): number {
	let max = 0;
	const walk = (items: BacklogItem[]) => {
		for (const item of items) {
			if (host.isRowHidden(item)) continue;
			if (item.depth > max) max = item.depth;
			if (!host.isCollapsed(item.file.path)) walk(item.children);
		}
	};
	walk(host.model?.roots ?? []);
	return max;
}

/** The visible properties to render as columns, with their labels — one lookup per render. */
function chipProps(host: BacklogViewHost): ChipProp[] {
	let props: BasesPropertyId[] = [];
	try {
		props = host.config.getOrder();
	} catch {
		return [];
	}
	const skip = new Set<string>([
		'file.name',
		`note.${host.settings.parentKey}`,
		`note.${host.settings.orderKey}`,
		`note.${host.settings.typeKey}`,
	]);
	// The interactive state chip already shows this property.
	if (host.settings.stateKey) skip.add(`note.${host.settings.stateKey}`);
	const tagsId = host.settings.tagsKey ? `note.${host.settings.tagsKey}` : '';
	return props
		.filter((prop) => !skip.has(prop))
		.map((prop) => ({ prop, label: chipLabel(host, prop), tags: prop === tagsId }));
}

function chipLabel(host: BacklogViewHost, prop: BasesPropertyId): string {
	try {
		return host.config.getDisplayName(prop);
	} catch {
		return prop.substring(prop.indexOf('.') + 1);
	}
}

/**
 * The header naming the property columns. Rows carry no labels of their own —
 * repeating "Assignee:" on every row is the clutter columns exist to remove — so
 * the names live here once, pinned to the top of the scroller.
 */
export function renderColumnHeader(ctx: RowContext, containerEl: HTMLElement): void {
	if (ctx.chips.length === 0) return;
	const settings = ctx.host.settings;
	// Presentational: every value below carries its own accessible label.
	const header = containerEl.createDiv({ cls: 'pbl-cols', attr: { 'aria-hidden': 'true' } });
	header.createDiv({ cls: 'pbl-row-spacer' });

	const props = header.createDiv({ cls: 'pbl-props' });
	for (const chip of ctx.chips) {
		const cell = props.createDiv({ cls: 'pbl-prop pbl-col-label', text: chip.label });
		setTooltip(cell, chip.label);
	}
	if (settings.stateKey) {
		header.createDiv({ cls: 'pbl-state-col pbl-col-label', text: chipLabel(ctx.host, `note.${settings.stateKey}`) });
	}
	if (settings.stateKey || settings.showCounts) {
		header.createDiv({
			cls: 'pbl-meta-col pbl-col-label',
			text: settings.stateKey ? 'Progress' : 'Items',
		});
	}
	// Reserves exactly the width of a row's add button, so the last column lines up.
	setIcon(header.createDiv({ cls: 'pbl-add clickable-icon' }), 'plus');
}

/**
 * The trailing columns of one row. Every column is fixed-width and anchored to the
 * row's end, so values line up across rows regardless of title length or indent —
 * the property values, the state chip and the rollup all read as columns.
 */
export function renderRowColumns(ctx: RowContext, row: HTMLElement, item: BacklogItem): void {
	// Pushes the columns to the row's end; also the click target between them.
	row.createDiv({ cls: 'pbl-row-spacer' });
	if (ctx.chips.length > 0) renderPropCells(ctx, row, item);
	if (ctx.host.settings.stateKey) renderStateChip(ctx.host, row.createDiv({ cls: 'pbl-state-col' }), item);
	renderRollup(ctx.host, row, item);
}

function renderPropCells(ctx: RowContext, row: HTMLElement, item: BacklogItem): void {
	const props = row.createDiv({ cls: 'pbl-props' });
	for (const chip of ctx.chips) {
		const cell = props.createDiv({ cls: 'pbl-prop' });
		if (chip.tags) renderTagCell(ctx.host, cell, item, chip);
		else renderValue(ctx.host, cell, item, chip);
	}
	// Cells may render note links or tag buttons that must not also open the row's
	// own note; the empty space around them stays part of the row's click target.
	props.addEventListener('click', (evt) => {
		if (evt.target instanceof Element && evt.target.closest('.pbl-prop-value, .pbl-tag, .pbl-tag-add')) {
			evt.stopPropagation();
		}
	});
}

function renderValue(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, chip: ChipProp): void {
	// An ancestor from outside the filter has no Bases row, so no property values.
	let value = null;
	try {
		value = item.entry?.getValue(chip.prop) ?? null;
	} catch {
		return;
	}
	if (value === null || value instanceof NullValue) return;
	// isEmpty() is not yet part of the published typings; prefer it when present.
	const maybeEmpty = value as { isEmpty?: () => boolean };
	if (typeof maybeEmpty.isEmpty === 'function' && maybeEmpty.isEmpty()) return;

	const text = value.toString();
	const valueEl = cell.createSpan({ cls: 'pbl-prop-value' });
	try {
		value.renderTo(valueEl, host.app.renderContext);
	} catch {
		valueEl.setText(text);
	}
	if (valueEl.textContent?.trim() === '' && text.trim() === '') {
		valueEl.detach();
		return;
	}
	// The column is narrow and the header names it only once — say both here, and
	// in the accessible name too, since the header itself is presentational.
	const described = `${chip.label}: ${valueEl.textContent?.trim() || text}`;
	setTooltip(valueEl, described);
	valueEl.setAttribute('aria-label', described);
}

/**
 * Tags as pills, each removable, with a button to add one. A note the Base excluded
 * is context: its tags render, but nothing on the row offers to write them.
 */
function renderTagCell(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, chip: ChipProp): void {
	cell.addClass('pbl-prop-tags');
	const editable = !item.outsideFilter;
	// The pills live in their own box so that *they* clip when there are more than
	// the column can show. The add button is a sibling of that box, not the last
	// thing in the row of pills, or enough tags would push it out of the cell.
	const list = cell.createDiv({ cls: 'pbl-tag-list' });
	for (const tag of item.tags) {
		const pill = list.createSpan({ cls: 'pbl-tag' });
		pill.createSpan({ cls: 'pbl-tag-text', text: `#${tag}` });
		if (!editable) continue;
		// No Tab stop: the tree keeps its single-tab-stop model and the context
		// menu ("Edit tags") carries the documented keyboard path.
		const remove = pill.createEl('button', {
			cls: 'pbl-tag-remove',
			attr: { type: 'button', tabindex: '-1', 'aria-label': `Remove tag ${tag}` },
		});
		setIcon(remove, 'x');
		setTooltip(remove, `Remove #${tag}`);
		remove.addEventListener('click', (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			removeTag(host, item, tag);
		});
	}
	if (item.tags.length > 0) setTooltip(cell, `${chip.label}: ${item.tags.map((t) => `#${t}`).join(', ')}`);
	if (!editable) return;

	const add = cell.createEl('button', {
		cls: 'pbl-tag-add',
		attr: { type: 'button', tabindex: '-1', 'aria-label': 'Add tag' },
	});
	setIcon(add, 'plus');
	setTooltip(add, 'Add tag');
	add.addEventListener('click', (evt) => showTagMenu(host, evt, item));
}

/** Progress rollup or descendant count, in a column of its own so both align. */
function renderRollup(host: BacklogViewHost, row: HTMLElement, item: BacklogItem): void {
	const settings = host.settings;
	if (!settings.stateKey && !settings.showCounts) return;
	const col = row.createDiv({ cls: 'pbl-meta-col' });
	if (item.descendantCount === 0) return;

	if (settings.stateKey) {
		const ratio = item.doneDescendants / item.descendantCount;
		const progress = col.createDiv({ cls: 'pbl-progress' + (ratio === 1 ? ' pbl-complete' : '') });
		const bar = progress.createDiv({ cls: 'pbl-progress-bar' });
		bar.createDiv({ cls: 'pbl-progress-fill' }).setCssProps({
			'--pbl-progress': `${Math.round(ratio * 100)}%`,
		});
		progress.createSpan({
			cls: 'pbl-progress-label',
			text: `${item.doneDescendants}/${item.descendantCount}`,
		});
		setTooltip(progress, `${item.doneDescendants} of ${item.descendantCount} items done`);
	} else if (settings.showCounts) {
		col.createSpan({ cls: 'pbl-count', text: String(item.descendantCount) });
	}
}

/** Clickable state chip — the inline write surface for the workflow state. */
function renderStateChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem): void {
	const value = item.stateValue;
	const cls = 'pbl-state-chip' + (item.done ? ' pbl-state-done' : '') + (value === null ? ' pbl-state-unset' : '');

	// A note the Base excluded is context: show the state it has, never offer to
	// write it. An unset one renders nothing at all rather than a "State" button
	// that would look like an invitation.
	if (item.outsideFilter) {
		if (value === null) return;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillStateChip(chip, item, value);
		setTooltip(chip, "Not in this base's filter — state can't be changed here");
		return;
	}

	// A native button, so assistive tech can activate it — but no Tab stop: the
	// tree keeps its single-tab-stop model, and the context menu carries the
	// documented keyboard path (Set state).
	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': value === null ? 'Set state' : `Change state (currently ${value})`,
		},
	});
	fillStateChip(chip, item, value);
	setTooltip(chip, 'Change state');
	chip.addEventListener('click', (evt) => showStateMenu(host, evt, item));
}

function fillStateChip(chip: HTMLElement, item: BacklogItem, value: string | null): void {
	const icon = item.done ? 'circle-check' : value !== null ? 'circle' : 'circle-dashed';
	setIcon(chip.createSpan({ cls: 'pbl-state-icon' }), icon);
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? 'State' });
}
