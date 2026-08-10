import { Notice } from 'obsidian';
import { reorderableGroup } from '../../domain/dropTargets';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { DropTarget } from '../../domain/dropTargets';
import { configProblems } from '../../domain/settings';
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
	// The real root group, not the rendered forest — the same rule `siblingPosition`
	// keeps: an `order` is scoped to the notes sharing a parent, and a `Test suite` and an
	// `Epic` share the null one, so a move ranked against one projection's slice of it can
	// land on a number a hidden root already holds. A promoted root returned above.
	const fullList = item.parent ? item.parent.children : model.realRoots;
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
 * Set this view's properties up: bind the suggested key for every optional property
 * the options do not name yet, then backfill the properties this view writes — type,
 * order, and an empty key for each optional property a note lacks — across the tree,
 * without overwriting anything that already has a value.
 *
 * The two halves are one action because neither is any use alone. A key nothing
 * names cannot be created on a note, and a property no note carries is one Obsidian's
 * own picker cannot offer — which is the loop this button exists to break: the
 * features that need a property to work were unreachable without hand-editing a note
 * first, and then binding it by hand as well.
 */
export async function runInit(host: BacklogViewHost): Promise<void> {
	// The config gate covers the frontmatter batch below, and it has to cover the
	// options this action writes too: binding properties into a view whose keys
	// already collide would change the configuration and then refuse every write.
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		new Notice(`Fix the view options first: ${problems[0]}`);
		return;
	}
	// Binding first: an unnamed property has no key for the backfill to fill in, and
	// the plan below is made against what this adopts.
	const adopted = host.adoptDefaultProperties();
	const model = host.model;
	if (!model) return;
	const writes = computeInitWrites(model, host.settings);
	// applySafely reports its own notices when blocked or failing — only claim
	// success for the writes when the whole batch actually went through.
	const applied = writes.length > 0 && (await host.applySafely(writes)) !== null;
	const done: string[] = [];
	if (adopted.length > 0) done.push(`set up ${adopted.map((property) => property.suggested).join(', ')}`);
	if (applied) done.push(`updated ${writes.length} item${writes.length === 1 ? '' : 's'}`);
	// Half the loop this action exists to close is outside it: a bound property draws no
	// column until the base SHOWS it, and `BasesViewConfig` exposes no way to set the
	// order from here. Naming the menu is the whole fix.
	const next = adopted.length > 0 ? ' Add them in the properties menu to show them as columns.' : '';
	if (done.length > 0) new Notice(`Product Backlog: ${done.join(' and ')}.${next}`);
	// Nothing bound and nothing to write is the one case with no outcome to report;
	// a failed batch has already reported itself.
	else if (writes.length === 0) new Notice('All items already have the properties this view writes.');
}
