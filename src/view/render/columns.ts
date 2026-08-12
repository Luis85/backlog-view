import { BasesPropertyId, NullValue, setTooltip } from 'obsidian';
import { drawIcon } from './icons';
import { BacklogViewHost, Column, ColumnFit, ColumnKind, Projection } from '../host';
import { showAssigneeMenu, showHorizonMenu, showRiskMenu, showStateMenu, showTagMenu } from '../interactions/menu';
import { removeTag } from '../interactions/tags';
import { ownWorkflowReading, stateKeyFor } from '../../domain/board';
import { BacklogItem } from '../../domain/model';
import { hasHorizonAxis, SHELF_LABEL } from '../../domain/roadmap';
import { BacklogSettings, hasRiskLevels } from '../../domain/settings';
import { resolvedDeliverableStateKey, resolvedTestStateKey } from '../../domain/optionalProperties';
import { hasRollup, treeShaped } from '../projection';

/**
 * State shared by one render pass. Config lookups live here so per-row work stays
 * proportional to the rows themselves — repeating a handful of Bases config calls
 * on every row is what makes a few hundred items feel slow.
 */
export interface RowContext {
	host: BacklogViewHost;
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

export function rowContext(host: BacklogViewHost, rows: Map<string, HTMLElement>, cardKids: Set<string>): RowContext {
	// What this pass DRAWS. `host.columns` stays what EXISTS — `syncColumnFit` measures
	// that one, or a narrowed pane would ratchet the count down and never let a column
	// come back when it widens again.
	const shown = host.columns.slice(0, host.columnFit?.shown ?? host.columns.length);
	return { host, rows, cardKids, columns: shown };
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
 * How many of the columns fit in a pane this wide, and whether the rollup does. Columns
 * never shrink — that is what keeps them aligned under their header — so a pane too
 * narrow for them drops them instead, and the threshold has to come from what the rows
 * actually need rather than a fixed breakpoint: two 280px columns need more than twice
 * the room of two 100px ones, and every level of indent takes another 24px from the
 * deepest row's title.
 *
 * They drop from the END of the user's order. The properties menu is where the user says
 * what matters, so a ranking of our own beside it would be a second opinion about their
 * own declaration. The rollup is the exception, and only because it is not in that order
 * at all — it is pinned past the end, so "last" would always pick it first; it goes after
 * every column instead.
 *
 * Private: the threshold and what it drives are one decision, applied by
 * {@link syncColumnFit} below. Exporting the calculation alone invites a second caller
 * that measures the same pane and then disagrees about what to hide.
 */
function columnFit(
	settings: BacklogSettings,
	projection: Projection,
	columnCount: number,
	depth: number,
	width: number,
): ColumnFit {
	const meta = (settings.stateKey || settings.showCounts) && hasRollup(projection) ? META_COL_WIDTH : 0;
	const lead = ROW_LEAD_WIDTH + TREE_PADDING + depth * INDENT_PER_DEPTH;
	const room = width - lead - meta;
	const fitting = Math.max(0, Math.floor(room / settings.propColumnWidth));
	const shown = Math.min(columnCount, fitting);
	// Nothing below this: what is left is the row's own lead, and the title truncates
	// from there.
	return { shown, rollupDropped: shown === 0 && width < lead + meta };
}

/**
 * Measure the pane and apply {@link columnFit} to it. Lives with the widths and the
 * threshold it reads — a decision computed in one file and applied in another is one
 * edit away from the two disagreeing.
 *
 * Measured after the rows are in place: an empty tree has no scrollbar, and its width is
 * not the width the columns will actually get. Returns true when the decision CHANGED,
 * which is exactly when what was rendered no longer matches it and the caller owes the
 * rows another pass — and the next pass renders FEWER CELLS rather than hiding the ones
 * it drew. Hiding them would leave a control inside a dropped column reachable by
 * keyboard and by assistive tech, and scroll the strip out from under its header when
 * one took focus.
 *
 * It measures `ctx.host.columns` and never `ctx.columns`: the second is the slice the
 * last verdict produced, and measuring it would ratchet the count down for good.
 */
export function syncColumnFit(ctx: RowContext, viewEl: HTMLElement, treeEl: HTMLElement): boolean {
	const width = treeEl.clientWidth;
	// Zero while detached or before the first layout: keep the last decision.
	if (width === 0) return false;
	// Indent is part of what a row needs, so expanding a deep branch can be what
	// makes the columns stop fitting.
	const fit = columnFit(ctx.host.settings, ctx.host.projection, ctx.host.columns.length, renderedDepth(ctx), width);
	// Against what this pass actually DREW rather than against the stored number, so a
	// render that drew a different count than the verdict claims still asks for the pass
	// that reconciles them.
	const changed = fit.shown !== ctx.columns.length || fit.rollupDropped !== viewEl.hasClass('pbl-hide-meta');
	// The whole verdict, stored as one value: the rows slice by `shown` and the header
	// asks about `rollupDropped`, and two members written separately are two things that
	// can end up describing different frames.
	ctx.host.setColumnFit(fit);
	viewEl.toggleClass('pbl-hide-meta', fit.rollupDropped);
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
	if (!treeShaped(ctx.host.projection)) return 0;
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
 * Which rendering a visible property gets. Each kind asks the SAME predicate the menu
 * behind that chip is gated on, so a chip whose menu could set nothing cannot exist —
 * but that predicate is not one rule for all of them, and saying so would be claiming
 * more than these five lines do:
 *
 * - `horizon` and `risk` are a PAIR, a key AND a declared vocabulary (`hasHorizonAxis`,
 *   `hasRiskLevels`), because neither menu has anywhere else to get its values. With the
 *   list cleared the property falls through to `value` and renders as an ordinary column,
 *   which is the behaviour the risk chip already had and is now stated for both of them.
 * - `state` is the KEY alone, deliberately: `stateMenuValues` falls back to the states
 *   observed on the results (plus a done value), so a state property with no configured
 *   list still has a menu with something in it. Pairing it would withhold the chip from
 *   every vault that never declared its workflow.
 * - `assignee` is the key alone for a sharper version of the same reason: its menu
 *   carries **New assignee...** whatever the results hold, so there is no vocabulary it
 *   could be missing and no second half to pair with.
 *
 * Only the first bullet is under a test of this function (`test/view/columnKinds.test.ts`
 * clears both vocabularies and asks for `value`); the second is a fact about
 * `stateMenuValues`, asserted where that lives — `test/domain/settings.test.ts`, whose
 * `stateMenuValues` block returns the observed states with an undeclared workflow and
 * `['Done']` with nothing observed either, so the menu this chip opens is never empty.
 *
 * All three state keys map to `state`. With two or more workflows on distinct keys and
 * all visible, that is two or three columns, and `renderStateChip` draws into whichever
 * one names the key this row's own workflow writes.
 */
function columnKind(settings: BacklogSettings, prop: BasesPropertyId): ColumnKind {
	const deliverableKey = resolvedDeliverableStateKey(settings);
	const testKey = resolvedTestStateKey(settings);
	if (settings.stateKey && prop === `note.${settings.stateKey}`) return 'state';
	if (deliverableKey && prop === `note.${deliverableKey}`) return 'state';
	if (testKey && prop === `note.${testKey}`) return 'state';
	if (hasHorizonAxis(settings) && prop === `note.${settings.horizonKey}`) return 'horizon';
	if (hasRiskLevels(settings) && prop === `note.${settings.riskKey}`) return 'risk';
	if (settings.assigneeKey && prop === `note.${settings.assigneeKey}`) return 'assignee';
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
	// CONFIGURED is not DRAWN, and this asks the second: the rollup is pinned past the end
	// of the column list rather than being one of them, so a strip narrowed to zero
	// properties still draws it on every row — but a pane too narrow for even that drops
	// it, and a header built from the configuration alone was then a sticky, bordered bar
	// holding a spacer, an empty box and a label the stylesheet hides. It reads the fit
	// the LAST pass measured, exactly as the columns above do; a verdict that has changed
	// since buys the reconciling pass `syncColumnFit` asks for, which draws both from the
	// same one.
	const rollup =
		(settings.stateKey !== '' || settings.showCounts) &&
		hasRollup(ctx.host.projection) &&
		!ctx.host.columnFit?.rollupDropped;
	// Nothing to head at all, which is not the same question as "no columns".
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
	drawIcon(containerEl.createDiv({ cls: 'pbl-add-spacer clickable-icon', attr: { 'aria-hidden': 'true' } }), 'plus');
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
 *
 * `dropEmpty` is the card's own request: the tree needs every drawn column's cell on
 * every row, empty or not, because the columns are fixed-width and share a header — an
 * absent cell would shift every one after it (`src/view/CLAUDE.md`). A card has no such
 * row to stay aligned with, so an empty cell there is not a value that happens to be
 * blank, it is a chip-shaped gap with nothing in it — `padding-inline-end` alone, wide
 * enough to misalign the chips around it. Off by default, so the tree's own call is
 * unchanged. Asked of `renderCell`'s own answer rather than read back off the DOM it
 * built: a second derivation of "is there anything here" is how the tag menu once came
 * to offer editing for a column the renderer had skipped.
 */
export function renderPropCells(
	ctx: RowContext,
	row: HTMLElement,
	item: BacklogItem,
	columns: Column[],
	{ dropEmpty = false }: { dropEmpty?: boolean } = {},
): void {
	const props = row.createDiv({ cls: 'pbl-props' });
	for (const column of columns) {
		// `value` takes no modifier: `.pbl-prop-value` is already the class of the SPAN
		// a plain value renders into, and giving the cell the same name would make one
		// selector mean two boxes.
		const cls = 'pbl-prop' + (column.kind === 'value' ? '' : ` pbl-prop-${column.kind}`);
		const cell = props.createDiv({ cls });
		const drew = renderCell(ctx.host, cell, item, column);
		if (dropEmpty && !drew) cell.detach();
	}
}

/**
 * Which of the five renderings this column asked for.
 *
 * Every one of them is handed the COLUMN's own display name, because that is the only
 * thing on the row that says which property the cell is: the header
 * (`renderColumnHeader`) is `aria-hidden`, so a chip whose accessible name says only
 * "Change state" is unidentifiable — and two state columns are legal now, so two such
 * chips can be on screen at once naming different properties. The chips put the name in
 * the accessible name and keep the TOOLTIP a plain statement of what pressing does: a
 * pointer user has the visible header directly above the cell, and a chip only ever
 * renders in the tree, which always draws that header when it draws a column.
 *
 * A context row's `.pbl-state-static` form is deliberately left out of this. It is a
 * `div` with no role, where an `aria-label` names nothing reliably — the accessible name
 * of a generic element is its own text, which here IS the value — so the label it would
 * carry is the tooltip's job, and that tooltip already says why the cell cannot be
 * written rather than what pressing it would do.
 *
 * Returns whether it drew anything — each branch's own answer, not a second reading of
 * the cell it just built, so `renderPropCells`' `dropEmpty` and this function's idea of
 * "empty" can never disagree.
 */
function renderCell(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, column: Column): boolean {
	if (column.kind === 'tags') return renderTagCell(host, cell, item, column);
	if (column.kind === 'state') return renderStateChip(host, cell, item, column);
	if (column.kind === 'horizon') return renderHorizonChip(host, cell, item, column.label);
	if (column.kind === 'risk' || column.kind === 'assignee')
		return renderLabelChip(host, cell, item, column.label, LABEL_CHIPS[column.kind]);
	return renderValue(host, cell, item, column);
}

/**
 * What a chip announces. The verb is ours and stays sentence case; the noun is the
 * property's own display name, so the control says which key it writes rather than which
 * KIND of thing it is.
 */
function chipLabel(label: string, value: string | null): string {
	return value === null ? `Set ${label}` : `Change ${label} (currently ${value})`;
}

function renderValue(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, column: Column): boolean {
	// An ancestor from outside the filter has no Bases row, so no property values.
	let value = null;
	try {
		value = item.entry?.getValue(column.prop) ?? null;
	} catch {
		return false;
	}
	if (value === null || value instanceof NullValue) return false;
	// isEmpty() is declared on some Value subclasses (ObjectValue) but not on Value
	// itself, so this stays a genuine test of the value in hand, not a version guard.
	const maybeEmpty = value as { isEmpty?: () => boolean };
	if (typeof maybeEmpty.isEmpty === 'function' && maybeEmpty.isEmpty()) return false;

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
		return false;
	}
	// The column is narrow and the header names it only once — say both here, and
	// in the accessible name too, since the header itself is presentational (and
	// for a purely visual rendering it is the only thing that says what the cell is).
	const described = `${column.label}: ${rendered || text}`;
	setTooltip(valueEl, described);
	valueEl.setAttribute('aria-label', described);
	return true;
}

/**
 * Tags as pills, each removable, with a button to add one. A note the Base excluded
 * is context: its tags render, but nothing on the row offers to write them.
 *
 * Draws SOMETHING whenever there is a pill or an add affordance — a context row with no
 * tags gets neither, which is the one case this cell has nothing to show at all.
 */
function renderTagCell(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, column: Column): boolean {
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
		drawIcon(remove, 'x');
		setTooltip(remove, `Remove #${tag}`);
		remove.addEventListener('click', (evt) => {
			// `preventDefault` only: a tag pill is a link-shaped control, and the row's own
			// handler already ignores it (`fromRowControl`).
			evt.preventDefault();
			removeTag(host, item, tag);
		});
	}
	if (item.tags.length > 0) setTooltip(cell, `${column.label}: ${item.tags.map((t) => `#${t}`).join(', ')}`);
	if (!editable) return item.tags.length > 0;

	const add = cell.createEl('button', {
		cls: 'pbl-tag-add',
		attr: { type: 'button', tabindex: '-1', 'aria-label': 'Add tag' },
	});
	drawIcon(add, 'plus');
	setTooltip(add, 'Add tag');
	add.addEventListener('click', (evt) => showTagMenu(host, evt, item));
	return true;
}

/** Progress rollup or descendant count, in a column of its own so both align. */
export function renderRollup(host: BacklogViewHost, row: HTMLElement, item: BacklogItem): void {
	const settings = host.settings;
	if ((!settings.stateKey && !settings.showCounts) || !hasRollup(host.projection)) return;
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
 * WHOSE state is the item's own question — its type, else its ladder — and the same one
 * `Set state` asks in `interactions/menu.ts`: a Deliverable shows and edits the Deliverable
 * workflow's value and a catalog row the test workflow's, so the chip and the menu it opens
 * can never name different states. Either one under the fallback (no property of its own
 * configured) reads the shared key, so this is the identical value either way.
 */
function renderStateChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem, column: Column): boolean {
	// The CELL is the properties menu's question and the CHIP is the row's own: this
	// column names ONE key, and a row draws into it only when that is the key its
	// workflow writes. With both workflows visible on distinct keys there are two such
	// columns, and every row fills exactly one of them and leaves the other empty —
	// empty rather than absent, or the columns after it would shift on that row alone.
	// `stateKeyFor` is the same function `buildItemMenu` gates Set state on, so the chip
	// and the menu can never disagree about which key this row writes.
	const key = stateKeyFor(host.settings, item);
	if (!key || `note.${key}` !== column.prop) return false;
	const { value, done } = ownWorkflowReading(item);
	const cls = 'pbl-state-chip' + (done ? ' pbl-state-done' : '') + (value === null ? ' pbl-state-unset' : '');

	// A note the Base excluded is context: show the state it has, never offer to
	// write it. An unset one renders nothing at all rather than a "State" button
	// that would look like an invitation.
	if (item.outsideFilter) {
		if (value === null) return false;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillStateChip(chip, done, value);
		setTooltip(chip, "Not in this base's filter — state can't be changed here");
		return true;
	}

	// A native button, so assistive tech can activate it — but no Tab stop: the
	// tree keeps its single-tab-stop model, and the context menu carries the
	// documented keyboard path (Set state).
	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': chipLabel(column.label, value),
		},
	});
	fillStateChip(chip, done, value);
	setTooltip(chip, 'Change state');
	chip.addEventListener('click', (evt) => showStateMenu(host, evt, item));
	return true;
}

