import { keepsProjection } from './itemTypes';
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
 * where it was aimed. Appending (dropping *into* a parent, indent) stays available:
 * landing last is what those mean anyway.
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
	member: (item: BacklogItem) => boolean,
): DropTarget | null {
	const position = zone === 'inside' ? insidePosition(item, dragged) : siblingPosition(model, item, zone, dragged);
	if (!position) return null;
	if (isInvalidParent(position.parent, dragged)) return null;
	// **A drop may not change which projection draws the row** (`keepsProjection`). An
	// `inside` drop never can — the hovered row is on this screen, so it carries this
	// screen's ladder — but a `before`/`after` drop on a real ROOT lands in the root group,
	// which is where a move can cross the two ladders: a catalog `Task` dropped beside its
	// suite answers the plan's ladder and vanishes off the screen it was dragged on. Asked
	// once here rather than in each position function, so the two cannot answer it
	// differently.
	if (!keepsProjection(dragged, position.parent)) return null;

	// Dropping into the slot the item already occupies is a no-op — unless the
	// drop would clear a stale parent link, which is a real change.
	//
	// **Asked of the DRAWN order, while the rank below is still computed from the real
	// group.** Two questions over two lists, and conflating them is a mistake this codebase
	// has made before: a sibling group can interleave the projections (real roots `Epic A`,
	// `Test suite`, `Epic B` draw as `Epic A`, `Epic B` in the plan), so a drop that moves
	// the row past nothing anyone can see reads as a move on the real indices. It then
	// rewrites `order` and spends the undo slot with both screens unchanged. With no
	// interleaving the two readings coincide exactly, which is why this is a correction
	// rather than a behaviour change for every existing base.
	if (position.parent === dragged.parent && !clearsStaleLink(position.parent, dragged)) {
		const fullList = position.parent ? position.parent.children : model.realRoots;
		const drawnIndex = fullList.filter(member).indexOf(dragged);
		const drawnInsert = position.siblings.slice(0, position.insertIndex).filter(member).length;
		if (drawnInsert === drawnIndex) return null;
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
	// `realRoots`, not the rendered forest: `order` is a number scoped to the notes
	// sharing a parent, and a `Test suite` and an `Epic` share the null one — so ranking a
	// suite against the catalog's roots alone would take a midpoint a hidden `Epic` may
	// already hold, which is the one ranking limitation this plugin forbids itself from
	// demonstrating. The item is a real root here (a promoted one returned above), so this
	// real group is what decides the NUMBER — the insert index returned below is read
	// against these neighbours whether or not the caller can see all of them. Whether the
	// move is worth making at all is a separate question, over the drawn order, and it is
	// the caller's: `dropTargetFor`'s own no-op check asks it against `member` rather than
	// assuming the two orderings agree.
	const fullList = parent ? parent.children : model.realRoots;
	const siblings = fullList.filter((c) => c !== dragged);
	if (!reorderableGroup(siblings)) return null;
	const idx = siblings.indexOf(item);
	if (idx === -1) return null;
	return { parent, siblings, insertIndex: zone === 'before' ? idx : idx + 1 };
}
