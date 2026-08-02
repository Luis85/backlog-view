import { Notice } from 'obsidian';
import { reorderableGroup } from '../../domain/dropTargets';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { DropTarget } from '../../domain/dropTargets';
import { computeInitWrites } from '../../domain/writePlan';

/**
 * Structural operations shared by the context menu and keyboard shortcuts.
 * All of them route through host.performDrop and reuse the drop-plan logic.
 */

/** The item's sibling list and index within it, or null when it cannot be moved. */
function siblingContext(host: BacklogViewHost, item: BacklogItem): { fullList: BacklogItem[]; idx: number } | null {
	const model = host.model;
	// Focus roots share no ranking; an ancestor from outside the filter has siblings
	// the query never returned, so ordering it against the loaded ones would be a guess.
	if (!model || item.focusRoot || item.outsideFilter) return null;
	const fullList = item.parent ? item.parent.children : model.roots;
	const idx = fullList.indexOf(item);
	return idx === -1 ? null : { fullList, idx };
}

/**
 * The nearest rendered sibling in the given direction, skipping rows hidden by
 * the completed-items toggle. Moves and menus target this item, so structural
 * commands never produce a visually inert change.
 */
export function visibleNeighbor(host: BacklogViewHost, item: BacklogItem, delta: -1 | 1): BacklogItem | null {
	const ctx = siblingContext(host, item);
	if (!ctx) return null;
	for (let i = ctx.idx + delta; i >= 0 && i < ctx.fullList.length; i += delta) {
		if (!host.isRowHidden(ctx.fullList[i])) return ctx.fullList[i];
	}
	return null;
}

/**
 * True when the item can be reordered among its own siblings. Reordering renumbers
 * the group if the gaps run out, which must never write to a note the Base excluded
 * — so a group holding a context row offers no move commands at all.
 */
export function canReorder(host: BacklogViewHost, item: BacklogItem): boolean {
	const ctx = siblingContext(host, item);
	return ctx !== null && reorderableGroup(ctx.fullList);
}

export function moveWithinSiblings(host: BacklogViewHost, item: BacklogItem, delta: -1 | 1): void {
	const ctx = siblingContext(host, item);
	const neighbor = visibleNeighbor(host, item, delta);
	if (!ctx || !neighbor || !reorderableGroup(ctx.fullList)) return;
	// Land on the far side of the visible neighbor; order math still runs over the
	// full sibling list, so hidden rows in between are simply skipped past.
	const siblings = ctx.fullList.filter((s) => s !== item);
	const insertIndex = delta === -1 ? siblings.indexOf(neighbor) : siblings.indexOf(neighbor) + 1;
	void host.performDrop(item, { parent: item.parent, siblings, insertIndex });
}

export function moveToEdge(host: BacklogViewHost, item: BacklogItem, edge: 'top' | 'bottom'): void {
	const ctx = siblingContext(host, item);
	if (!ctx || !reorderableGroup(ctx.fullList)) return;
	if (ctx.idx === (edge === 'top' ? 0 : ctx.fullList.length - 1)) return;
	const siblings = ctx.fullList.filter((s) => s !== item);
	const insertIndex = edge === 'top' ? 0 : siblings.length;
	void host.performDrop(item, { parent: item.parent, siblings, insertIndex });
}

/**
 * Where outdenting would put the item — right after its parent among the parent's
 * siblings — or null when that is unavailable. Exported so the menu can offer the
 * command on exactly the rows where it works.
 */
export function outdentTarget(host: BacklogViewHost, item: BacklogItem): DropTarget | null {
	const model = host.model;
	const parent = item.parent;
	if (!model || !parent || item.focusRoot || item.outsideFilter) return null;
	const grandparent = parent.parent;
	// Root-level outdents rank among the real top level, not the focus rows.
	const fullList = grandparent ? grandparent.children : model.realRoots;
	const siblings = fullList.filter((s) => s !== item);
	// This lands the item at a position among the parent's siblings — and that group
	// holds the context parent itself whenever the Base excluded it.
	if (!reorderableGroup(siblings)) return null;
	return { parent: grandparent, siblings, insertIndex: siblings.indexOf(parent) + 1 };
}

/** Make the item a sibling of its parent, placed right after it. */
export function outdent(host: BacklogViewHost, item: BacklogItem): void {
	const target = outdentTarget(host, item);
	if (target) void host.performDrop(item, target);
}

/**
 * Nest the item under its previous visible sibling, at the end of its children.
 * An append, so a partially loaded destination is fine: last is last either way.
 */
export function indent(host: BacklogViewHost, item: BacklogItem): void {
	const newParent = visibleNeighbor(host, item, -1);
	if (!newParent) return;
	const siblings = newParent.children.filter((s) => s !== item);
	void host.performDrop(item, { parent: newParent, siblings, insertIndex: siblings.length });
}

/**
 * Backfill the properties this view writes — type, order, and the roadmap's
 * placement keys where an axis is configured — across the tree, without overwriting
 * anything that already has a value.
 */
export async function runInit(host: BacklogViewHost): Promise<void> {
	const model = host.model;
	if (!model) return;
	const writes = computeInitWrites(model, host.settings);
	if (writes.length === 0) {
		new Notice('All items already have the properties this view writes.');
		return;
	}
	// applySafely reports its own notices when blocked or failing — only claim
	// success when the whole batch actually went through.
	const applied = await host.applySafely(writes);
	if (applied) {
		new Notice(`Product Backlog: updated ${writes.length} item${writes.length === 1 ? '' : 's'}.`);
	}
}
