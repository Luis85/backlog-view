import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel } from '../model';
import { indent, moveWithinSiblings, outdent } from './structure';

/** Items currently rendered, top to bottom, honoring collapsed subtrees. */
function visibleItems(model: BacklogModel, isCollapsed: (path: string) => boolean): BacklogItem[] {
	const visible: BacklogItem[] = [];
	const walk = (items: BacklogItem[]) => {
		for (const item of items) {
			visible.push(item);
			if (item.children.length > 0 && !isCollapsed(item.file.path)) {
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
	const visible = visibleItems(model, (path) => host.isCollapsed(path));
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

function handleNavigationKey(
	host: BacklogViewHost,
	visible: BacklogItem[],
	current: BacklogItem | null,
	evt: KeyboardEvent,
): void {
	const currentIdx = current ? visible.indexOf(current) : -1;

	switch (evt.key) {
		case 'ArrowDown':
			evt.preventDefault();
			host.selectItem(currentIdx === -1 ? visible[0] : visible[Math.min(currentIdx + 1, visible.length - 1)]);
			break;
		case 'ArrowUp':
			evt.preventDefault();
			host.selectItem(currentIdx === -1 ? visible[visible.length - 1] : visible[Math.max(currentIdx - 1, 0)]);
			break;
		case 'ArrowLeft':
		case 'ArrowRight':
			if (current) handleExpandCollapseKey(host, current, evt);
			break;
		case 'Enter':
			if (!current) break;
			evt.preventDefault();
			host.openItem(current, evt);
			break;
	}
}

/** Left collapses or jumps to the parent; right expands or jumps to the first child. */
function handleExpandCollapseKey(host: BacklogViewHost, current: BacklogItem, evt: KeyboardEvent): void {
	evt.preventDefault();
	const hasChildren = current.children.length > 0;
	const collapsed = host.isCollapsed(current.file.path);

	if (evt.key === 'ArrowLeft') {
		if (hasChildren && !collapsed) collapseKeepingSelection(host, current, true);
		else if (current.parent && !current.focusRoot) host.selectItem(current.parent);
	} else if (hasChildren && collapsed) {
		collapseKeepingSelection(host, current, false);
	} else if (hasChildren) {
		host.selectItem(current.children[0]);
	}
}

function collapseKeepingSelection(host: BacklogViewHost, item: BacklogItem, collapsed: boolean): void {
	host.setCollapsed(item.file.path, collapsed);
	host.persistCollapsedState();
	host.render();
	host.selectItem(item);
}