function fillStateChip(chip: HTMLElement, done: boolean, value: string | null): void {
	const icon = done ? 'circle-check' : value !== null ? 'circle' : 'circle-dashed';
	drawIcon(chip.createSpan({ cls: 'pbl-state-icon' }), icon);
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
function renderHorizonChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem, label: string): boolean {
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
		if (unplaced) return false;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillHorizonChip(chip, value);
		setTooltip(chip, "Not in this base's filter — horizon can't be changed here");
		return true;
	}

	// A native button with no Tab stop, the state chip's bargain: reachable by
	// assistive tech, invisible to Tab, with the context menu as the keyboard path.
	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': chipLabel(label, value),
		},
	});
	fillHorizonChip(chip, value);
	setTooltip(chip, reason ?? 'Change horizon');
	chip.addEventListener('click', (evt) => showHorizonMenu(host, evt, item));
	return true;
}

/**
 * The two LABEL chips — the risk level and the assignee — as data rather than as two
 * copies of one renderer. Each carries the icon of the menu it opens, so the chip and
 * the row's Set entry read as one control, and each names the property in its own words:
 * an unset chip is an INVITATION, not a placement, so it says what could go there rather
 * than the horizon's `Unplaced`.
 */
const LABEL_CHIPS: Record<'risk' | 'assignee', LabelChip> = {
	risk: {
		valueOf: (item) => item.riskValue,
		cls: 'pbl-risk-chip',
		unsetCls: 'pbl-risk-unset',
		icon: 'shield-alert',
		unsetIcon: 'shield',
		placeholder: 'Risk',
		noun: 'risk',
		showMenu: showRiskMenu,
	},
	assignee: {
		valueOf: (item) => item.assigneeValue,
		cls: 'pbl-assignee-chip',
		unsetCls: 'pbl-assignee-unset',
		icon: 'user',
		unsetIcon: 'user-plus',
		placeholder: 'Assignee',
		noun: 'assignee',
		showMenu: showAssigneeMenu,
	},
};

