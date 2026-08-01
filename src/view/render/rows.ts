import { setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from '../host';
import { promptCreateItem } from '../interactions/create';
import { showItemMenu } from '../interactions/menu';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { BacklogItem } from '../../domain/model';
import { childTypeChoices, displayType } from '../../domain/itemTypes';
import { byTypeName } from '../../domain/settings';
import {
	INDENT_PER_DEPTH,
	META_COL_WIDTH,
	renderColumnHeader,
	renderRowColumns,
	RowContext,
	STATE_COL_WIDTH,
} from './columns';

/** Work-item icons by level position, echoing the Azure DevOps set (crown, trophy, book, check). */
const LEVEL_ICONS = ['crown', 'award', 'book-open', 'check-square'];
/**
 * Icon and badge colour per extra type, keyed lowercase. The vocabulary is fixed, so this
 * covers ALL of it — there is no fallback for a declared type, because there is no declared
 * type this file has not been told about. A test renders one of each and asserts every
 * badge got an icon and a colour the stylesheet defines, which is what makes that safe to
 * rely on rather than something to remember.
 */
const EXTRA_TYPE_STYLE: Record<string, { icon: string; badge: string }> = {
	issue: { icon: 'circle-alert', badge: 'pbl-lvl-issue' },
	bug: { icon: 'bug', badge: 'pbl-lvl-bug' },
};

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
		'--pbl-prop-count': String(ctx.chips.length),
		'--pbl-state-col': `${STATE_COL_WIDTH}px`,
		'--pbl-meta-col': `${META_COL_WIDTH}px`,
		'--pbl-indent': `${INDENT_PER_DEPTH}px`,
	});
	if (model.items.length === 0) {
		renderEmptyState(ctx.host, treeEl);
		return;
	}
	// Whether any row will render is knowable before rendering one: renderForest draws
	// a row per root isRowHidden lets through. Asking first keeps the header — which is
	// not a row — from having to be built and then thrown away again.
	if (!model.roots.some((root) => !ctx.host.isRowHidden(root))) {
		if (ctx.host.isFiltering()) renderFilterEmptyState(ctx.host, treeEl);
		else renderAllDoneState(ctx.host, treeEl, model.results.length);
		return;
	}
	renderColumnHeader(ctx, treeEl);
	renderForest(ctx, treeEl, model.roots);
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
	const childTypes = childTypeChoices(item);

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
	// A declared extra type is a first-class type, so it gets a badge like a level's: its
	// own icon and colour, decided here in one place rather than by two chains that have
	// to agree. Anything outside the six keeps its name and takes the bare-text treatment,
	// which is the honest look for a type this view knows nothing about — it is carried
	// through the ladder, not styled as though it were understood.
	const style = byTypeName(EXTRA_TYPE_STYLE, item.typeName);
	if (item.levelIndex >= 0) {
		setIcon(badge.createSpan({ cls: 'pbl-badge-icon' }), LEVEL_ICONS[item.levelIndex]);
		badge.addClass(`pbl-lvl-${item.levelIndex}`);
	} else if (style) {
		setIcon(badge.createSpan({ cls: 'pbl-badge-icon' }), style.icon);
		badge.addClass(style.badge);
	} else {
		badge.addClass('pbl-lvl-unknown');
	}
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

	// A native button so assistive tech can activate it, with no Tab stop — the same
	// bargain the state chip makes: the tree keeps its single-tab-stop model, and the
	// context menu carries the documented keyboard path (New <child>).
	const addBtn = row.createEl('button', {
		cls: 'pbl-add clickable-icon',
		attr: { type: 'button', tabindex: '-1', 'aria-label': addLabel(childTypes) },
	});
	setIcon(addBtn, 'plus');
	setTooltip(addBtn, addLabel(childTypes));
	addBtn.addEventListener('click', (evt) => {
		evt.stopPropagation();
		promptCreateItem(ctx.host, childTypes, item);
	});
}

/** A row that can hold only one type says so; one with a choice cannot promise which. */
function addLabel(childTypes: string[]): string {
	return childTypes.length > 1 ? 'New child item' : `New ${childTypes[0]}`;
}

function wireRowEvents(ctx: RowContext, row: HTMLElement, item: BacklogItem, childTypes: string[]): void {
	row.addEventListener('click', (evt) => {
		ctx.host.selectItem(item, false);
		ctx.host.openItem(item, evt);
	});
	row.addEventListener('auxclick', (evt) => {
		if (evt.button === 1) ctx.host.openItemInNewTab(item);
	});
	row.addEventListener('contextmenu', (evt) => showItemMenu(ctx.host, evt, item, childTypes));
}
