import { BacklogItem, BacklogModel } from './model';

/** Which third of a row the pointer is over, and so what a release there means. */
export type DropZone = 'before' | 'after' | 'inside';

/**
 * A resolved landing place: whose child the item becomes, and where among that
 * parent's children. Declared here with the functions that work it out, not with
 * the writer that consumes it — a position is a fact about the tree, and computing
 * one must not depend on anything that mutates the vault.
 */
export interface DropTarget {
	parent: BacklogItem | null;
	/** Children of the new parent in visual order, excluding the dragged item. */
	siblings: BacklogItem[];
	/** Position among `siblings` where the dragged item should land. */
	insertIndex: number;
}

/**
 * Map a pointer position (0..1 within the row height) to a drop zone. Rows
 * without children get a narrower "inside" band: reordering is the common
 * intent on leaves, and a half-height nest zone caught too many drops.
 */
export function zoneForRatio(ratio: number, isLeaf: boolean): DropZone {
	const edge = isLeaf ? 0.35 : 0.25;
	if (ratio < edge) return 'before';
	if (ratio > 1 - edge) return 'after';
	return 'inside';
}

/** True when placing `dragged` under `parent` erases a parent link that points outside the view. */
function clearsStaleLink(parent: BacklogItem | null, dragged: BacklogItem): boolean {
	return parent === null && dragged.parent === null && dragged.hasParentValue;
}

/**
 * True when a sibling group can be *reordered*. Ranking rewrites the whole group
 * when the gaps run out, and the view never writes to a note the Base excluded —
 * so in a group holding one, an item would silently land at the end instead of
 * where it was aimed. Appending (dropping *into* a parent, the top-level strip,
 * indent) stays available: landing last is what those mean anyway.
 */
export function reorderableGroup(siblings: BacklogItem[]): boolean {
	return !siblings.some((s) => s.outsideFilter);
}

/** True when `parent` is the dragged item itself or one of its descendants. */
export function isInvalidParent(parent: BacklogItem | null, dragged: BacklogItem): boolean {
	for (let p: BacklogItem | null = parent; p !== null; p = p.parent) {
		if (p === dragged) return true;
	}
	return false;
}

/**
 * The drop target for releasing `dragged` over `item` in the given zone,
 * or null when the drop is illegal or a pure no-op.
 */
export function dropTargetFor(
	model: BacklogModel,
	item: BacklogItem,
	zone: DropZone,
	dragged: BacklogItem,
): DropTarget | null {
	const position = zone === 'inside' ? insidePosition(item, dragged) : siblingPosition(model, item, zone, dragged);
	if (!position) return null;
	if (isInvalidParent(position.parent, dragged)) return null;

	// Dropping into the slot the item already occupies is a no-op — unless the
	// drop would clear a stale parent link, which is a real change.
	if (position.parent === dragged.parent && !clearsStaleLink(position.parent, dragged)) {
		const fullList = position.parent ? position.parent.children : model.roots;
		if (fullList.indexOf(dragged) === position.insertIndex) return null;
	}
	return position;
}

/** Append as the last child of the hovered item. */
function insidePosition(item: BacklogItem, dragged: BacklogItem): DropTarget {
	const siblings = item.children.filter((c) => c !== dragged);
	return { parent: item, siblings, insertIndex: siblings.length };
}

/** Insert before or after the hovered item within its sibling group. */
function siblingPosition(
	model: BacklogModel,
	item: BacklogItem,
	zone: DropZone,
	dragged: BacklogItem,
): DropTarget | null {
	// The top row of a focused view groups items from different real parents;
	// there is no shared sibling ranking to insert into. An ancestor pulled in from
	// outside the filter is the same problem: most of its siblings were never loaded.
	if (item.focusRoot || item.outsideFilter) return null;
	const parent = item.parent;
	const fullList = parent ? parent.children : model.roots;
	const siblings = fullList.filter((c) => c !== dragged);
	if (!reorderableGroup(siblings)) return null;
	const idx = siblings.indexOf(item);
	if (idx === -1) return null;
	return { parent, siblings, insertIndex: zone === 'before' ? idx : idx + 1 };
}

/** The target for the "Move to top level" strip, or null when unavailable. */
export function rootDropTarget(model: BacklogModel, dragged: BacklogItem): DropTarget | null {
	if (model.focused) return null;
	const siblings = model.roots.filter((r) => r !== dragged);
	const alreadyLastRoot = dragged.parent === null && model.roots.indexOf(dragged) === model.roots.length - 1;
	// The last root with a stale parent link still needs the drop target: the
	// "move" is a no-op positionally but clears the unresolved parent property.
	if (alreadyLastRoot && !clearsStaleLink(null, dragged)) return null;
	return { parent: null, siblings, insertIndex: siblings.length };
}
