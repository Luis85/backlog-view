import { BasesPropertyId, NullValue, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from '../host';
import { newItemLevel, promptCreateItem } from '../interactions/create';
import { DragDropController } from '../interactions/dragDrop';
import { showItemMenu } from '../interactions/menu';
import { BacklogItem, childLevelIndex, displayType } from '../model';

const BADGE_COLOR_COUNT = 8;
/** Work-item icons by level position, echoing the Azure DevOps set (crown, trophy, book, check). */
const LEVEL_ICONS = ['crown', 'award', 'book-open', 'check-square'];

/** Render the tree content (or the empty state) into the tree element. */
export function renderTree(host: BacklogViewHost, dnd: DragDropController, treeEl: HTMLElement): void {
	const model = host.model;
	if (!model) return;
	if (model.items.length === 0) {
		renderEmptyState(host, treeEl);
		return;
	}
	for (const root of model.roots) renderItem(host, dnd, treeEl, root);
	if (host.filterText !== '' && treeEl.childElementCount === 0) {
		treeEl.createDiv({ cls: 'pbl-empty-filter', text: 'No items match the filter.' });
	}
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
	empty.createDiv({
		cls: 'pbl-empty-hint',
		text: focused
			? `Nothing at the "${topLevel}" level matches this view. Switch the focus level back to "All levels" in the view options, or create a ${topLevel}.`
			: `Point this base's filter at your backlog folder, then create your first ${topLevel}. New items automatically get the parent, order and type properties this view needs.`,
	});
	const btn = empty.createEl('button', { cls: 'mod-cta' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	btn.createSpan({ text: `New ${topLevel}` });
	btn.addEventListener('click', () => promptCreateItem(host, topLevel, null));
}

function renderItem(host: BacklogViewHost, dnd: DragDropController, containerEl: HTMLElement, item: BacklogItem): void {
	if (host.isFilteredOut(item)) return;
	const hasChildren = item.children.length > 0;
	const collapsed = host.isCollapsed(item.file.path);
	const childLevel = host.settings.levels[childLevelIndex(item, host.settings.levels)];

	const selected = host.selectedPath === item.file.path;
	const row = containerEl.createDiv({
		cls: 'pbl-row' + (selected ? ' pbl-selected' : ''),
		attr: {
			role: 'treeitem',
			'aria-level': String(item.depth + 1),
			'aria-selected': String(selected),
		},
	});
	if (hasChildren) row.setAttribute('aria-expanded', String(!collapsed));
	if (item.done) row.addClass('pbl-done');
	row.setCssProps({ '--pbl-depth': String(item.depth) });
	row.dataset.path = item.file.path;
	// While filtering, visual neighbors are not real siblings — ranking by drag would mislead.
	row.draggable = host.filterText === '';

	renderRowLead(host, row, item, { hasChildren, collapsed });
	renderRowTrailing(host, row, item, childLevel);
	wireRowEvents(host, row, item, childLevel);
	dnd.wireRow(row, item, hasChildren, collapsed);

	if (hasChildren && !collapsed) {
		const childrenEl = containerEl.createDiv({ cls: 'pbl-children', attr: { role: 'group' } });
		// The indent guide of this group aligns under the parent's chevron column.
		childrenEl.setCssProps({ '--pbl-depth': String(item.depth) });
		for (const child of item.children) renderItem(host, dnd, childrenEl, child);
	}
}

/** Grip, chevron, badge and title. */
function renderRowLead(
	host: BacklogViewHost,
	row: HTMLElement,
	item: BacklogItem,
	state: { hasChildren: boolean; collapsed: boolean },
): void {
	const grip = row.createDiv({ cls: 'pbl-grip' });
	setIcon(grip, 'grip-vertical');

	const chevron = row.createDiv({ cls: 'pbl-chevron' + (state.hasChildren ? '' : ' pbl-leaf') });
	if (state.hasChildren) {
		setIcon(chevron, 'chevron-right');
		chevron.toggleClass('pbl-expanded', !state.collapsed);
		chevron.addEventListener('click', (evt) => {
			evt.stopPropagation();
			host.setCollapsed(item.file.path, !host.isCollapsed(item.file.path));
			host.persistCollapsedState();
			host.render();
		});
	}

	renderBadge(host, row, item);

	const title = row.createSpan({ cls: 'pbl-title', text: item.title });
	title.addEventListener('mouseover', (evt) => {
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

/** Chips, progress or count, and the add-child button. */
function renderRowTrailing(host: BacklogViewHost, row: HTMLElement, item: BacklogItem, childLevel: string): void {
	const chips = row.createDiv({ cls: 'pbl-chips' });
	if (host.settings.showChips) renderChips(host, chips, item);
	chips.addEventListener('click', (evt) => evt.stopPropagation());

	if (host.settings.stateKey && item.descendantCount > 0) {
		const progress = row.createDiv({ cls: 'pbl-progress' });
		const ratio = item.doneDescendants / item.descendantCount;
		const bar = progress.createDiv({ cls: 'pbl-progress-bar' });
		bar.createDiv({ cls: 'pbl-progress-fill' }).setCssProps({
			'--pbl-progress': `${Math.round(ratio * 100)}%`,
		});
		progress.createSpan({
			cls: 'pbl-progress-label',
			text: `${item.doneDescendants}/${item.descendantCount}`,
		});
		setTooltip(progress, `${item.doneDescendants} of ${item.descendantCount} items done`);
	} else if (host.settings.showCounts && item.descendantCount > 0) {
		row.createSpan({ cls: 'pbl-count', text: String(item.descendantCount) });
	}

	const addBtn = row.createDiv({ cls: 'pbl-add clickable-icon', attr: { 'aria-label': `New ${childLevel}` } });
	setIcon(addBtn, 'plus');
	setTooltip(addBtn, `New ${childLevel}`);
	addBtn.addEventListener('click', (evt) => {
		evt.stopPropagation();
		promptCreateItem(host, childLevel, item);
	});
}

function wireRowEvents(host: BacklogViewHost, row: HTMLElement, item: BacklogItem, childLevel: string): void {
	row.addEventListener('click', (evt) => {
		host.selectItem(item, false);
		host.openItem(item, evt);
	});
	row.addEventListener('auxclick', (evt) => {
		if (evt.button === 1) host.openItemInNewTab(item);
	});
	row.addEventListener('contextmenu', (evt) => showItemMenu(host, evt, item, childLevel));
}

function renderChips(host: BacklogViewHost, containerEl: HTMLElement, item: BacklogItem): void {
	let props: BasesPropertyId[] = [];
	try {
		props = host.config.getOrder();
	} catch {
		return;
	}
	const skip = new Set<string>([
		'file.name',
		`note.${host.settings.parentKey}`,
		`note.${host.settings.orderKey}`,
		`note.${host.settings.typeKey}`,
	]);
	for (const prop of props) {
		if (!skip.has(prop)) renderChip(host, containerEl, item, prop);
	}
}

function renderChip(host: BacklogViewHost, containerEl: HTMLElement, item: BacklogItem, prop: BasesPropertyId): void {
	let value = null;
	try {
		value = item.entry.getValue(prop);
	} catch {
		return;
	}
	if (value === null || value instanceof NullValue) return;
	// isEmpty() is not yet part of the published typings; prefer it when present.
	const maybeEmpty = value as { isEmpty?: () => boolean };
	if (typeof maybeEmpty.isEmpty === 'function' && maybeEmpty.isEmpty()) return;

	const text = value.toString();
	const chip = containerEl.createDiv({ cls: 'pbl-chip' });
	let label = prop.substring(prop.indexOf('.') + 1);
	try {
		label = host.config.getDisplayName(prop);
	} catch {
		// keep the raw property name
	}
	chip.createSpan({ cls: 'pbl-chip-label', text: label });
	const valueEl = chip.createSpan({ cls: 'pbl-chip-value' });
	try {
		value.renderTo(valueEl, host.app.renderContext);
	} catch {
		valueEl.setText(text);
	}
	if (valueEl.textContent?.trim() === '' && text.trim() === '') chip.detach();
}
