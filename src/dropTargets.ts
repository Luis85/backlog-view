import { DropZone } from './host';
import { BacklogItem, BacklogModel } from './model';
import { DropTarget } from './ops';

/** Map a pointer position (0..1 within the row height) to a drop zone. */
export function zoneForRatio(ratio: number): DropZone {
	if (ratio < 0.25) return 'before';
	if (ratio > 0.75) return 'after';
	return 'inside';
}

/** True when placing `dragged` under `parent` erases a parent link that points outside the view. */
export function clearsStaleLink(parent: BacklogItem | null, dragged: BacklogItem): boolean {
	return parent === null && dragged.parent === null && dragged.hasParentValue;
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
	let parent: BacklogItem | null;
	let siblings: BacklogItem[];
	let insertIndex: number;

	if (zone === 'inside') {
		parent = item;
		siblings = item.children.filter((c) => c !== dragged);
		insertIndex = siblings.length;
	} else {
		// The top row of a focused view groups items from different real parents;
		// there is no shared sibling ranking to insert into.
		if (item.focusRoot) return null;
		parent = item.parent;
		const fullList = parent ? parent.children : model.roots;
		siblings = fullList.filter((c) => c !== dragged);
		const idx = siblings.indexOf(item);
		if (idx === -1) return null;
		insertIndex = zone === 'before' ? idx : idx + 1;
	}

	if (isInvalidParent(parent, dragged)) return null;

	// Dropping into the slot the item already occupies is a no-op — unless the
	// drop would clear a stale parent link, which is a real change.
	if (parent === dragged.parent && !clearsStaleLink(parent, dragged)) {
		const fullList = parent ? parent.children : model.roots;
		if (fullList.indexOf(dragged) === insertIndex) return null;
	}
	return { parent, siblings, insertIndex };
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
