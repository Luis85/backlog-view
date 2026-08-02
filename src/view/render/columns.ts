import { BasesPropertyId, NullValue, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, ChipProp } from '../host';
import { DragDropController } from '../interactions/dragDrop';
import { showHorizonMenu, showStateMenu, showTagMenu } from '../interactions/menu';
import { removeTag } from '../interactions/tags';
import { BacklogItem } from '../../domain/model';
import { hasHorizonAxis, SHELF_LABEL } from '../../domain/roadmap';
import { BacklogSettings } from '../../domain/settings';

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
	return { host, dnd, rows, chips: host.chips };
}

/**
 * Widths of the fixed columns. `renderTree` publishes these to CSS as custom
 * properties, so the stylesheet reads them rather than repeating them — the same
 * one-directional trick as the property column width. The fallbacks in styles.css
 * are defaults for a stylesheet loaded without a render, not a second opinion.
 */
export const STATE_COL_WIDTH = 116;
/** The horizon chip's column, sized like the state chip's — it holds the same shape. */
export const HORIZON_COL_WIDTH = 116;
export const META_COL_WIDTH = 84;
/**
 * Everything on a row that is not one of the columns, at its widest: the constant
 * is a sum of the bounds in styles.css rather than a guess, so it can be checked
 * against them. Each term includes the 4px flex gap that follows it.
 */
const ROW_LEAD_WIDTH =
	8 + // row padding, both ends
	18 + // grip
	22 + // chevron
	124 + // badge at its max-width
	64 + // the title's min-width — below this it is not worth showing
	32 + // the orphan and outside-filter markers, which a row can carry both of
	12 + // the spacer that anchors the columns
	28; // the row's own add button
/** Indent one depth level adds; also published to CSS, which applies it per row. */
export const INDENT_PER_DEPTH = 24;
/**
 * The tree's own inline padding, both ends. `clientWidth` counts it, but rows live
 * in the content box, so it is width the columns never get.
 */
const TREE_PADDING = 16;

/**
 * Which columns still fit in a pane this wide. Columns never shrink — that is what
 * keeps them aligned — so a pane too narrow for them has to drop them instead, and
 * the threshold has to come from what the rows actually need rather than a fixed
 * breakpoint: two 280px columns need more than twice the room of two 100px ones,
 * and every level of indent takes another 24px away from the deepest row's title.
 * Columns go in reverse order of usefulness — properties, then the rollup, then the
 * state chip, which survives longest because it summarizes a row on its own.
 *
 * Private: the threshold and the classes it drives are one decision, applied by
 * {@link syncColumnFit} below. Exporting the calculation alone invites a second
 * caller that measures the same pane and then disagrees about what to hide.
 */
function columnFit(
	settings: BacklogSettings,
	chipCount: number,
	depth: number,
	width: number,
): { hideProps: boolean; hideMeta: boolean; hideHorizon: boolean; hideState: boolean } {
	const state = settings.stateKey ? STATE_COL_WIDTH : 0;
	const horizon = hasHorizonAxis(settings) ? HORIZON_COL_WIDTH : 0;
	const meta = settings.stateKey || settings.showCounts ? META_COL_WIDTH : 0;
	const props = settings.showChips ? settings.propColumnWidth * chipCount : 0;
	const lead = ROW_LEAD_WIDTH + TREE_PADDING + depth * INDENT_PER_DEPTH;
	return {
		hideProps: width < lead + state + horizon + meta + props,
		hideMeta: width < lead + state + horizon + meta,
		// The placement goes before the workflow state: a row's state is the one thing
		// that summarizes it on its own, and the roadmap is where a horizon is read.
		hideHorizon: width < lead + state + horizon,
		// Nothing below this: what is left is the row's own lead, and the title
		// truncates from there.
		hideState: width < lead + state,
	};
}

