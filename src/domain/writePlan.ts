import { TFile } from 'obsidian';
import { DropTarget } from './dropTargets';
import { BacklogItem, BacklogModel, childLevelIndex } from './model';
import { BacklogSettings } from './settings';

/**
 * What a change to the tree *would* write, worked out without touching anything.
 * Applying an `ItemWrite` is `storage/frontmatter.ts`'s job; deciding what should
 * be in one is this module's, which is why every function here is pure and every
 * ordering rule is testable without a vault.
 */

/** Spacing between freshly assigned order values, leaving room to drop items in between. */
export const ORDER_SPACING = 10;
/** Below this gap between neighbors, sibling orders get renumbered instead of subdivided. */
const MIN_GAP = 0.002;

/** A pending frontmatter update for a single file. Fields left undefined are not touched. */
export interface ItemWrite {
	file: TFile;
	/** New parent note, or null to make the item top-level (pinned in folder mode). */
	parent?: TFile | null;
	/**
	 * Remove the parent property entirely — in folder mode this hands the item
	 * back to folder-note inference instead of pinning it to the top level.
	 */
	removeParentKey?: boolean;
	order?: number;
	typeName?: string;
	/** New value for the state property; ignored when no state property is configured. */
	state?: string;
}

/**
 * Compute the frontmatter writes for dropping `dragged` at the given target position.
 * Uses the gap between neighbor orders when possible; falls back to renumbering
 * the whole sibling group when orders are missing or too tightly packed.
 */
export function computeDropWrites(
	dragged: BacklogItem,
	target: DropTarget,
	settings: BacklogSettings,
): ItemWrite[] {
	const { parent, siblings, insertIndex } = target;
	const parentField = computeParentField(dragged, parent);
	const parentChanged = parentField !== undefined;
	const { typeField, cascade } = computeTypeChanges(dragged, parent, settings, parentChanged);

	const order = computeInsertOrder(siblings, insertIndex);
	if (order !== null) {
		return [{ file: dragged.file, parent: parentField, order, typeName: typeField }, ...cascade];
	}
	// Renumbering rewrites every sibling, and the view never writes to a note the
	// Base excluded. Placing the item past the highest order we can see keeps the
	// drop working while touching only the note being moved. Callers refuse the
	// *positional* drops in such a group, so landing last is what was asked for.
	if (siblings.some((s) => s.outsideFilter)) {
		const order = afterHighestKnown(siblings);
		return [{ file: dragged.file, parent: parentField, order, typeName: typeField }, ...cascade];
	}
	return [...renumberWrites(dragged, siblings, insertIndex, { parentField, typeField }), ...cascade];
}

/** One spacing beyond the highest order in the group, ignoring siblings that have none. */
function afterHighestKnown(siblings: BacklogItem[]): number {
	let max = 0;
	for (const sibling of siblings) {
		if (sibling.order !== null && sibling.order > max) max = sibling.order;
	}
	return Math.floor(max) + ORDER_SPACING;
}

/** The parent frontmatter update, or undefined when the parent is unchanged. */
function computeParentField(dragged: BacklogItem, parent: BacklogItem | null): TFile | null | undefined {
	const oldParentPath = dragged.parent?.file.path ?? null;
	const newParentPath = parent?.file.path ?? null;
	// An item whose parent link points outside the view renders as a root while the
	// stale property is still set; placing it at the top level must clear that link,
	// otherwise it would re-nest as soon as the linked note enters the filter.
	const staleRootLink = parent === null && dragged.parent === null && dragged.hasParentValue;
	const parentChanged = oldParentPath !== newParentPath || staleRootLink;
	return parentChanged ? (parent ? parent.file : null) : undefined;
}

/**
 * With autoType, the dragged item is retyped for its new slot and explicitly
 * typed descendants follow, so a subtree move cannot leave inconsistent
 * hierarchy metadata. Untyped descendants need no write (their level is
 * implied from the parent chain) and custom types outside the configured
 * ladder are deliberate — both are left alone. Exported so parent-link
 * removal ("Use folder position") retypes exactly like a drop would.
 */
