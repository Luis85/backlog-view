import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel } from '../model';
import { indent, moveWithinSiblings, outdent } from './structure';

/** Items currently rendered, top to bottom, honoring collapsed subtrees and the filter. */
function visibleItems(host: BacklogViewHost, model: BacklogModel): BacklogItem[] {
	const visible: BacklogItem[] = [];
	const walk = (items: BacklogItem[]) => {
		for (const item of items) {
			if (host.isFilteredOut(item)) continue;
			visible.push(item);
			if (item.children.length > 0 && !host.isCollapsed(item.file.path)) {
				walk(item.children);
			}
		}
	};
	walk(model.roots);
	return visible;
}

/**
 * Tree keyboard support: arrows navigate, Enter opens, and Alt+arrows mirror
 * the Azure DevOps backlog shortcuts (move within siblings, outdent, indent).
 */
export function handleTreeKeydown(host: BacklogViewHost, evt: KeyboardEvent): void {
	const model = host.model;
	if (!model || model.items.length === 0) return;
	if (handleFilterKey(host, evt)) return;
	const visible = visibleItems(host, model);
	if (visible.length === 0) return;

	// Resolve the selection from the visible list: an item hidden by a collapsed
	// ancestor or a focus-level change must not be opened or moved invisibly.
	const current = host.selectedPath
		? visible.find((item) => item.file.path === host.selectedPath) ?? null
		: null;
	if (evt.altKey) {
		if (current) handleStructureKey(host, current, evt);
		return;
	}
	handleNavigationKey(host, visible, current, evt);
}

/** `/` jumps to the filter box; Escape backs out of the filter, then the selection. */
function handleFilterKey(host: BacklogViewHost, evt: KeyboardEvent): boolean {
	if (evt.key === '/' && !evt.altKey && !evt.ctrlKey && !evt.metaKey) {
		evt.preventDefault();
		host.focusFilter();
		return true;
	}
	if (evt.key !== 'Escape') return false;
	if (host.filterText !== '') {
		evt.preventDefault();
		host.setFilter('');
	} else if (host.selectedPath !== null) {
		evt.preventDefault();
		host.clearSelection();
	}
	return true;
}

function handleStructureKey(host: BacklogViewHost, current: BacklogItem, evt: KeyboardEvent): void {
	switch (evt.key) {
		case 'ArrowUp':
			evt.preventDefault();
			moveWithinSiblings(host, current, -1);
			break;
		case 'ArrowDown':
			evt.preventDefault();
			moveWithinSiblings(host, current, 1);
			break;
		case 'ArrowLeft':
			evt.preventDefault();
			outdent(host, current);
			break;
		case 'ArrowRight':
			evt.preventDefault();
			indent(host, current);
			break;
	}
}

/** Arrow up/down and Home/End selection movement; true when the key was one of those. */
function handleSelectionKey(
	host: BacklogViewHost,
	visible: BacklogItem[],
	currentIdx: number,
	evt: KeyboardEvent,
): boolean {
	switch (evt.key) {
		case 'ArrowDown':
			host.selectItem(currentIdx === -1 ? visible[0] : visible[Math.min(currentIdx + 1, visible.length - 1)]);
			return true;
		case 'ArrowUp':
			host.selectItem(currentIdx === -1 ? visible[visible.length - 1] : visible[Math.max(currentIdx - 1, 0)]);
			return true;
		case 'Home':
			host.selectItem(visible[0]);
			return true;
		case 'End':
			host.selectItem(visible[visible.length - 1]);
			return true;
	}
	return false;
}

function handleNavigationKey(
	host: BacklogViewHost,
	visible: BacklogItem[],
	current: BacklogItem | null,
	evt: KeyboardEvent,
): void {
	const currentIdx = current ? visible.indexOf(current) : -1;
	if (handleSelectionKey(host, visible, currentIdx, evt)) {
		evt.preventDefault();
		return;
	}
	switch (evt.key) {
		case 'ArrowLeft':
		case 'ArrowRight':
			if (current) handleExpandCollapseKey(host, current, evt);
			break;
		case 'Enter':
			if (!current) break;
			evt.preventDefault();
			host.openItem(current, evt);
			break;
		case 'ContextMenu':
		case 'F10':
			if (!current || (evt.key === 'F10' && !evt.shiftKey)) break;
			evt.preventDefault();
			host.showContextMenuFor(current);
			break;
	}
}

/** Left collapses or jumps to the parent; right expands or jumps to the first child. */
function handleExpandCollapseKey(host: BacklogViewHost, current: BacklogItem, evt: KeyboardEvent): void {
	evt.preventDefault();
	const hasChildren = current.children.length > 0;
	const collapsed = host.isCollapsed(current.file.path);
	// While filtering, collapse state is overridden and mutating it would be
	// invisible — navigation still works, state changes wait for a clear filter.
	const filtering = host.isFiltering();

	if (evt.key === 'ArrowLeft') {
		if (!filtering && hasChildren && !collapsed) collapseKeepingSelection(host, current, true);
		else if (current.parent && !current.focusRoot) host.selectItem(current.parent);
	} else if (!filtering && hasChildren && collapsed) {
		collapseKeepingSelection(host, current, false);
	} else if (hasChildren) {
		// Under a filter the first child may be hidden; jump to the first rendered one.
		const firstVisible = current.children.find((child) => !host.isFilteredOut(child));
		if (firstVisible) host.selectItem(firstVisible);
	}
}

function collapseKeepingSelection(host: BacklogViewHost, item: BacklogItem, collapsed: boolean): void {
	host.setCollapsed(item.file.path, collapsed);
	host.persistCollapsedState();
	host.render();
	host.selectItem(item);
}