/**
 * Measure the pane and apply {@link columnFit} to it: drop the columns this pane
 * cannot hold, keep the ones it can. Lives with the widths and the threshold it
 * reads — a decision computed in one file and applied in another is one edit away
 * from the two disagreeing.
 *
 * Measured after the rows are in place: an empty tree has no scrollbar, and its
 * width is not the width the columns will actually get. Returns true when the
 * decision CHANGED, which is exactly when what was rendered no longer matches it
 * and the caller owes the rows another pass.
 */
export function syncColumnFit(ctx: RowContext, viewEl: HTMLElement, treeEl: HTMLElement): boolean {
	const width = treeEl.clientWidth;
	// Zero while detached or before the first layout: keep the last decision.
	if (width === 0) return false;
	// Indent is part of what a row needs, so expanding a deep branch can be what
	// makes the columns stop fitting.
	const fit = columnFit(ctx.host.settings, ctx.chips.length, renderedDepth(ctx), width);
	const changed =
		fit.hideProps !== viewEl.hasClass('pbl-hide-props') ||
		fit.hideMeta !== viewEl.hasClass('pbl-hide-meta') ||
		fit.hideHorizon !== viewEl.hasClass('pbl-hide-horizon') ||
		fit.hideState !== viewEl.hasClass('pbl-hide-state');
	viewEl.toggleClass('pbl-hide-props', fit.hideProps);
	viewEl.toggleClass('pbl-hide-meta', fit.hideMeta);
	viewEl.toggleClass('pbl-hide-horizon', fit.hideHorizon);
	viewEl.toggleClass('pbl-hide-state', fit.hideState);
	return changed;
}

/**
 * Deepest row on screen, read off the row index rather than walked out of the
 * model: `ctx.rows` holds exactly what was rendered, so this cannot disagree with
 * the tree the user is looking at, and a collapse shrinks it the same pass it
 * happens in.
 */
function renderedDepth(ctx: RowContext): number {
	let max = 0;
	for (const path of ctx.rows.keys()) {
		const depth = ctx.host.model?.byPath.get(path)?.depth ?? 0;
		if (depth > max) max = depth;
	}
	return max;
}

/**
 * The visible properties to render as columns, with their labels. Resolved once per
 * data update by the view (`host.chips`), because it answers two questions — what the
 * rows draw, and what the tag menu may edit — and they must not drift apart.
 */