export function computeTypeChanges(
	dragged: BacklogItem,
	parent: BacklogItem | null,
	settings: BacklogSettings,
	parentChanged: boolean,
): { typeField?: string; cascade: ItemWrite[] } {
	const cascade: ItemWrite[] = [];
	if (!parentChanged || !settings.autoType) return { cascade };

	const newBaseIdx = childLevelIndex(parent, settings.levels);
	const implied = settings.levels[newBaseIdx];
	let typeField: string | undefined;
	if (dragged.typeName === null || dragged.typeName.toLowerCase() !== implied.toLowerCase()) {
		typeField = implied;
	}

	const lastIdx = settings.levels.length - 1;
	const walk = (node: BacklogItem) => {
		for (const child of node.children) {
			// The cascade stops at a note the Base excluded — a filter can leave one
			// *between* two results (Epic and PBI returned, the Feature between them
			// not). We may not retype it, and retyping only the levels below it would
			// leave a worse ladder than leaving that branch as it stands.
			if (child.outsideFilter) continue;
			if (child.typeName !== null && child.levelIndex !== -1) {
				const targetLevel = settings.levels[Math.min(newBaseIdx + (child.depth - dragged.depth), lastIdx)];
				if (child.typeName.toLowerCase() !== targetLevel.toLowerCase()) {
					cascade.push({ file: child.file, typeName: targetLevel });
				}
			}
			walk(child);
		}
	};
	walk(dragged);
	return { typeField, cascade };
}

/** The order value for the insertion slot, or null when the group needs renumbering. */
function computeInsertOrder(siblings: BacklogItem[], insertIndex: number): number | null {
	const prev = insertIndex > 0 ? siblings[insertIndex - 1] : null;
	const next = insertIndex < siblings.length ? siblings[insertIndex] : null;
	if (!prev && !next) return ORDER_SPACING;
	if (prev && next) return orderBetween(prev.order, next.order);
	if (prev) return prev.order !== null ? Math.floor(prev.order) + ORDER_SPACING : null;
	return next !== null && next.order !== null ? roundOrder(Math.ceil(next.order) - ORDER_SPACING) : null;
}

/** Halfway between two ordered neighbors; null when a value is missing or the gap is spent. */
function orderBetween(prevOrder: number | null, nextOrder: number | null): number | null {
	if (prevOrder === null || nextOrder === null) return null;
	if (nextOrder - prevOrder <= MIN_GAP) return null;
	return roundOrder(prevOrder + (nextOrder - prevOrder) / 2);
}

/** Renumber the whole sibling group, including the dragged item at its new position. */
function renumberWrites(
	dragged: BacklogItem,
	siblings: BacklogItem[],
	insertIndex: number,
	fields: { parentField: TFile | null | undefined; typeField: string | undefined },
): ItemWrite[] {
	const sequence = [...siblings];
	sequence.splice(insertIndex, 0, dragged);
	const writes: ItemWrite[] = [];
	sequence.forEach((item, i) => {
		const slot = (i + 1) * ORDER_SPACING;
		if (item === dragged) {
			writes.push({ file: item.file, parent: fields.parentField, order: slot, typeName: fields.typeField });
		} else if (item.order !== slot) {
			writes.push({ file: item.file, order: slot });
		}
	});
	return writes;
}

/**
 * Fill in missing order and type properties across the whole hierarchy without
 * touching values that already exist. Walks the real tree, so a focused view
 * still backfills hidden ancestors and branches outside the focus level.
 */
export function computeInitWrites(model: BacklogModel, settings: BacklogSettings): ItemWrite[] {
	const writes: ItemWrite[] = [];
	const visit = (siblings: BacklogItem[]) => {
		// Deliberately reads context siblings' orders too. They are *rendered*, so a
		// rank that ignored them would place a backfilled item above a row the user
		// can see — a backfill that fills in blanks must not reorder the tree. Not
		// writing to them is the rule; not looking at them would break this. The drop
		// and creation paths (afterHighestKnown, endOfSiblingsOrder) do the same.
		let maxOrder = 0;
		for (const item of siblings) {
			if (item.order !== null && item.order > maxOrder) maxOrder = item.order;
		}
		for (const item of siblings) {
			// Ancestors pulled in from outside the filter are context, not results —
			// the backfill must not write properties into notes the base excluded.
			if (item.outsideFilter) {
				visit(item.children);
				continue;
			}
			const write: ItemWrite = { file: item.file };
			let needed = false;
			if (item.order === null) {
				maxOrder = Math.floor(maxOrder) + ORDER_SPACING;
				write.order = maxOrder;
				needed = true;
			}
			// An unresolved parent link means the item's real level is unknowable —
			// don't write a type derived from its provisional top-level position.
			const levelUnknown = item.parent === null && item.hasParentValue;
			if (item.typeName === null && !levelUnknown) {
				write.typeName = settings.levels[childLevelIndex(item.parent, settings.levels)];
				needed = true;
			}
			if (needed) writes.push(write);
			visit(item.children);
		}
	};
	visit(model.realRoots);
	return writes;
}


/** Orders are fractional ranks; four decimals is well past the gap that triggers renumbering. */
function roundOrder(value: number): number {
	return Math.round(value * 10000) / 10000;
}