interface LabelChip {
	valueOf: (item: BacklogItem) => string | null;
	cls: string;
	unsetCls: string;
	icon: string;
	unsetIcon: string;
	/** What an unset chip says — the property, not a value, because there is none. */
	placeholder: string;
	/** The property's name in a sentence, for the tooltips. */
	noun: string;
	showMenu: (host: BacklogViewHost, evt: MouseEvent, item: BacklogItem) => void;
}

/**
 * Clickable label chip — the state chip's shape, over a plain value the note declares.
 * Each kind is drawn on the same test the row menu's own Set entry is gated on
 * (`columnKind` states which, per kind), so a chip whose menu could set nothing is not a
 * state either side can reach alone, and it opens that menu's own builder through
 * `showMenu` rather than a second list.
 */
function renderLabelChip(host: BacklogViewHost, col: HTMLElement, item: BacklogItem, label: string, spec: LabelChip): boolean {
	const value = spec.valueOf(item);
	const cls = spec.cls + (value === null ? ` ${spec.unsetCls}` : '');

	// A note the Base excluded is context: show what it claims, never offer to change
	// it. With nothing to show it renders nothing at all, rather than a button-shaped
	// invitation to a write this row cannot take.
	if (item.outsideFilter) {
		if (value === null) return false;
		const chip = col.createDiv({ cls: `${cls} pbl-state-static` });
		fillLabelChip(chip, value, spec);
		setTooltip(chip, `Not in this base's filter — ${spec.noun} can't be changed here`);
		return true;
	}

	// A native button with no Tab stop, the state chip's bargain: reachable by
	// assistive tech, invisible to Tab, with the context menu as the keyboard path.
	const chip = col.createEl('button', {
		cls,
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': chipLabel(label, value),
		},
	});
	fillLabelChip(chip, value, spec);
	setTooltip(chip, `Change ${spec.noun}`);
	chip.addEventListener('click', (evt) => spec.showMenu(host, evt, item));
	return true;
}

/**
 * A label chip's face. An EMPTY value — the stub the backfill leaves — is a key with
 * nothing in it, so it says the same thing absence does; the menu's Clear entry is still
 * what takes the key away.
 */
function fillLabelChip(chip: HTMLElement, value: string | null, spec: LabelChip): void {
	drawIcon(chip.createSpan({ cls: 'pbl-state-icon' }), value === null ? spec.unsetIcon : spec.icon);
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? spec.placeholder });
}

/**
 * The chip's face. Unplaced is named with the roadmap's own word for it — the shelf
 * is where such a row sits there — rather than with the property's name: the chip
 * states a placement, and "not placed yet" is one. What pressing it does is in the
 * accessible name, which is where the state chip puts it too.
 */
function fillHorizonChip(chip: HTMLElement, value: string | null): void {
	drawIcon(chip.createSpan({ cls: 'pbl-state-icon' }), value === null ? 'inbox' : 'milestone');
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? SHELF_LABEL });
}
