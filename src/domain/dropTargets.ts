import { keepsProjection } from './itemTypes';
import { BacklogItem, BacklogModel } from './model';

/** Which third of a row the pointer is over, and so what a release there means. */
export type DropZone = 'before' | 'after' | 'inside';

/**
 * A resolved landing place: whose child the item becomes, and among which rows it is
 * ranked. **`peers` is intent, never arithmetic** — it says the user aimed before this
 * row or after that one; the NUMBER comes from the global ranked population (see
 * `anchoredOrder`). Declared here with the functions that work it out, not with the
 * writer that consumes it.
 */
export interface DropTarget {
	parent: BacklogItem | null;
	/** Rows the item is ranked AMONG — intent, not arithmetic. */
	peers: BacklogItem[];
	/** Position among `peers` where the dragged item should land. */
	insertIndex: number;
	/**
	 * `parent` is `dragged`'s own current parent, RESTATED rather than decided — a focus
	 * rank's way of asking for no parent change at all, never an explicit placement.
	 * Every other producer states a real decision, even where it happens to agree with
	 * the current parent; only this one restates it verbatim, including when it is
	 * `null` for an unresolved link. That distinction is load-bearing and cannot be
	 * recovered from the values alone: an explicit top-level drop with an unresolved
	 * link and a focus rank that never touched the parent both reach `computeParentField`
	 * as `parent === null, dragged.parent === null, hasParentValue === true`, and only
	 * the first of those may clear the stale key. Set `true` only by the branch that
	 * means it; every other producer leaves it unset.
	 */
	parentUnchanged?: boolean;
}

/**
 * A context row with nothing to rank from — see `anchoredOrder`'s own comment
 * (`writePlan.ts`). The row is on screen, but it can never be GIVEN a rank: every writer
 * skips an `outsideFilter` note, so it constrains nothing and is neither an anchor to
 * rank against nor a peer to swap past.
 *
 * Here rather than beside a caller because this is the one module every ranking caller
 * can reach without a cycle: `writePlan.ts` imports this file, so the predicate cannot
 * live there, and a rule spelled once per caller is how the drag and the keyboard came
 * to disagree about the same row.
 */
export function isUnrankedContext(anchor: BacklogItem | null): boolean {
	return anchor !== null && anchor.outsideFilter && anchor.order === null;
}

/**
 * A ranking population with the rows that carry no position dropped — see
 * `isUnrankedContext`. **One function, over whichever population its caller hands it**,
 * because every ranking branch asks the same question of a different list: the focus
 * branch here and in `siblingContext` (`view/interactions/structure.ts`) over
 * `model.roots`, and the TREE branch of both over `parent.children` / `model.realRoots`.
 * Both branches of both functions read it, which is what stops the drag and the keyboard
 * disagreeing about the same row again — they have twice, on the focus branch and then
 * on the tree branch (the correction of 2026-08-31): a null-order context row sorts
 * last, so left unfiltered it became the anchor for any append and `anchoredOrder` (which
 * skips it as an anchor, having no position to give) read that as "append past the END of
 * the whole population" — `Move to bottom` on a tree row wrote past a sibling nobody could
 * see, moved nothing the screen shows, and spent the undo slot doing it. A RANKED context
 * row stays in every population this filters, because its order is a real placement
 * constraint the rows around it are still ranked against.
 *
 * **The identical shape recurs at every APPEND, not only a reorder** (Task 4's own
 * correction, same day): `insidePosition` below, `indentTarget` and both branches of
 * `newItemOrder` (`view/interactions/create.ts`), and the release scope's `createMember`
 * (`view/release/scopeCreate.ts`) all build a `DropTarget` whose `insertIndex` is
 * `peers.length` — so an unfiltered list's LAST row becomes the anchor, and a trailing
 * unranked context row reads the same way: `anchoredOrder` skips it and recurses to
 * "append past the end of the whole population" instead of after the destination's own
 * last real child or root. Filtering the append peers through this function the same way
 * a reorder's peers already are is the whole of what each of those sites does.
 */
export function rankablePeers(rows: BacklogItem[]): BacklogItem[] {
	return rows.filter((row) => !isUnrankedContext(row));
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
	/**
	 * Whether this row is DRAWN on the screen the drag is happening on — projection
	 * membership AND the completed toggle AND an emptied context scaffold, which is what
	 * `rowHidden` composes and what the view passes inverted. It answers the no-op
	 * question in both branches below and nothing else, so a row the user cannot see is
	 * never something a drop can be said to have moved past. Narrowed from a
	 * projection-only predicate on 2026-08-31: a hidden completed row counted as a
	 * neighbour, and a drop that changed nothing visible wrote and spent the undo slot.
	 */
	drawn: (item: BacklogItem) => boolean,
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
	// A FOCUS rank asks its no-op question of the focus list, and asks it exactly.
	// `peers` is `rankablePeers(model.roots)` minus the dragged row, so splicing the row
	// back in at its own original index in THAT list reproduces it — which means the drop is a no-op
	// precisely when the insert index equals that index. Read off `model.roots` instead
	// and the comparison shifts by the number of unranked context rows above the row,
	// so a drop that moves nothing reads as a move and spends the undo slot.
	if (model.focused && model.roots.includes(dragged) && position.parent === dragged.parent) {
		// `rankablePeers(model.roots)`, matching the list `peers` was built from — the two
		// disagree by the number of unranked context rows ABOVE the dragged row, and reading
		// the unfiltered one there misses the no-op and writes to a row that did not move.
		// `dragged` is assumed to be in that list: an `outsideFilter` row would score `-1`
		// and never read as a no-op, which the render prevents by never handing one a drag.
		//
		// **And filtered to what is DRAWN, by the same arithmetic the tree branch below
		// uses.** A raw index counts rows the completed toggle is hiding, so with `A`, a
		// hidden done `H` and `B` ranked in that order, dropping `B` where it already
		// appears — straight after `A` — reads as a move to the slot before `H` and writes.
		// The screen is identical afterwards and the undo slot is gone. `visibleNeighbor`
		// has always skipped hidden rows so that "structural commands never produce a
		// visually inert change"; this is the drag being held to the same promise.
		const focusList = rankablePeers(model.roots);
		const drawnIndex = focusList.filter(drawn).indexOf(dragged);
		const drawnInsert = position.peers.slice(0, position.insertIndex).filter(drawn).length;
		if (drawnInsert === drawnIndex) return null;
	} else if (position.parent === dragged.parent && !clearsStaleLink(position.parent, dragged)) {
		// The TREE keeps today's rule unchanged: the real group filtered to this
		// projection, because a sibling group can interleave the projections and
		// crossing a row nobody can see is not a move.
		const fullList = position.parent ? position.parent.children : model.realRoots;
		const drawnIndex = fullList.filter(drawn).indexOf(dragged);
		const drawnInsert = position.peers.slice(0, position.insertIndex).filter(drawn).length;
		if (drawnInsert === drawnIndex) return null;
	}
	return position;
}

