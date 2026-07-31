import { BasesPropertyId, NullValue, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from '../host';
import { newItemLevel, promptCreateItem } from '../interactions/create';
import { DragDropController } from '../interactions/dragDrop';
import { showItemMenu, showStateMenu } from '../interactions/menu';
import { BacklogItem, childLevelIndex, displayType } from '../model';

const BADGE_COLOR_COUNT = 8;
/** Work-item icons by level position, echoing the Azure DevOps set (crown, trophy, book, check). */
const LEVEL_ICONS = ['crown', 'award', 'book-open', 'check-square'];

/** A visible property and its display name, resolved once instead of per row. */
export interface ChipProp {
	prop: BasesPropertyId;
	label: string;
}

/**
 * State shared by one render pass. Config lookups and the row index live here so
 * per-row work stays proportional to the rows themselves — repeating a handful of
 * Bases config calls on every row is what makes a few hundred items feel slow.
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

/** Render the tree content (or the empty state) into the tree element. */
export function renderTree(ctx: RowContext, treeEl: HTMLElement): void {
	const model = ctx.host.model;
	if (!model) return;
	if (model.items.length === 0) {
		renderEmptyState(ctx.host, treeEl);
		return;
	}
	renderForest(ctx, treeEl, model.roots);
	if (treeEl.childElementCount === 0) {
		if (ctx.host.isFiltering()) renderFilterEmptyState(ctx.host, treeEl);
		else renderAllDoneState(ctx.host, treeEl, model.items.length);
	}
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

function renderFilterEmptyState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = treeEl.createDiv({ cls: 'pbl-empty-filter' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-filter-icon' }), 'search-x');
	empty.createDiv({ text: `No items match "${host.filterText.trim()}".` });
	const btn = empty.createEl('button', { text: 'Clear filter' });
	btn.addEventListener('click', () => {
		host.setFilter('');
		host.focusFilter();
	});
}

/** Everything is done and hidden — celebrate, and offer the way back. */
function renderAllDoneState(host: BacklogViewHost, treeEl: HTMLElement, total: number): void {
	const empty = treeEl.createDiv({ cls: 'pbl-empty-filter' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-filter-icon' }), 'circle-check');
	empty.createDiv({ text: `All ${total} item${total === 1 ? ' is' : 's are'} done and hidden.` });
	const btn = empty.createEl('button', { text: 'Show completed items' });
	btn.addEventListener('click', () => host.config.set('showCompleted', true));
}

function renderEmptyState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const model = host.model;
	const focused = model?.focused ?? false;
	const topLevel = focused && model ? newItemLevel(host.settings, model) : host.settings.levels[0];
	const empty = treeEl.createDiv({ cls: 'pbl-empty' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-icon' }), 'list-tree');
	empty.createDiv({
		cls: 'pbl-empty-title',
		text: focused ? `No ${topLevel} items` : 'No backlog items',
	});
	empty.createDiv({ cls: 'pbl-empty-hint', text: emptyHint(host, focused, topLevel) });
	const btn = empty.createEl('button', { cls: 'mod-cta' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	btn.createSpan({ text: `New ${topLevel}` });
	btn.addEventListener('click', () => promptCreateItem(host, topLevel, null));
}

/**
 * The empty state has to tell the truth about *why* it is empty: a base full of
 * plain notes is a different problem than a base with nothing in it.
 */
function emptyHint(host: BacklogViewHost, focused: boolean, topLevel: string): string {
	if (focused) {
		return `Nothing at the "${topLevel}" level matches this view. Switch the focus level back to "All levels" in the view options, or create a ${topLevel}.`;
	}
	const ignored = host.model?.ignoredCount ?? 0;
	if (ignored > 0) {
		return `${ignored} note${ignored === 1 ? '' : 's'} in this base ${ignored === 1 ? 'has' : 'have'} no supported type and no parent, so ${ignored === 1 ? 'it is' : 'they are'} not treated as backlog items. Create your first ${topLevel}, or turn off "Ignore notes outside the hierarchy" in the view options to organize the existing notes.`;
	}
	return `Point this base's filter at your backlog folder, then create your first ${topLevel}. New items automatically get the parent, order and type properties this view needs.`;
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
	const childLevel = host.settings.levels[childLevelIndex(item, host.settings.levels)];

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
	if (item.done) row.addClass('pbl-done');
	if (item.outsideFilter) row.addClass('pbl-outside');
	row.setCssProps({ '--pbl-depth': String(item.depth) });
	row.dataset.path = item.file.path;
	// While filtering, visual neighbors are not real siblings — ranking by drag would
	// mislead; an ancestor from outside the filter has unknown siblings for the same reason.
	row.draggable = !host.isFiltering() && !item.outsideFilter;
	ctx.rows.set(item.file.path, row);

	renderRowLead(ctx, row, item, { hasChildren, collapsed });
	renderRowTrailing(ctx, row, item, childLevel);
	wireRowEvents(ctx, row, item, childLevel);
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

	const chevron = row.createDiv({ cls: 'pbl-chevron' + (state.hasChildren ? '' : ' pbl-leaf') });
	if (state.hasChildren) {
		setIcon(chevron, 'chevron-right');
		chevron.toggleClass('pbl-expanded', !state.collapsed);
		chevron.addEventListener('click', (evt) => {
			evt.stopPropagation();
			// Collapse state is overridden while filtering; mutating it here
			// would change nothing visibly until the filter clears.
			if (host.isFiltering()) return;
			host.setCollapsed(item.file.path, !host.isCollapsed(item.file.path));
			host.persistCollapsedState();
			host.refreshSubtree(item);
		});
	}

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

/** While filtering, the matching substring lights up so hits are scannable. */
function renderTitleText(host: BacklogViewHost, titleEl: HTMLElement, text: string): void {
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

function renderBadge(host: BacklogViewHost, row: HTMLElement, item: BacklogItem): void {
	const badgeText = displayType(item, host.settings);
	if (!badgeText) return;
	const badge = row.createSpan({ cls: 'pbl-badge' });
	if (item.levelIndex >= 0 && item.levelIndex < LEVEL_ICONS.length) {
		setIcon(badge.createSpan({ cls: 'pbl-badge-icon' }), LEVEL_ICONS[item.levelIndex]);
	}
	badge.createSpan({ text: badgeText });
	if (item.levelIndex >= 0) badge.addClass(`pbl-lvl-${item.levelIndex % BADGE_COLOR_COUNT}`);
	else badge.addClass('pbl-lvl-unknown');
	if (item.impliedType) {
		badge.addClass('pbl-implied');
		setTooltip(badge, 'Type property not set — level implied from position. Use "Assign missing properties" to write it.');
	}
}

/**
 * Chips, then the fixed trailing columns. State and rollup sit in columns of their
 * own so they line up across rows: anchored to the row's end, they stay readable as
 * a column no matter how long the title is or how deep the item sits.
 */
function renderRowTrailing(ctx: RowContext, row: HTMLElement, item: BacklogItem, childLevel: string): void {
	const chips = row.createDiv({ cls: 'pbl-chips' });
	if (ctx.chips.length > 0) renderChips(ctx, chips, item);
	// Chips may render note links that must not also open the row's own note; the
	// empty space around them stays part of the row's click target.
	chips.addEventListener('click', (evt) => {
		if (evt.target instanceof Element && evt.target.closest('.pbl-chip')) evt.stopPropagation();
	});

	if (ctx.host.settings.stateKey) renderStateChip(ctx.host, row.createDiv({ cls: 'pbl-state-col' }), item);
	renderRollup(ctx.host, row, item);

	const addBtn = row.createDiv({ cls: 'pbl-add clickable-icon', attr: { 'aria-label': `New ${childLevel}` } });
	setIcon(addBtn, 'plus');
	setTooltip(addBtn, `New ${childLevel}`);
	addBtn.addEventListener('click', (evt) => {
		evt.stopPropagation();
		promptCreateItem(ctx.host, childLevel, item);
	});
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
	// A native button, so assistive tech can activate it — but no Tab stop: the
	// tree keeps its single-tab-stop model, and the context menu carries the
	// documented keyboard path (Set state).
	const chip = col.createEl('button', {
		cls: 'pbl-state-chip' + (item.done ? ' pbl-state-done' : '') + (value === null ? ' pbl-state-unset' : ''),
		attr: {
			type: 'button',
			tabindex: '-1',
			'aria-label': value === null ? 'Set state' : `Change state (currently ${value})`,
		},
	});
	const icon = item.done ? 'circle-check' : value !== null ? 'circle' : 'circle-dashed';
	setIcon(chip.createSpan({ cls: 'pbl-state-icon' }), icon);
	chip.createSpan({ cls: 'pbl-state-text', text: value ?? 'State' });
	setTooltip(chip, 'Change state');
	chip.addEventListener('click', (evt) => showStateMenu(host, evt, item));
}

function wireRowEvents(ctx: RowContext, row: HTMLElement, item: BacklogItem, childLevel: string): void {
	row.addEventListener('click', (evt) => {
		ctx.host.selectItem(item, false);
		ctx.host.openItem(item, evt);
	});
	row.addEventListener('auxclick', (evt) => {
		if (evt.button === 1) ctx.host.openItemInNewTab(item);
	});
	row.addEventListener('contextmenu', (evt) => showItemMenu(ctx.host, evt, item, childLevel));
}

/** The visible properties to render as chips, with their labels — one lookup per render. */
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
	return props.filter((prop) => !skip.has(prop)).map((prop) => ({ prop, label: chipLabel(host, prop) }));
}

function chipLabel(host: BacklogViewHost, prop: BasesPropertyId): string {
	try {
		return host.config.getDisplayName(prop);
	} catch {
		return prop.substring(prop.indexOf('.') + 1);
	}
}

function renderChips(ctx: RowContext, containerEl: HTMLElement, item: BacklogItem): void {
	// An ancestor from outside the filter has no Bases row, so no property values.
	if (!item.entry) return;
	for (const chip of ctx.chips) renderChip(ctx.host, containerEl, item, chip);
}

function renderChip(host: BacklogViewHost, containerEl: HTMLElement, item: BacklogItem, prop: ChipProp): void {
	let value = null;
	try {
		value = item.entry?.getValue(prop.prop) ?? null;
	} catch {
		return;
	}
	if (value === null || value instanceof NullValue) return;
	// isEmpty() is not yet part of the published typings; prefer it when present.
	const maybeEmpty = value as { isEmpty?: () => boolean };
	if (typeof maybeEmpty.isEmpty === 'function' && maybeEmpty.isEmpty()) return;

	const text = value.toString();
	const chip = containerEl.createDiv({ cls: 'pbl-chip' });
	chip.createSpan({ cls: 'pbl-chip-label', text: prop.label });
	const valueEl = chip.createSpan({ cls: 'pbl-chip-value' });
	try {
		value.renderTo(valueEl, host.app.renderContext);
	} catch {
		valueEl.setText(text);
	}
	if (valueEl.textContent?.trim() === '' && text.trim() === '') chip.detach();
}
