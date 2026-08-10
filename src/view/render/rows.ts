import { Keymap, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from '../host';
import { promptCreateItem } from '../interactions/create';
import { showItemMenu } from '../interactions/menu';
import { offerableTypes } from '../projection';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { projectionPopulation } from '../projection';
import { badgeStyleFor } from './badges';
import { BacklogItem } from '../../domain/model';
import { childTypeChoices, displayType } from '../../domain/itemTypes';

import { ownWorkflowReading } from '../../domain/board';
import {
	INDENT_PER_DEPTH,
	META_COL_WIDTH,
	renderAddSpacer,
	renderColumnHeader,
	renderRowColumns,
	RowContext,
} from './columns';

/** Render the tree content (or the empty state) into the tree element. */
export function renderTree(ctx: RowContext, treeEl: HTMLElement): void {
	const model = ctx.host.model;
	if (!model) return;
	// Column widths are the same for every row, so they live on the scroller and
	// are inherited — including by the subtrees a targeted refresh re-renders.
	// Geometry lives in one place: columnFit budgets with these numbers and the
	// stylesheet lays out with them, so the two cannot drift apart.
	treeEl.setCssProps({
		'--pbl-prop-col': `${ctx.host.settings.propColumnWidth}px`,
		'--pbl-prop-count': String(ctx.columns.length),
		'--pbl-meta-col': `${META_COL_WIDTH}px`,
		'--pbl-indent': `${INDENT_PER_DEPTH}px`,
	});
	// THIS projection's population, on all three lines. Both decisions below used to read
	// the shared arrays, which hold every item the model kept: a base returning twelve
	// test notes and no plan work would be told "All 12 items are done and hidden", with a
	// Show completed items button that reveals nothing — because nothing is completed and
	// nothing is hidden by completion. A control offering to reveal what it cannot show.
	//
	// "Is there anything here" is asked of the RESULTS and not of the items, which is the
	// same distinction one line further down rather than a second rule: a context row is
	// placement, never population. A base returning one `PBI` whose excluded parent is a
	// `Test case` gives the catalog exactly one item — that context row — and it is hidden,
	// since the only child it places is a plan row. Counting it as population walked past
	// this branch into "All 0 items are done and hidden", offering a completed toggle in a
	// projection that hides nothing by completion at all.
	const population = projectionPopulation(ctx.host.projection, model);
	if (population.results.length === 0) {
		renderEmptyState(ctx.host, treeEl);
		return;
	}
	// Whether any row will render is knowable before rendering one: renderForest draws
	// a row per root isRowHidden lets through. Asking first keeps the header — which is
	// not a row — from having to be built and then thrown away again.
	if (!population.roots.some((root) => !ctx.host.isRowHidden(root))) {
		if (ctx.host.isFiltering()) renderFilterEmptyState(ctx.host, treeEl);
		else renderAllDoneState(ctx.host, treeEl, population.results.length);
		return;
	}
	renderColumnHeader(ctx, treeEl);
	renderForest(ctx, treeEl, population.roots);
}

/**
 * Re-render one row's child group in place. Expanding and collapsing is the most
 * frequent interaction in a large backlog; rebuilding the whole tree for it would
 * cost hundreds of rows of DOM work to change one subtree.
 */
export function refreshRowChildren(ctx: RowContext, item: BacklogItem, row: HTMLElement): void {
	const collapsed = ctx.host.isCollapsed(item.file.path);
	const hasChildren = item.children.some((c) => !ctx.host.isRowHidden(c));
	row.querySelector('.pbl-chevron')?.classList.toggle('pbl-expanded', hasChildren && !collapsed);
	if (hasChildren) row.setAttribute('aria-expanded', String(!collapsed));

	const existing = row.nextElementSibling;
	if (existing instanceof HTMLElement && existing.hasClass('pbl-children')) {
		forgetSubtree(ctx.rows, item.children);
		existing.detach();
	}
	const parentEl = row.parentElement;
	if (!hasChildren || collapsed || !parentEl) return;
	// createDiv appends to the container; move the group up to sit after its row.
	const childrenEl = childGroupEl(parentEl, item);
	parentEl.insertBefore(childrenEl, row.nextSibling);
	renderForest(ctx, childrenEl, item.children);
}

/** Drop a removed subtree from the row index so stale elements can't be found. */
function forgetSubtree(rows: Map<string, HTMLElement>, items: BacklogItem[]): void {
	for (const item of items) {
		rows.delete(item.file.path);
		forgetSubtree(rows, item.children);
	}
}

/** Render a sibling group, skipping hidden items so aria positions stay true. */
function renderForest(ctx: RowContext, containerEl: HTMLElement, siblings: BacklogItem[]): void {
	const visible = siblings.filter((item) => !ctx.host.isRowHidden(item));
	visible.forEach((item, i) => renderItem(ctx, containerEl, item, { pos: i + 1, count: visible.length }));
}

function renderItem(
	ctx: RowContext,
	containerEl: HTMLElement,
	item: BacklogItem,
	place: { pos: number; count: number },
): void {
	const host = ctx.host;
	// A row whose children are all hidden renders as a leaf: a chevron expanding
	// into an empty group would be a lie (its progress bar tells the story).
	const hasChildren = item.children.some((c) => !host.isRowHidden(c));
	const collapsed = host.isCollapsed(item.file.path);
	// Through `offerableTypes` like every other type list. `childTypeChoices` answers the
	// ladder's question and its answer carries `EXTRA_TYPES` — `Deliverable` among them —
	// so the raw list is the whole vocabulary minus the rungs, not what a projection may
	// show. The tree may show every type, so this narrows nothing today; what it stops is
	// the next surface reading the raw list because this one did.
	const childTypes = offerableTypes(host, childTypeChoices(item));

	const selected = host.selectedPath === item.file.path;
	const row = containerEl.createDiv({
		cls: 'pbl-row' + (selected ? ' pbl-selected' : ''),
		attr: {
			role: 'treeitem',
			'aria-level': String(item.depth + 1),
			'aria-posinset': String(place.pos),
			'aria-setsize': String(place.count),
			'aria-selected': String(selected),
		},
	});
	if (hasChildren) row.setAttribute('aria-expanded', String(!collapsed));
	// The row's OWN workflow, the same rule the card's child list, the card itself and the
	// timeline bar all keep: a Deliverable is finished when ITS states say so.
	if (ownWorkflowReading(item).done) row.addClass('pbl-done');
	if (item.outsideFilter) row.addClass('pbl-outside');
	row.setCssProps({ '--pbl-depth': String(item.depth) });
	row.dataset.path = item.file.path;
	// While filtering, visual neighbors are not real siblings — ranking by drag would
	// mislead; an ancestor from outside the filter has unknown siblings for the same reason.
	row.draggable = !host.isFiltering() && !item.outsideFilter;
	ctx.rows.set(item.file.path, row);

	renderRowLead(ctx, row, item, { hasChildren, collapsed });
	renderRowTrailing(ctx, row, item, childTypes);
	wireRowEvents(ctx, row, item, childTypes);
	ctx.dnd.wireRow(row, item);

	if (hasChildren && !collapsed) {
		renderForest(ctx, childGroupEl(containerEl, item), item.children);
	}
}

/** The child group of a row; its indent guide aligns under the parent's chevron column. */
function childGroupEl(containerEl: HTMLElement, item: BacklogItem): HTMLElement {
	const childrenEl = containerEl.createDiv({ cls: 'pbl-children', attr: { role: 'group' } });
	childrenEl.setCssProps({ '--pbl-depth': String(item.depth) });
	return childrenEl;
}

/** Grip, chevron, badge and title. */
function renderRowLead(
	ctx: RowContext,
	row: HTMLElement,
	item: BacklogItem,
	state: { hasChildren: boolean; collapsed: boolean },
): void {
	const host = ctx.host;
	// Purely a drag affordance — the row itself is the draggable element.
	const grip = row.createDiv({ cls: 'pbl-grip', attr: { 'aria-hidden': 'true' } });
	setIcon(grip, 'grip-vertical');

	// The tree refreshes the one subtree it changed; the dated axis's rows share this
	// control and re-render whole, which is why what to redraw is the caller's.
	renderChevron(host, row, item, state, () => host.refreshSubtree(item));

	renderBadge(host, row, item);

	const title = row.createSpan({ cls: 'pbl-title' });
	renderTitleText(host, title, item.title);
	title.addEventListener('mouseover', (evt) => {
		// Narrow panes truncate titles; surface the full text without a click.
		if (title.scrollWidth > title.clientWidth) setTooltip(title, item.title);
		host.app.workspace.trigger('hover-link', {
			event: evt,
			source: PRODUCT_BACKLOG_VIEW_TYPE,
			hoverParent: host.app.renderContext,
			targetEl: title,
			linktext: item.file.path,
			sourcePath: item.file.path,
		});
	});

	if (item.orphan) {
		const orphan = row.createSpan({ cls: 'pbl-orphan' });
		setIcon(orphan, 'unlink');
		setTooltip(orphan, 'Parent is set but not part of this view');
	}

	if (item.outsideFilter) {
		const marker = row.createSpan({ cls: 'pbl-outside-marker' });
		setIcon(marker, 'corner-left-down');
		setTooltip(marker, "Not in this base's filter — shown to keep the hierarchy");
	}
}

/**
 * The disclosure a row draws — shared with the dated axis's rows, so there is one
 * statement of what a chevron IS: an icon that rotates, a click that flips the collapse
 * bit of whichever projection is asking (`collapseKey` in `backlogView.ts` decides which,
 * so nothing here does), and, where there is nothing below, the leaf placeholder that keeps
 * every badge on the same x rather than an absence that shifts the row.
 *
 * Two things are the caller's, and they are the only two the surfaces do not share:
 *
 * - what the flip REDRAWS — the tree refreshes the subtree it changed, while the grid's
 *   window, gridlines and full-height marks are all derived from its row set and have to
 *   be rebuilt with it;
 * - **who says the row is expanded**, which is decided by the ROW's role and not by
 *   preference. A `treeitem` carries `aria-expanded` itself, so the tree passes no
 *   `label` and this draws a plain div — decoration of a state the row already announces.
 *   A card projection's row is `role="option"`, which does NOT support `aria-expanded`
 *   (ARIA 1.2), so a state put there is discarded: passing a `label` makes the chevron a
 *   real `<button>` carrying the state and that name, the same answer
 *   `render/cardChildren.ts`'s toggle already gives on the same role.
 *
 *   **That is better, not settled**, and the claim is narrowed to what can be checked
 *   here: `option` also has PRESENTATIONAL CHILDREN, so a user agent may flatten this
 *   button and drop its role and state with it — a focusable node is generally read as
 *   surviving that rule, and nothing in this repository can run a screen reader to find
 *   out. What survives either way is the row's content-derived NAME, which this label
 *   joins and, being worded "Show children"/"Hide children", flips with the state; the
 *   ACTION's guaranteed path is the row menu's identical entry. Do not write "the state
 *   is announced" here until a device has said so —
 *   `docs/issues/A disclosure nested in an option role.md` holds the two redesigns that
 *   would settle it.
 *
 * Everything else is one rule in one place — including the three guards, each of which
 * had to be discovered twice before: the filter override, because `isCollapsed` reports
 * false while a filter runs and a write here would look inert and then take effect once it
 * cleared; the real `disabled` flag that says so on a control assistive tech can actually
 * activate, since `pointer-events: none` stops a mouse and nothing else; and the middle
 * click, which never fires `click` and so never meets the first guard, leaving the row's
 * own `auxclick` to open a note from a control that means something else entirely.
 */
export function renderChevron(
	host: BacklogViewHost,
	rowEl: HTMLElement,
	item: BacklogItem,
	state: { hasChildren: boolean; collapsed: boolean; label?: string },
	redraw: (heldFocus: boolean) => void,
): void {
	const cls = 'pbl-chevron' + (state.hasChildren ? '' : ' pbl-leaf');
	// The leaf is a spacer and never a control, whichever form the disclosure takes.
	if (!state.hasChildren) {
		rowEl.createDiv({ cls });
		return;
	}
	const { label } = state;
	const chevron: HTMLElement =
		label === undefined
			? rowEl.createDiv({ cls })
			: disclosureButton(rowEl, cls, { expanded: !state.collapsed, label, disabled: host.isFiltering() });
	setIcon(chevron, 'chevron-right');
	chevron.toggleClass('pbl-expanded', !state.collapsed);
	chevron.addEventListener('click', () => {
		// Read here rather than trusted from `disabled`: a click landing on the icon
		// inside a disabled button still reaches this listener, and the div form has no
		// `disabled` to read at all.
		if (host.isFiltering()) return;
		// Whether this control HELD focus, captured before the redraw that may destroy it —
		// a caller rebuilding the whole projection has to put focus somewhere, and only
		// this side knows whether there was any to put. Asked of the element rather than
		// assumed from the input: a mouse click does not focus a button in every browser,
		// and focus already elsewhere must not be dragged away from it.
		const heldFocus = chevron.ownerDocument.activeElement === chevron;
		host.setCollapsed(item.file.path, !host.isCollapsed(item.file.path));
		redraw(heldFocus);
	});
}

/**
 * The button form of the disclosure: a real control, off the tab order like every other
 * per-row control, carrying the state its row's role cannot. `tabindex="-1"` keeps the
 * pane's single tab stop while leaving it activatable by assistive tech, with the row
 * menu as the documented keyboard path. `styles/tree.css` strips Obsidian's button
 * chrome from `button.pbl-chevron`.
 */
function disclosureButton(
	rowEl: HTMLElement,
	cls: string,
	said: { expanded: boolean; label: string; disabled: boolean },
): HTMLElement {
	const btn = rowEl.createEl('button', {
		cls,
		attr: { type: 'button', tabindex: '-1', 'aria-expanded': String(said.expanded), 'aria-label': said.label },
	});
	btn.disabled = said.disabled;
	return btn;
}

/** While filtering, the matching substring lights up so hits are scannable. */
export function renderTitleText(host: BacklogViewHost, titleEl: HTMLElement, text: string): void {
	const needle = host.filterText.trim().toLowerCase();
	const idx = needle.length > 0 ? text.toLowerCase().indexOf(needle) : -1;
	if (idx === -1) {
		titleEl.setText(text);
		return;
	}
	titleEl.appendText(text.substring(0, idx));
	titleEl.createSpan({ cls: 'pbl-match', text: text.substring(idx, idx + needle.length) });
	titleEl.appendText(text.substring(idx + needle.length));
}

/** Shared with the board's cards: one badge chain, so a type cannot look different per projection. */
export function renderBadge(host: BacklogViewHost, row: HTMLElement, item: BacklogItem): void {
	const badgeText = displayType(item);
	if (!badgeText) return;
	const badge = row.createSpan({ cls: 'pbl-badge' });
	// A declared extra type or marker is a first-class type, so it gets a badge like a
	// level's: its own icon and colour, decided here in one place rather than by two
	// chains that have to agree. Anything outside the declared vocabulary keeps its name
	// and takes the bare-text treatment, which is the honest look for a type this view
	// knows nothing about — it is carried through the ladder, not styled as though it were
	// understood.
	// Asked of the name the badge SHOWS, never of `item.levelIndex`, which indexes
	// whichever ladder the item is on: a `Task` beneath a `Test case` is rung 2 there and
	// rung 3 of the plan's, so the index alone would draw it as a PBI in blue. The shown
	// name answers for both ladders without either being named here — which is also what
	// lets the two test types be ordinary entries in the table above rather than a third
	// branch, even though they ARE rungs.
	const style = badgeStyleFor(badgeText);
	if (style.icon) setIcon(badge.createSpan({ cls: 'pbl-badge-icon' }), style.icon);
	badge.addClass(style.badge);
	const textEl = badge.createSpan({ cls: 'pbl-badge-text', text: badgeText });
	const implied = item.impliedType
		? 'Type property not set — level implied from position. Use "Assign missing properties" to write it.'
		: '';
	if (implied) {
		badge.addClass('pbl-implied');
		setTooltip(badge, implied);
	}
	// A long level name is capped so the row's lead stays bounded (columnFit budgets
	// for it); the full name is one hover away when that cap actually bites — and an
	// implied badge needs both, since the cap hides the very level it is explaining.
	badge.addEventListener('mouseover', () => {
		if (textEl.scrollWidth <= textEl.clientWidth) return;
		setTooltip(badge, implied ? `${badgeText} · ${implied}` : badgeText);
	});
}

/** The fixed trailing columns, then the row's own add button. */
function renderRowTrailing(ctx: RowContext, row: HTMLElement, item: BacklogItem, childTypes: string[]): void {
	renderRowColumns(ctx, row, item);

	// A row that can hold nothing gets no button, rather than one labelled from the first
	// of no choices — `New undefined`, opening a modal with no type to pick. The context
	// menu's `New <child>` disappears with it, by having nothing to loop over. The button's
	// WIDTH still has to be reserved: the columns are anchored to the row's end, so leaving
	// it out shifts every one of them right on this row alone.
	if (childTypes.length === 0) {
		renderAddSpacer(row);
		return;
	}

	// A native button so assistive tech can activate it, with no Tab stop — the same
	// bargain the state chip makes: the tree keeps its single-tab-stop model, and the
	// context menu carries the documented keyboard path (New <child>).
	const addBtn = row.createEl('button', {
		cls: 'pbl-add clickable-icon',
		attr: { type: 'button', tabindex: '-1', 'aria-label': addLabel(childTypes) },
	});
	setIcon(addBtn, 'plus');
	setTooltip(addBtn, addLabel(childTypes));
	addBtn.addEventListener('click', () => promptCreateItem(ctx.host, childTypes, item));
}

/** A row that can hold only one type says so; one with a choice cannot promise which. */
function addLabel(childTypes: string[]): string {
	return childTypes.length > 1 ? 'New child item' : `New ${childTypes[0]}`;
}

/**
 * What counts as a CONTROL inside a row, for the one question every row-activation
 * handler asks before doing anything: did this event begin on the row, or on something
 * the row merely contains?
 *
 * `button` is the whole rule and the rest are its documented exceptions, which is what
 * keeps this from being a list of the places somebody thought of. The view guide already
 * requires every activatable per-row control to be a real `<button>` ("a `div` with an
 * `aria-label` and a click handler is the thing to avoid"), so a control written
 * tomorrow is covered without editing this line. What is named beside it is the three
 * kinds that are deliberately not buttons:
 *
 * - `.pbl-chevron` in its DIV form. A `treeitem` carries `aria-expanded` itself, so the
 *   tree's disclosure needs no button; the card's is one and matches above.
 * - `.pbl-bar-grip`, a drag handle with no activation semantics at all. Only the EDGE
 *   grips carry the class — the body hold is the bar element, which must stay part of
 *   the row's click target.
 * - `.pbl-prop-value` and `.pbl-tag`, a property cell's rendered note links and tag
 *   pills. The empty space AROUND them stays the row's, which is why this is asked of
 *   the event's target rather than of the cell.
 */
const ROW_CONTROL = 'button, .pbl-chevron, .pbl-bar-grip, .pbl-prop-value, .pbl-tag';

/**
 * Whether an activation event began on a control inside the row rather than on the row.
 *
 * One filter, asked by BOTH row-activation handlers (`wireRowEvents` here for the tree,
 * `wireCardActivation` in `board.ts` for cards and timeline rows), replacing a
 * `stopPropagation` per control. Ten of those had accumulated and each new control had
 * to remember to add an eleventh — which the connector and the bar grips both failed to
 * do, shipping a handle that opened the note. A control that forgets this filter is
 * covered by it anyway; that is the whole point of moving the question to the receiver.
 *
 * A middle click never fires `click`, so `auxclick` has to ask separately — the reason
 * every one of those per-control guards came in pairs.
 */
export function fromRowControl(evt: Event): boolean {
	return evt.target instanceof Element && evt.target.closest(ROW_CONTROL) !== null;
}

/**
 * "Clicking an item" set to fold: the row's body means what its chevron means, and the
 * note is reached from the menu, from `Enter`, or with the platform's modifier — which
 * is why a modified click is not this option's to take and falls through to opening.
 *
 * Returns true whenever the click was SPENT here, which includes the two cases that
 * fold nothing: a row with nothing under it has no fold to do, and a filtered tree
 * refuses the flip exactly as the chevron does (`isCollapsed` reports false while a
 * filter runs, so the write would look inert and then take effect once it cleared).
 * Falling through to `openItem` in either case would make the same gesture open a note
 * in one row and fold in the next.
 */
function foldOnClick(ctx: RowContext, item: BacklogItem, evt: MouseEvent): boolean {
	const host = ctx.host;
	if (host.settings.clickAction !== 'fold' || Keymap.isModEvent(evt)) return false;
	if (host.isFiltering() || !item.children.some((child) => !host.isRowHidden(child))) return true;
	host.setCollapsed(item.file.path, !host.isCollapsed(item.file.path));
	host.refreshSubtree(item);
	return true;
}

function wireRowEvents(ctx: RowContext, row: HTMLElement, item: BacklogItem, childTypes: string[]): void {
	row.addEventListener('click', (evt) => {
		// Before selection AND before the fold: a control inside the row is not the row,
		// whichever of the two things "clicking an item" is configured to mean. Folding on
		// a chevron click would fold twice; folding on an add-button click would fold on
		// the way to a modal.
		if (fromRowControl(evt)) return;
		ctx.host.selectItem(item, false);
		if (foldOnClick(ctx, item, evt)) return;
		ctx.host.openItem(item, evt);
	});
	row.addEventListener('auxclick', (evt) => {
		if (evt.button === 1 && !fromRowControl(evt)) ctx.host.openItemIn(item, 'tab');
	});
	row.addEventListener('contextmenu', (evt) => showItemMenu(ctx.host, evt, item, childTypes));
}
