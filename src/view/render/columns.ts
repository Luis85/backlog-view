import { BasesPropertyId, NullValue, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, Column, ColumnKind } from '../host';
import { DragDropController } from '../interactions/dragDrop';
import { showHorizonMenu, showRiskMenu, showStateMenu, showTagMenu } from '../interactions/menu';
import { removeTag } from '../interactions/tags';
import { ownWorkflowReading, stateKeyFor } from '../../domain/board';
import { BacklogItem } from '../../domain/model';
import { hasHorizonAxis, SHELF_LABEL } from '../../domain/roadmap';
import { BacklogSettings, hasRiskLevels, resolvedDeliverableStateKey } from '../../domain/settings';

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
	/**
	 * Paths whose card drew a child disclosure this pass. Filled by the render and read
	 * by the card menu and the toolbar's bulk controls, so both answer from what is on
	 * screen rather than re-deriving it and hoping the two agree.
	 */
	cardKids: Set<string>;
	columns: Column[];
}

export function rowContext(
	host: BacklogViewHost,
	dnd: DragDropController,
	rows: Map<string, HTMLElement>,
	cardKids: Set<string>,
): RowContext {
	return { host, dnd, rows, cardKids, columns: [...host.columns] };
}

/**
 * Width of the rollup column. `renderTree` publishes it to CSS as a custom property,
 * so the stylesheet reads it rather than repeating it — the same one-directional trick
 * as the property column width. The fallbacks in styles.css are defaults for a
 * stylesheet loaded without a render, not a second opinion.
 */
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
 * Columns go in reverse order of usefulness — properties, then the rollup.
 *
 * **Its verdict is wrong as it stands, deliberately.** The chips are ordinary columns
 * inside `.pbl-props` now, so their three width terms went with the three fixed
 * columns, and nothing has replaced them: the sum under-counts what a row needs and
 * this over-reports the room. It is left that way for the one commit in which the
 * columns became a list and narrowing had not yet been rewritten as a count of how
 * many of them fit — which is the next change to this function, not a term to add back.
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
): { hideProps: boolean; hideRisk: boolean; hideMeta: boolean; hideHorizon: boolean; hideState: boolean } {
	const meta = settings.stateKey || settings.showCounts ? META_COL_WIDTH : 0;
	const props = settings.showChips ? settings.propColumnWidth * chipCount : 0;
	const lead = ROW_LEAD_WIDTH + TREE_PADDING + depth * INDENT_PER_DEPTH;
	return {
		hideProps: width < lead + meta + props,
		hideRisk: width < lead + meta,
		hideMeta: width < lead + meta,
		hideHorizon: width < lead,
		hideState: width < lead,
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
	const fit = columnFit(ctx.host.settings, ctx.columns.length, renderedDepth(ctx), width);
	const changed =
		fit.hideProps !== viewEl.hasClass('pbl-hide-props') ||
		fit.hideRisk !== viewEl.hasClass('pbl-hide-risk') ||
		fit.hideMeta !== viewEl.hasClass('pbl-hide-meta') ||
		fit.hideHorizon !== viewEl.hasClass('pbl-hide-horizon') ||
		fit.hideState !== viewEl.hasClass('pbl-hide-state');
	viewEl.toggleClass('pbl-hide-props', fit.hideProps);
	viewEl.toggleClass('pbl-hide-risk', fit.hideRisk);
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
 *
 * Zero off the tree: a board card is never indented, so the term this measures does
 * not exist on either board-shaped projection — and `.depth` is not safe to read for
 * one anyway. `BacklogModel.deliverableResults` (`domain/model.ts`) is built from the
 * whole, unfocused tree, so under an active focus it can hold items on two different
 * depth SCALES at once: one re-rooted by `assignVisualDepth` (inside the focused
 * subtree) and one still carrying its real hierarchy depth (outside it). Reading
 * either would be answering a question this projection does not ask.
 */
function renderedDepth(ctx: RowContext): number {
	if (ctx.host.projection !== 'tree') return 0;
	let max = 0;
	for (const path of ctx.rows.keys()) {
		const depth = ctx.host.model?.byPath.get(path)?.depth ?? 0;
		if (depth > max) max = depth;
	}
	return max;
}

/**
 * The columns this view draws, in the order the Bases properties menu declares them.
 * Resolved once per data update by the view (`host.columns`), because it answers two
 * questions — what the rows draw, and what the tag menu may edit — and they must not
 * drift apart.
 *
 * Nothing is subtracted for being special any more. A configured state, horizon, risk
 * or tags property is a column when the menu shows it, where the menu puts it, and is
 * absent when it does not: one source for what is on a row, which is what this used to
 * have two of.
 */
export function resolveColumns(host: BacklogViewHost): Column[] {
	let props: BasesPropertyId[] = [];
	try {
		props = host.config.getOrder();
	} catch {
		return [];
	}
	const settings = host.settings;
	// Not properties this view declines to show — the view ITSELF. The tree is the
	// parent column, the badge is the type, the title is the name, and `order` is an
	// implementation number rather than a fact about the item.
	const skip = new Set<string>([
		'file.name',
		`note.${settings.parentKey}`,
		`note.${settings.orderKey}`,
		`note.${settings.typeKey}`,
	]);
	return props
		.filter((prop) => !skip.has(prop))
		.map((prop) => ({ prop, label: columnLabel(host, prop), kind: columnKind(settings, prop) }));
}

/**
 * Which rendering a visible property gets. The three chip kinds ask the SAME predicate
 * their menu is gated on — a key AND a declared vocabulary — so a chip whose menu could
 * set nothing cannot exist: with the list cleared the property falls through to `value`
 * and renders as an ordinary column, which is the behaviour the risk chip already had
 * and is now stated once for all three.
 *
 * Both state keys map to `state`. With the two workflows on distinct keys and both
 * visible, that is two columns, and `renderStateChip` draws into whichever one names
 * the key this row's own workflow writes.
 */
function columnKind(settings: BacklogSettings, prop: BasesPropertyId): ColumnKind {
	const deliverableKey = resolvedDeliverableStateKey(settings);
	if (settings.stateKey && prop === `note.${settings.stateKey}`) return 'state';
	if (deliverableKey && prop === `note.${deliverableKey}`) return 'state';
	if (hasHorizonAxis(settings) && prop === `note.${settings.horizonKey}`) return 'horizon';
	if (hasRiskLevels(settings) && prop === `note.${settings.riskKey}`) return 'risk';
	if (settings.tagsKey && prop === `note.${settings.tagsKey}`) return 'tags';
	return 'value';
}

function columnLabel(host: BacklogViewHost, prop: BasesPropertyId): string {
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
	const settings = ctx.host.settings;
	const rollup = settings.stateKey !== '' || settings.showCounts;
	// Nothing to head at all, which is not the same question as "no columns": the
	// rollup is pinned past the end of the column list rather than being one of them,
	// so a strip narrowed to zero properties still draws it on every row, and a header
	// that returned on the count alone would leave that column unlabelled.
	if (ctx.columns.length === 0 && !rollup) return;
	// Presentational: every value below carries its own accessible label.
	const header = containerEl.createDiv({ cls: 'pbl-cols', attr: { 'aria-hidden': 'true' } });
	header.createDiv({ cls: 'pbl-row-spacer' });

	const props = header.createDiv({ cls: 'pbl-props' });
	for (const column of ctx.columns) {
		const cell = props.createDiv({ cls: 'pbl-prop pbl-col-label', text: column.label });
		setTooltip(cell, column.label);
	}
	if (rollup) {
		header.createDiv({
			cls: 'pbl-meta-col pbl-col-label',
			text: settings.stateKey ? 'Progress' : 'Items',
		});
	}
	renderAddSpacer(header);
}

/**
 * The width a row's add button takes, where there is no button to take it: the header,
 * which is not a row, and a row that can hold nothing (`renderRowTrailing`).
 *
 * Not cosmetic. Everything after `.pbl-row-spacer` is anchored to the row's END, so an
 * absent trailing element is not a control missing — it is every column on that row
 * displaced by its width, which is exactly how a milestone's columns came to sit clear
 * of the backlog above it. Built from the same `clickable-icon` box around the same
 * icon rather than from a width restating Obsidian's padding, so the reservation cannot
 * drift from the thing it reserves for.
 */
export function renderAddSpacer(containerEl: HTMLElement): void {
	setIcon(containerEl.createDiv({ cls: 'pbl-add-spacer clickable-icon', attr: { 'aria-hidden': 'true' } }), 'plus');
}

/**
 * The trailing columns of one row. Every column is fixed-width and the strip is
 * anchored to the row's end, so values line up across rows regardless of title length
 * or indent — and the ORDER is the properties menu's, chips included.
 */
export function renderRowColumns(ctx: RowContext, row: HTMLElement, item: BacklogItem): void {
	// Pushes the columns to the row's end; also the click target between them.
	row.createDiv({ cls: 'pbl-row-spacer' });
	if (ctx.columns.length > 0) renderPropCells(ctx, row, item, ctx.columns);
	renderRollup(ctx.host, row, item);
}

/**
 * Shared with the cards, which pass a narrowed list — one resolved column list drives
 * every projection, and a caller may draw fewer of them but never a different set.
 */
export function renderPropCells(
	ctx: RowContext,
	row: HTMLElement,
	item: BacklogItem,
	columns: Column[],
): void {
	const props = row.createDiv({ cls: 'pbl-props' });
	for (const column of columns) {
		// `value` takes no modifier: `.pbl-prop-value` is already the class of the SPAN
		// a plain value renders into, and giving the cell the same name would make one
		// selector mean two boxes.
		const cls = 'pbl-prop' + (column.kind === 'value' ? '' : ` pbl-prop-${column.kind}`);
		renderCell(ctx.host, props.createDiv({ cls }), item, column);
	}
}

/** Which of the five renderings this column asked for. */
function renderCell(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, column: Column): void {
	if (column.kind === 'tags') renderTagCell(host, cell, item, column);
	else if (column.kind === 'state') renderStateChip(host, cell, item, column.prop);
	else if (column.kind === 'horizon') renderHorizonChip(host, cell, item);
	else if (column.kind === 'risk') renderRiskChip(host, cell, item);
	else renderValue(host, cell, item, column);
}

function renderValue(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, chip: Column): void {
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
function renderTagCell(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, chip: Column): void {
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
			// `preventDefault` only: a tag pill is a link-shaped control, and the row's own
			// handler already ignores it (`fromRowControl`).
			evt.preventDefault();
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

/**
 * Clickable state chip — the inline write surface for the workflow state.
 *
 * WHOSE state is the item's type's question, the same one `Set state` asks in
 * `interactions/menu.ts`: a Deliverable shows and edits the Deliverable workflow's
 * value, so the chip and the menu it opens can never name different states. A
 * Deliverable under the fallback (no Deliverable state property configured) reads the
 * shared key, so this is the identical value either way.
 *
 */
function renderStateChip(
	host: BacklogViewHost,
	col: HTMLElement,
	item: BacklogItem,
	prop: BasesPropertyId,
): void {
	// The CELL is the properties menu's question and the CHIP is the row's own: this
	// column names ONE key, and a row draws into it only when that is the key its
	// workflow writes. With both workflows visible on distinct keys there are two such
	// columns, and every row fills exactly one of them and leaves the other empty —
	// empty rather than absent, or the columns after it would shift on that row alone.
	// `stateKeyFor` is the same function `buildItemMenu` gates Set state on, so the chip
	// and the menu can never disagree about which key this row writes.
	const key = stateKeyFor(host.settings, item);
	if (!key || `note.${key}` !== prop) return;
	const { value, done } = ownWorkflowReading(item);
	const cls = 'pbl-state-chip' + (done ? ' pbl-state-done' : '') + (value === null ? ' pbl-state-unset' : '');

	// A note the Base excluded is context: show the state it has, never offer to
	// write it. An unset one renders nothing at all rather than a "State" button
	// that would look like an invitation.
	if (item.outsideFilter) {
		if (value === null) return;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillStateChip(chip, done, value);
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
	fillStateChip(chip, done, value);
	setTooltip(chip, 'Change state');
	chip.addEventListener('click', (evt) => showStateMenu(host, evt, item));
}

function fillStateChip(chip: HTMLElement, done: boolean, value: string | null): void {
	const icon = done ? 'circle-check' : value !== null ? 'circle' : 'circle-dashed';
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
 * Clickable risk chip — the state chip's shape a third time, over the level the note
 * declares. Rendered on `hasRiskLevels`, the same pair (a named property AND a non-empty
 * list) the row menu's Set risk is gated on, so a chip whose menu could set nothing is
 * not a state either side can reach alone. It opens `addRiskItems` through
 * `showRiskMenu` — the row menu's own builder, never a second list.
 *
 * Unjudged renders as a dashed "Risk" chip rather than as nothing, unlike the horizon's
 * `Unplaced`: absence here is not a placement to name, it is an invitation, and the row
 * is where the judgement is meant to be made.
 */
function renderRiskChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem): void {
	const value = item.riskValue;
	const cls = 'pbl-risk-chip' + (value === null ? ' pbl-risk-unset' : '');

	// A note the Base excluded is context: show the level it claims, never offer to
	// judge it. With nothing to show it renders nothing at all, rather than a
	// button-shaped invitation to a write this row cannot take.
	if (item.outsideFilter) {
		if (value === null) return;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillRiskChip(chip, value);
		setTooltip(chip, "Not in this base's filter — risk can't be changed here");
		return;
	}

	// A native button with no Tab stop, the state chip's bargain: reachable by
	// assistive tech, invisible to Tab, with the context menu as the keyboard path.
	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': value === null ? 'Set risk' : `Change risk (currently ${value})`,
		},
	});
	fillRiskChip(chip, value);
	setTooltip(chip, 'Change risk');
	chip.addEventListener('click', (evt) => showRiskMenu(host, evt, item));
}

/**
 * The risk chip's face, carrying the Set risk menu's own icon so the two read as one
 * control. An EMPTY value — the stub the backfill leaves — is a key with no judgement in
 * it, so it says the same thing absence does; Clear risk is still what takes the key away.
 */
function fillRiskChip(chip: HTMLElement, value: string | null): void {
	setIcon(chip.createSpan({ cls: 'pbl-state-icon' }), value === null ? 'shield' : 'shield-alert');
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? 'Risk' });
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
