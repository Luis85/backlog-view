import { Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../model';
import { computeInitWrites } from '../ops';

/**
 * Structural operations shared by the context menu and keyboard shortcuts.
 * All of them route through host.performDrop and reuse the drop-plan logic.
 */

export function moveWithinSiblings(host: BacklogViewHost, item: BacklogItem, delta: -1 | 1): void {
	const model = host.model;
	if (!model || item.focusRoot) return;
	const fullList = item.parent ? item.parent.children : model.roots;
	const idx = fullList.indexOf(item);
	if (idx === -1) return;
	const insertIndex = delta === -1 ? idx - 1 : idx + 1;
	if (insertIndex < 0 || insertIndex >= fullList.length) return;
	const siblings = fullList.filter((s) => s !== item);
	void host.performDrop(item, { parent: item.parent, siblings, insertIndex });
}

export function moveToEdge(host: BacklogViewHost, item: BacklogItem, edge: 'top' | 'bottom'): void {
	const model = host.model;
	if (!model || item.focusRoot) return;
	const fullList = item.parent ? item.parent.children : model.roots;
	const idx = fullList.indexOf(item);
	if (idx === -1 || idx === (edge === 'top' ? 0 : fullList.length - 1)) return;
	const siblings = fullList.filter((s) => s !== item);
	const insertIndex = edge === 'top' ? 0 : siblings.length;
	void host.performDrop(item, { parent: item.parent, siblings, insertIndex });
}

/** Make the item a sibling of its parent, placed right after it. */
export function outdent(host: BacklogViewHost, item: BacklogItem): void {
	const model = host.model;
	const parent = item.parent;
	if (!model || !parent || item.focusRoot) return;
	const grandparent = parent.parent;
	const fullList = grandparent ? grandparent.children : model.roots;
	const siblings = fullList.filter((s) => s !== item);
	const insertIndex = siblings.indexOf(parent) + 1;
	void host.performDrop(item, { parent: grandparent, siblings, insertIndex });
}

/** Nest the item under its previous sibling, at the end of its children. */
export function indent(host: BacklogViewHost, item: BacklogItem): void {
	const model = host.model;
	if (!model || item.focusRoot) return;
	const fullList = item.parent ? item.parent.children : model.roots;
	const idx = fullList.indexOf(item);
	if (idx <= 0) return;
	const newParent = fullList[idx - 1];
	const siblings = newParent.children.filter((s) => s !== item);
	void host.performDrop(item, { parent: newParent, siblings, insertIndex: siblings.length });
}

/** Backfill missing type/order properties across the tree without overwriting anything. */
export async function runInit(host: BacklogViewHost): Promise<void> {
	const model = host.model;
	if (!model) return;
	const writes = computeInitWrites(model, host.settings);
	if (writes.length === 0) {
		new Notice('All items already have type and order properties.');
		return;
	}
	await host.applySafely(writes);
	new Notice(`Product Backlog: updated ${writes.length} item${writes.length === 1 ? '' : 's'}.`);
}
