import { BasesPropertyId, NullValue, setTooltip, Value } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { BacklogViewHost, Column, ColumnFit, ColumnKind } from '../host';
import { columnWidth, columnWidthVar, renderColumnResize, widenSign } from '../interactions/columnResize';
import { dateChipFor, LABEL_CHIPS, renderDateChip, renderHorizonChip, renderLabelChip, renderStateChip } from './chips';
import { DEFAULT_PROP_COLUMN_WIDTH } from '../../storage/viewStateStore';
import { BacklogItem } from '../../domain/model';
import { hasHorizonAxis } from '../../domain/roadmap';
import { BacklogSettings, hasPriorityLevels, hasRiskLevels } from '../../domain/settings';
import { resolvedDeliverableStateKey, resolvedTestStateKey } from '../../domain/optionalProperties';
import { hasRollup, projectionPopulation, treeShaped } from '../projection';

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
	/**
	 * The paths this pass actually DREW — a card, a timeline row or a marker's diamond.
	 * Filled by the surfaces as they render and read after they have all run, so "is this
	 * item on screen" is a fact rather than a prediction — the same arrangement `cardKids`
	 * above uses, and for the same reason. It is published as `RoadmapSnapshot.placed`,
	 * whose own comment says why it is paths and not mounts.
	 *
	 * The roadmap needs it because its model is not what it draws: `RoadmapModel.shelf`
	 * holds every shelved item whether or not `host.shelfCollapsed` shows them, and
	 * `organizeShelf` drops whole groups from an EXPANDED shelf through
	 * `host.shelfHiddenTypes`.
	 */
	placed: Set<string>;
	/**
	 * Signature per rendered path, from the pass that drew it — read to decide whether a
	 * row may be KEPT (`rowSignature`, and ADR 0029). One lifetime with `rows` beside it,
	 * which is why `clearRowIndex` clears the two together: a signature index that outlived
	 * its rows would claim elements that are gone. A path ABSENT here is a row that may
	 * never be claimed — it drew another note's content, or its note is not in the metadata
	 * cache yet.
	 */
	sigs: Map<string, string>;
	columns: Column[];
}

export function rowContext(
	host: BacklogViewHost,
	rows: Map<string, HTMLElement>,
	cardKids: Set<string>,
	sigs: Map<string, string>,
): RowContext {
	// What this pass DRAWS. `host.columns` stays what EXISTS — `syncColumnFit` measures
	// that one, or a narrowed pane would ratchet the count down and never let a column
	// come back when it widens again.
	const shown = host.columns.slice(0, host.columnFit?.shown ?? host.columns.length);
	// Created here rather than on the view: `backlogView.ts` already passes this context
	// to the whole render pass, and the register is a fact about one pass.
	return { host, rows, cardKids, placed: new Set(), sigs, columns: shown };
}

/**
 * The rollup column's FLOOR — its width whenever the labels in it are short enough to sit
 * inside it, which is every tree counting under a hundred. `metaColWidth` below is what
 * anything outside this file asks, because the answer depends on the data; the fallbacks
 * in styles.css are defaults for a stylesheet loaded without a render, not a second
 * opinion.
 */
const META_COL_WIDTH = 84;

/**
 * A digit's advance in the rollup label, at the widest it is worth budgeting for.
 *
 * The label is `--font-ui-smaller` (12px by default), where a figure measures about 7.2px
 * in Obsidian's own UI font; 8 is a deliberate ceiling over that rather than a
 * measurement, because the number's job here is to make the BUDGET conservative. The
 * layout does not depend on it — the label reserves in `ch`, which is exact for whatever
 * font is in front of the reader, and `styles/columns.css` lets the lane grow to whatever
 * that comes to. What this decides is only how much room `columnFit` sets aside.
 *
 * Where the two can still disagree: a phone with a large text size resolves
 * `--font-ui-smaller` above 12px, so a figure can exceed 8px and the budget is a few
 * pixels optimistic there. The layout stays correct — the lane grows — and the cost is the
 * one this constant is a ceiling to avoid, not a return of it.
 */
const ROLLUP_CHAR_PX = 8;

/**
 * The rollup lane at the width THIS tree's widest label needs, which is what both the
 * stylesheet and the fit budget must use.
 *
 * `columnFit` subtracted the flat 84px while the lane grew past it, and the two disagreed
 * exactly where it matters: at a fit boundary the row's flexible middle is already at
 * zero, `.pbl-tree` is `overflow-x: hidden`, and the extra width is taken out of the end
 * of the row rather than out of slack that is no longer there. (Codex, PR #153 — the first
 * version of this shipped that disagreement as an accepted cost, which it was not.)
 */