/**
 * Append as the last child of the hovered item. `rankablePeers` (own comment): the
 * hovered item's children can end in an unranked context row.
 */
function insidePosition(item: BacklogItem, dragged: BacklogItem): DropTarget {
	const peers = rankablePeers(item.children).filter((c) => c !== dragged);
	return { parent: item, peers, insertIndex: peers.length };
}

/** Insert before or after the hovered item within its sibling group. */
function siblingPosition(
	model: BacklogModel,
	item: BacklogItem,
	zone: DropZone,
	dragged: BacklogItem,
): DropTarget | null {
	// An ACTIVE focus row is a ranking destination now: the peers are the rendered
	// focus rows, and the parent is the dragged item's OWN — a focus rank writes
	// `order` and never `parent`. Membership in the focus forest is the test, not the
	// `focusRoot` flag: `projectionForest` sets that flag on any promoted root,
	// including with `model.focused` false, so a catalog `Test suite` carries it while
	// its real siblings are off screen.
	// BOTH rows, not just the hovered one. Checking `item` alone lets a DESCENDANT
	// dragged onto a focus row take this branch: it would keep its own parent and get
	// ranked among a rung it does not belong to, silently, where today it is refused.
	// An `outsideFilter` row sitting exactly at the focus level is ALSO a `model.roots`
	// member — `collectFocusRoots` promotes on level match alone, not on filter
	// membership — so `dragged` being both is a reachable model state this branch does
	// not guard against directly. It relies on the render never handing such a row a
	// drag to begin with (`row.draggable = !item.outsideFilter` in `render/rows.ts`,
	// re-checked at drag time in `interactions/dragDrop.ts`), the same reliance
	// `cardDrag.ts` places on the same flag.
	//
	// **A RANKED context row is a legal anchor here, and the refusal below is why this
	// branch comes first.** That refusal's reason — an ancestor from outside the filter
	// has siblings the query never returned, so ordering it against the loaded ones would
	// be a guess — is a reason about REPARENTING, and this branch changes no parent: it
	// restates the dragged row's own and writes `order` alone. Asked ahead of it, the drag
	// lands where Alt+arrow and the move menu already land, which is the disagreement this
	// ordering exists to end: `siblingContext` keeps a ranked context row among the focus
	// peers deliberately, so the two paths were ranking the same gesture across the same
	// row and only one of them drew an indicator for it. An UNRANKED one is refused by
	// both — it can never be given a rank, so it constrains nothing and is nothing to land
	// beside. **`peers` drops them too, and that is the correction of 2026-08-31**: leaving
	// them in was justified here by `anchoredOrder` filtering them from the population and
	// skipping one as an anchor, which is half true and the false half bites. That skip
	// means *"this anchor carries no position, so append to the end"* — right for
	// `New <child>` under a context parent, wrong for a drop the user aimed between two
	// rows, which landed at the bottom of the backlog instead. `rankablePeers` is the one
	// function `siblingContext` already used, so all three inputs now read the same peers.
	if (model.focused && model.roots.includes(item) && model.roots.includes(dragged) && !isUnrankedContext(item)) {
		const peers = rankablePeers(model.roots).filter((r) => r !== dragged);
		const idx = peers.indexOf(item);
		if (idx === -1) return null;
		return { parent: dragged.parent, peers, insertIndex: zone === 'before' ? idx : idx + 1, parentUnchanged: true };
	}
	// An ancestor pulled in from outside the filter still has siblings the query never
	// returned, so ordering it against the loaded ones would be a guess. Every path but
	// the focus rank above, unchanged.
	if (item.outsideFilter) return null;
	if (item.focusRoot) return null;
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
	// `rankablePeers` here too, not only on the focus branch above: an unranked context row
	// sorts last in this group exactly as it does among the focus rows, so left in it became
	// the anchor for a drop or a keyboard move past the last writable sibling — see the
	// function's own comment for the write that produced.
	const fullList = rankablePeers(parent ? parent.children : model.realRoots);
	const peers = fullList.filter((c) => c !== dragged);
	const idx = peers.indexOf(item);
	if (idx === -1) return null;
	return { parent, peers, insertIndex: zone === 'before' ? idx : idx + 1 };
}