export function chipProps(host: BacklogViewHost): ChipProp[] {
	let props: BasesPropertyId[] = [];
	try {
		props = host.config.getOrder();
	} catch {
		return [];
	}
	if (!host.settings.showChips) return [];
	const skip = new Set<string>([
		'file.name',
		`note.${host.settings.parentKey}`,
		`note.${host.settings.orderKey}`,
		`note.${host.settings.typeKey}`,
	]);
	// The interactive chips already show these two properties.
	if (host.settings.stateKey) skip.add(`note.${host.settings.stateKey}`);
	if (hasHorizonAxis(host.settings)) skip.add(`note.${host.settings.horizonKey}`);
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
	if (hasHorizonAxis(settings)) {
		header.createDiv({
			cls: 'pbl-horizon-col pbl-col-label',
			text: chipLabel(ctx.host, `note.${settings.horizonKey}`),
		});
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
	if (hasHorizonAxis(ctx.host.settings)) {
		renderHorizonChip(ctx.host, row.createDiv({ cls: 'pbl-horizon-col' }), item);
	}
	if (ctx.host.settings.stateKey) renderStateChip(ctx.host, row.createDiv({ cls: 'pbl-state-col' }), item);
	renderRollup(ctx.host, row, item);
}

/** Shared with the board's cards — one resolved column list drives both projections. */
export function renderPropCells(ctx: RowContext, row: HTMLElement, item: BacklogItem): void {
	const props = row.createDiv({ cls: 'pbl-props' });
	for (const chip of ctx.chips) {
		const cell = props.createDiv({ cls: 'pbl-prop' });
		if (chip.tags) renderTagCell(ctx.host, cell, item, chip);
		else renderValue(ctx.host, cell, item, chip);
	}
	// Cells may render note links or tag buttons that must not also open the row's
	// own note; the empty space around them stays part of the row's click target.
	props.addEventListener('click', (evt) => {
		if (evt.target instanceof Element && evt.target.closest('.pbl-prop-value, .pbl-tag')) {
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
	// isEmpty() is declared on some Value subclasses (ObjectValue) but not on Value
	// itself, so this stays a genuine test of the value in hand, not a version guard.
	const maybeEmpty = value as { isEmpty?: () => boolean };
	if (typeof maybeEmpty.isEmpty === 'function' && maybeEmpty.isEmpty()) return;

	const text = value.toString().trim();
	const valueEl = cell.createSpan({ cls: 'pbl-prop-value' });
	try {
		value.renderTo(valueEl, host.app.renderContext);
	} catch {
		valueEl.setText(text);
	}
	// Reading textContent serializes whatever renderTo built, so do it once.
	const rendered = valueEl.textContent?.trim() ?? '';
	// Emptiness is a question about the value, not about the DOM it produced: a
	// checkbox or an icon renders no text of its own and is still a value to show.
	if (rendered === '' && text === '') {
		valueEl.detach();
		return;
	}
	// The column is narrow and the header names it only once — say both here, and
	// in the accessible name too, since the header itself is presentational (and
	// for a purely visual rendering it is the only thing that says what the cell is).
	const described = `${chip.label}: ${rendered || text}`;
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
export function renderRollup(host: BacklogViewHost, row: HTMLElement, item: BacklogItem): void {
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

/**
 * Clickable horizon chip — the state chip's shape over the roadmap's placement, so
 * the property a card is dragged between buckets by is settable from the tree too,
 * where most of a backlog is actually read. It opens the same menu the row's own
 * Set horizon does (`addHorizonItems`), which is what keeps every horizon this base
 * can reach reachable from here as well, and checked against the same plan.
 *
 * Rendered on exactly the condition the roadmap draws its bucket axis on
 * (`hasHorizonAxis`) — a property with no declared values is a board without stages,
 * and a chip whose menu could set nothing would be a third opinion about what
 * "configured" means.
 */
function renderHorizonChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem): void {
	// A value the reader refuses is not a placement: the roadmap shelves such a card
	// with the reason on its face, and the chip says the same thing — unplaced, and
	// why — rather than showing a horizon the axis would not honor.
	const value = item.horizon.value;
	const unplaced = value === null;
	const reason = item.horizon.invalid ? 'Unreadable horizon value' : null;
	const cls = 'pbl-horizon-chip' + (unplaced ? ' pbl-horizon-unset' : '');

	// A note the Base excluded is context: show where it sits, never offer to move
	// it. With nothing to show it renders nothing at all, rather than a button-shaped
	// invitation to a write this row cannot take.
	if (item.outsideFilter) {
		if (unplaced) return;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillHorizonChip(chip, value);
		setTooltip(chip, "Not in this base's filter — horizon can't be changed here");
		return;
	}

	// A native button with no Tab stop, the state chip's bargain: reachable by
	// assistive tech, invisible to Tab, with the context menu as the keyboard path.
	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': unplaced ? 'Set horizon' : `Change horizon (currently ${value})`,
		},
	});
	fillHorizonChip(chip, value);
	setTooltip(chip, reason ?? 'Change horizon');
	chip.addEventListener('click', (evt) => showHorizonMenu(host, evt, item));
}

/**
 * The chip's face. Unplaced is named with the roadmap's own word for it — the shelf
 * is where such a row sits there — rather than with the property's name: the chip
 * states a placement, and "not placed yet" is one. What pressing it does is in the
 * accessible name, which is where the state chip puts it too.
 */
function fillHorizonChip(chip: HTMLElement, value: string | null): void {
	setIcon(chip.createSpan({ cls: 'pbl-state-icon' }), value === null ? 'inbox' : 'milestone');
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? SHELF_LABEL });
}