export function metaColWidth(chars: number): number {
	return Math.max(META_COL_WIDTH, 48 + 4 + Math.ceil(chars * ROLLUP_CHAR_PX));
}

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
function columnFit(host: BacklogViewHost, columns: readonly Column[], depth: number, width: number): ColumnFit {
	const settings = host.settings;
	// The lane at the width THIS tree's labels need, never the flat constant: the two
	// disagreed exactly at a fit boundary, where the row's flexible middle is already spent.
	const model = host.model;
	const chars = model === null ? 0 : rollupChars(host, projectionPopulation(host.projection, model).items);
	const meta = (settings.stateKey || settings.showCounts) && hasRollup(host.projection) ? metaColWidth(chars) : 0;
	const lead = ROW_LEAD_WIDTH + TREE_PADDING + depth * INDENT_PER_DEPTH;
	const room = width - lead - meta;
	// Summed rather than divided: each column carries its own width now, so how many fit
	// depends on WHICH ones — a 280px first column and a 90px second are not two columns
	// of the same size, and a division by any one of them answers for none of them. The
	// loop stops at the first column that does not fit rather than skipping it, because
	// they drop from the END of the user's order.
	let used = 0;
	let shown = 0;
	for (const column of columns) {
		used += columnWidth(host, column.prop);
		if (used > room) break;
		shown++;
	}
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
	const fit = columnFit(ctx.host, ctx.host.columns, renderedDepth(ctx), width);
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
 * - `horizon`, `risk` and `priority` are a PAIR each, a key AND a declared vocabulary
 *   (`hasHorizonAxis`, `hasRiskLevels`, `hasPriorityLevels`), because none of those menus
 *   has anywhere else to get its values. With the list cleared the property falls through
 *   to `value` and renders as an ordinary column, which is the behaviour the risk chip
 *   already had and is now stated for all three.
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
	// A LIST, in the order the keys are asked, rather than the chain of ifs this was: the
	// chain hit the complexity budget at the eighth key, and every branch in it asked one
	// question — does this key name this column. An entry's key is `''` exactly when its
	// feature is not configured enough for the chip to have anything to do, which is where
	// each kind's OWN predicate is applied and the reason they differ is stated above.
	//
	// The two date ends take the KEY alone, the assignee's reasoning rather than the
	// horizon's: a date field needs no declared vocabulary, so there is no second half to
	// pair with. `hasDateAxis` is deliberately not asked — it answers whether the ROADMAP
	// can draw a timeline, and a row editing one end of its own plan does not need the
	// other end to exist.
	const claims: [key: string, kind: ColumnKind][] = [
		[settings.stateKey, 'state'],
		[resolvedDeliverableStateKey(settings), 'state'],
		[resolvedTestStateKey(settings), 'state'],
		[hasHorizonAxis(settings) ? settings.horizonKey : '', 'horizon'],
		[hasRiskLevels(settings) ? settings.riskKey : '', 'risk'],
		[hasPriorityLevels(settings) ? settings.priorityKey : '', 'priority'],
		[settings.assigneeKey, 'assignee'],
		[settings.startKey, 'start'],
		[settings.targetKey, 'target'],
		[settings.tagsKey, 'tags'],
	];
	for (const [key, kind] of claims) {
		if (key !== '' && prop === `note.${key}`) return kind;
	}
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
 *
 * Returns the header it drew, or null where there was nothing to head. The caller needs
 * the element rather than a second look at the container: a reconciling pass walks the
 * rows after it, and the node the walk starts at is the one thing that decides whether
 * its prune can reach the header.
 */
export function renderColumnHeader(ctx: RowContext, containerEl: HTMLElement): HTMLElement | null {
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
	if (ctx.columns.length === 0 && !rollup) return null;
	const header = containerEl.createDiv({ cls: 'pbl-cols' });
	header.createDiv({ cls: 'pbl-row-spacer' });

	const props = header.createDiv({ cls: 'pbl-props' });
	// One style read for the whole strip, not one per grip — see `widenSign`.
	const widen = widenSign(props);
	for (const [index, column] of ctx.columns.entries()) {
		const cell = props.createDiv({ cls: 'pbl-prop pbl-col-label' });
		sizeCell(cell, index);
		// The NAME is presentational — every value under it carries its own accessible
		// label, which is why `renderCell` hands each chip the column's display name. The
		// header itself no longer is: it carries the resize grips, and `aria-hidden`
		// inherits, so hiding the whole strip would hide the only control that resizes a
		// column from exactly the readers who cannot drag one.
		const name = cell.createSpan({ cls: 'pbl-col-name', text: column.label, attr: { 'aria-hidden': 'true' } });
		setTooltip(name, column.label);
		renderColumnResize(ctx.host, cell, containerEl, { prop: column.prop, label: column.label, index, widen });
	}
	if (rollup) {
		header.createDiv({
			cls: 'pbl-meta-col pbl-col-label',
			text: settings.stateKey ? t('column.rollupProgress') : t('column.rollupItems'),
			attr: { 'aria-hidden': 'true' },
		});
	}
	renderAddSpacer(header);
	return header;
}

/**
 * Point one cell at its column's published width. `--pbl-prop-w` is what the stylesheet
 * lays out with, and it resolves the indexed property the tree element carries — see
 * {@link columnWidthVar} for why the cell holds a reference rather than a number. An
 * index of -1 is a column no render published, and keeps the stylesheet's own default.
 */
function sizeCell(cell: HTMLElement, index: number): void {
	if (index < 0) return;
	cell.setCssProps({ '--pbl-prop-w': `var(${columnWidthVar(index)}, ${DEFAULT_PROP_COLUMN_WIDTH}px)` });
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
 *
 * The WRAPPER goes too when every cell inside it did — `.pbl-props` is itself a flex
 * child of `.pbl-card`, which lays out in a column with its own `gap`; an empty wrapper
 * still counts as a child for that gap to measure from, so a card whose columns are ALL
 * empty (a lone plain property with no value, or a context card with nothing on any of
 * its cells) would keep exactly the double-gap this option exists to remove, just moved
 * up one level. (Codex, PR #132.)
 */
export function renderPropCells(
	ctx: RowContext,
	row: HTMLElement,
	item: BacklogItem,
	columns: Column[],
	{ dropEmpty = false }: { dropEmpty?: boolean } = {},
): void {
	const props = row.createDiv({ cls: 'pbl-props' });
	let anyDrawn = false;
	for (const column of columns) {
		// `value` takes no modifier: `.pbl-prop-value` is already the class of the SPAN
		// a plain value renders into, and giving the cell the same name would make one
		// selector mean two boxes.
		const cls = 'pbl-prop' + (column.kind === 'value' ? '' : ` pbl-prop-${column.kind}`);
		const cell = props.createDiv({ cls });
		// Which column this IS, not where it sits in the list this caller passed: a card
		// narrows that list, and a cell reading its neighbour's width would be one more
		// thing to keep in step. A column the caller made up rather than passed through
		// gets no width, and the stylesheet's own default — which is all a card wants,
		// since `.pbl-card .pbl-prop` sizes itself to its content either way.
		sizeCell(cell, ctx.columns.indexOf(column));
		const drew = renderCell(ctx.host, cell, item, column);
		if (drew) anyDrawn = true;
		else if (dropEmpty) cell.detach();
	}
	if (dropEmpty && !anyDrawn) props.detach();
}

/**
 * Which of the five renderings this column asked for.
 *
 * Every one of them is handed the COLUMN's own display name, because that is the only
 * thing on the row that says which property the cell is: the header's column NAME is
 * `aria-hidden` (`renderColumnHeader` — the strip itself is not, since it carries the
 * resize grips), so a chip whose accessible name says only
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
	if (column.kind === 'risk' || column.kind === 'priority' || column.kind === 'assignee')
		return renderLabelChip(host, cell, item, column.label, LABEL_CHIPS[column.kind]);
	// A date is the one kind that draws DIFFERENTLY per projection, and the asymmetry is
	// the point rather than an exception waiting to be smoothed away: a card has to keep
	// showing the value — no column and no bucket says when — while the chip's entry is
	// the ROW's, reached from a row menu no card projection carries. So a card gets what
	// it had before the chips existed, the plain value, and only a tree-shaped projection
	// gets the control. Asked through `treeShaped` rather than compared against 'tree',
	// so the catalog is a tree here without anyone remembering to add it.
	if (column.kind === 'start' || column.kind === 'target') {
		return treeShaped(host.projection)
			? renderDateChip(host, cell, item, column.label, dateChipFor(column.kind))
			: renderValue(host, cell, item, column);
	}
	return renderValue(host, cell, item, column);
}


/**
 * Whether a Bases value draws anything at all.
 *
 * One statement of it, because two readings drift: a missing property comes back as a
 * `NullValue` INSTANCE rather than `null`, and `isEmpty` is declared on some `Value`
 * subclasses (`ObjectValue`) and not on `Value` itself, so both tests are easy to write
 * differently the second time — the second reading's first draft asked `!= null`, which a
 * `NullValue` instance passes. {@link renderValue} asks it to decide whether to draw a
 * cell, and `valueKinds` (`view/rowSignature.ts`) asks it to decide which value it may
 * read a rendered TYPE from. Neither test is a version guard; both are genuine questions
 * about the value in hand.
 */
export function drawsSomething(value: Value | null): value is Value {
	if (value === null || value instanceof NullValue) return false;
	const maybeEmpty = value as { isEmpty?: () => boolean };
	return !(typeof maybeEmpty.isEmpty === 'function' && maybeEmpty.isEmpty());
}

function renderValue(host: BacklogViewHost, cell: HTMLElement, item: BacklogItem, column: Column): boolean {
	// An ancestor from outside the filter has no Bases row, so no property values.
	let value: Value | null = null;
	try {
		value = item.entry?.getValue(column.prop) ?? null;
	} catch {
		return false;
	}
	if (!drawsSomething(value)) return false;

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
 * Draws SOMETHING whenever there is a pill — never for the add button alone, editable or
 * not: `.pbl-tag-add` is `opacity: 0` until the row or card is hovered or focused
 * (`styles/tags.css`), so at rest it draws nothing a reader can see, only a reserved
 * width. Zero tags is therefore "nothing to show" on BOTH branches now, which is why the
 * editable one's final answer joins the non-editable one's rather than staying an
 * unconditional `true` — the tree ignores the difference (`dropEmpty` is never on there,
 * so the cell and its hover-reveal button keep their place regardless); a card drops the
 * cell, and its own context menu's **Edit tags** — offered whenever the tags property is
 * a visible column, independent of any one item's own cell — remains the reliable way to
 * add a first tag. (Codex, PR #132.)
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
			attr: { type: 'button', tabindex: '-1', 'aria-label': t('column.removeTag', { tag }) },
		});
		// The tag this button removes, read back by the delegated handler
		// (`wireChipEvents` in `render/rows.ts`) rather than parsed off the rendered
		// `#${tag}` text.
		remove.dataset.tag = tag;
		drawIcon(remove, 'x');
		setTooltip(remove, t('column.removeTagTooltip', { tag }));
	}
	if (item.tags.length > 0) setTooltip(cell, `${column.label}: ${item.tags.map((t) => `#${t}`).join(', ')}`);
	if (!editable) return item.tags.length > 0;

	const add = cell.createEl('button', {
		cls: 'pbl-tag-add',
		attr: { type: 'button', tabindex: '-1', 'aria-label': t('column.addTag') },
	});
	drawIcon(add, 'plus');
	setTooltip(add, t('column.addTag'));
	return item.tags.length > 0;
}

/** What an item's rollup says, in one place — see {@link rollupReport}. */
export interface RollupReport {
	/** Face text: "3/8" with a workflow, "8" without one, '' for a leaf. */
	label: string;
	/** Long form for a tooltip, or '' when there is no ratio to state. */
	tooltip: string;
	/** Done share 0..1, or null when no workflow makes one meaningful. */
	ratio: number | null;
}

/**
 * What an item's rollup SAYS — the guard, the ratio and both strings, in one place.
 *
 * Two renderers read this: the tree's rollup column below, and `renderBarProgress` for
 * the roadmap's dated rows. They draw different DOM — a meta column, versus a band
 * inside a bar and a count in a lead cell — but they must never disagree about the
 * words or about when there is nothing to say, which is what
 * `Progress on the bar` guarantees. Copies of a string are how that guarantee rots.
 *
 * Null means the rollup is OFF for this view — no workflow and no counts configured, or
 * a projection with no rollup — and nothing is drawn. An empty `label` is the other
 * emptiness: the rollup is on and this item is a leaf, which the tree still gives an
 * empty `.pbl-meta-col` so its row stays aligned with the header and with its non-leaf
 * siblings. An empty measure is not a zero, and it is not an absent column either.
 */
export function rollupReport(host: BacklogViewHost, item: BacklogItem): RollupReport | null {
	const settings = host.settings;
	if ((!settings.stateKey && !settings.showCounts) || !hasRollup(host.projection)) return null;
	if (item.descendantCount === 0) return { label: '', tooltip: '', ratio: null };
	if (!settings.stateKey) return { label: String(item.descendantCount), tooltip: '', ratio: null };
	return {
		label: `${item.doneDescendants}/${item.descendantCount}`,
		tooltip: t('column.rollupTooltip', { done: item.doneDescendants, count: item.descendantCount }),
		ratio: item.doneDescendants / item.descendantCount,
	};
}

/**
 * How many characters the widest rollup label in this tree holds — 0 when nothing
 * reserves. The CHARACTER count rather than a width, because its two readers want
 * different units from it: the stylesheet takes `ch` (exact for the reader's own font)
 * and `metaColWidth` takes pixels (what the fit budget can subtract).
 *
 * The bar and the label share a lane that is anchored at its END, so a label wider than
 * its reservation moves the BAR — and the reservation was a flat 28px, which holds
 * `9/99` and not `44/136`. Reported from a vault of 800-odd PBIs (2026-08-15): rows whose
 * counts have different digit counts draw their bars at different x, and the deeper the
 * backlog the more of them. Every row reserving the widest label's width is what puts
 * them back on one line.
 *
 * `ch` and tabular figures rather than pixels, for the reason `syncBusyCount` gives in
 * `render/toolbarBusy.ts`: `ch` is the advance of "0", every digit has that advance under
 * `font-variant-numeric: tabular-nums`, and a font-relative reservation re-resolves on a
 * theme or font change by itself where a measured pixel goes stale. The slash and the
 * digits are all this label holds, so its LENGTH is its width.
 *
 * Asked of `rollupReport` rather than derived from the counts, so the reservation cannot
 * describe a label the renderer does not produce — the two spellings (`3/8` and `8`) are
 * that function's decision and stay there. Only the ratio form reserves: without a
 * workflow there is no bar to be pushed off line, and the count alone is already anchored
 * at the lane's end.
 *
 * **`isRowHidden`, and deliberately not "is this row on screen".** The
 * completed-items toggle can hide a whole deep subtree, and reserving for a label none of
 * the remaining rows draws widens the lane for all of them and can drop a property column
 * at a fit boundary (Codex, PR #153). What that predicate does NOT ask about is COLLAPSE,
 * which is the half worth keeping: sizing from the rows literally rendered would widen the
 * lane the moment a subtree with a longer label was expanded, and every bar on screen would
 * shift sideways as a side effect of opening one row. Hiding modes re-render everything
 * anyway; expanding one row must not move the rest.
 *
 * It stays a superset of what is drawn in one case — a visible child under a hidden parent
 * is counted and not rendered — and that is the safe direction: over-reserving spends
 * slack, under-reserving puts the bars back out of line, which is the defect this exists
 * to fix.
 */
export function rollupChars(host: BacklogViewHost, items: readonly BacklogItem[]): number {
	if (!host.settings.stateKey) return 0;
	let widest = 0;
	for (const item of items) {
		if (host.isRowHidden(item)) continue;
		const report = rollupReport(host, item);
		if (report && report.ratio !== null) widest = Math.max(widest, report.label.length);
	}
	return widest;
}

/** Progress rollup or descendant count, in a column of its own so both align. */
export function renderRollup(host: BacklogViewHost, row: HTMLElement, item: BacklogItem): void {
	const report = rollupReport(host, item);
	if (!report) return;
	const col = row.createDiv({ cls: 'pbl-meta-col' });
	if (!report.label) return;

	if (report.ratio !== null) {
		const progress = col.createDiv({ cls: 'pbl-progress' + (report.ratio === 1 ? ' pbl-complete' : '') });
		const bar = progress.createDiv({ cls: 'pbl-progress-bar' });
		bar.createDiv({ cls: 'pbl-progress-fill' }).setCssProps({
			'--pbl-progress': `${Math.round(report.ratio * 100)}%`,
		});
		progress.createSpan({ cls: 'pbl-progress-label', text: report.label });
		setTooltip(progress, report.tooltip);
	} else {
		col.createSpan({ cls: 'pbl-count', text: report.label });
	}
}
