import { t } from '../i18n/t';
import { BacklogViewHost } from './host';
import { BacklogItem } from '../domain/model';
import { cardPaths } from '../domain/board';
import { displayType } from '../domain/itemTypes';

/**
 * The children a card DRAWS — the level of the tree this projection puts beneath this
 * item, which is one level of `item.children` only where this projection draws every
 * link in it.
 *
 * **A row this projection does not draw is traversed THROUGH, never dropped**, and that
 * is the whole of the descent: a `Release` hand-hung between a `Feature` and its `PBI`s
 * is drawn by no axis of the roadmap (`onThisRoadmap`), so on a focused roadmap the PBIs
 * below it were on no card at all — while their dates went on reaching the Feature's own
 * bar, which walks the MODEL. A bar drawn from work the card said was not there. The
 * descent terminates because `children` is acyclic — `buildModel` runs `breakCycles`
 * before `assignAll`, and it is the only producer of a model.
 *
 * The question is `isRowUndrawn` and NEVER `isRowHidden`, and the difference is the trap:
 * `rowHidden` is true for three different reasons and a caller holding the boolean cannot
 * tell them apart. Descending through a child the COMPLETED TOGGLE hid would put a done
 * subtree back on every card face, the board's included.
 *
 * **It stops where `projectionForest` has already re-rooted the subtree.** A promoted
 * root carries `focusRoot` — *a root of the rendered forest that is not a root of the
 * model* — so it is drawn in its own right at the top of the forest and is nobody's
 * listed child. That is what keeps the board and the Deliverables board still: their
 * membership IS the forest's (`inPlan`), so every row they refuse promotes what is under
 * it, and this walk finds nothing to carry up. The rows that strand are the ones only a
 * projection's own narrowing refuses — the roadmap's release, and the iteration board's
 * out-of-sprint link — which the forest drew and nothing promoted.
 *
 * This lives in `view/`, not `domain/`, because these functions take a `BacklogViewHost` —
 * a view type `domain/` can never import, so the layering rule rules `domain/` out
 * regardless of any cycle. It is its OWN file, rather than living inside
 * `render/cardChildren.ts`, because of the cycle that would otherwise close:
 * `render/cardChildren.ts` already reaches `render/columns.ts` and `render/rows.ts`,
 * which reach back into `interactions/menu.ts`, so `menu.ts` importing from
 * `cardChildren.ts` directly would close it. Pure and DOM-free, with no import of its
 * own into either, is what lets `render/cardChildren.ts` (the disclosure) and
 * `interactions/menu.ts` (its keyboard path) share one answer without one.
 */
export function drawnChildren(host: BacklogViewHost, item: BacklogItem, descended = false): BacklogItem[] {
	return item.children.flatMap((child) => {
		if (host.isRowUndrawn(child)) return drawnChildren(host, child, true);
		// Only on the way UP, where `projectionForest` did the re-rooting this stop is
		// deferring to. A projection whose walk is NOT the focused forest meets a focus
		// root as a card's own direct child: the iteration board reads `realRoots` and a
		// focus set on another projection arrives unrevalidated, so with the focus on
		// `PBI` an in-sprint `PBI` under an in-sprint `Feature` carries the stamp at
		// depth 0 — promoted by nothing, and its carrier's face is the only place it is
		// listed. Checked by `test/view/cardChildren.test.ts`, both halves.
		return descended && child.focusRoot ? [] : [child];
	});
}

/**
 * The drawn children a card may LIST: the ones the view is showing anyway.
 * `isRowHidden` is the single visibility rule the tree and both card projections
 * share, so a done child hidden from the tree is absent here too — while the card's
 * rollup goes on counting it. The two numbers differ on purpose.
 *
 * Membership is already settled by `drawnChildren`, so what this subtracts is the
 * completed toggle and an emptied context scaffold — the two reasons `rowHidden` gives
 * that are about hiding rather than about this screen's population.
 */
export function listedChildren(host: BacklogViewHost, item: BacklogItem): BacklogItem[] {
	return drawnChildren(host, item).filter((child) => !host.isRowHidden(child));
}

/**
 * The listed children with no card of their own — the ones a pointer can reach on this
 * card's face and a keyboard cannot reach anywhere.
 *
 * `carded` is the "already on screen" set, and it is the whole of the rule: unfocused,
 * every result gets a card of its own on both card projections, so this is empty and the menu grows nothing. Under a FOCUS the cards are
 * the focus level's alone, so a card's children are drawn only as its own
 * `tabindex="-1"` list entries — and the menu's `Open child "…"` was their keyboard path
 * until it was removed on 2026-08-14 to shorten that menu. Removing it wholesale was
 * measured wrong the next day: an unfocused board is where a menu grew a row per child,
 * and a focused one is where those rows were the only route. Subtracting `carded` is what
 * separates those two, so the clutter stays gone where it was clutter.
 *
 * Not exported: `menuChildren` below is the only caller and the only honest one, since
 * this answer is meaningless without the gate it pairs with.
 */
function unreachableChildren(
	host: BacklogViewHost,
	item: BacklogItem,
	carded: ReadonlySet<string>,
): BacklogItem[] {
	return listedChildren(host, item).filter((child) => !carded.has(child.file.path));
}

/**
 * What the disclosure calls them. Naming the type is worth more than a bare count — a
 * board of Epics says "3 features" — but only while they agree on one, since a mixed
 * set has no true name. Compared and named by `displayType`, the same function the
 * badge beside each child reads: an untyped child's badge names its rung, not "no
 * type", so comparing raw `typeName` disagreed with the badges and degraded the common
 * case (untyped children) to a bare count. The plural is a naive `+ s`, the same shape
 * `columnLabel` uses for `1 card` / `2 cards`: type names are user data, so a declared
 * type that pluralizes otherwise reads slightly wrong, and the ceiling is a word, never
 * an action.
 */
export function childrenLabel(children: BacklogItem[]): string {
	const count = children.length;
	const type = children[0] ? displayType(children[0]) : '';
	if (type !== '' && children.every((child) => displayType(child) === type)) {
		return t('count.childrenOfType', { count, type: type.toLowerCase() });
	}
	return t('count.children', { count });
}

/**
 * Every path this projection drew a card for — the "already on screen" test.
 *
 * A board asks its model: a `BoardModel` is already narrowed to what draws (a folded
 * column's cards are emptied in the snapshot), so `cardPaths` is honest there. The
 * roadmap asks the register its render filled, because its model is not what it draws.
 * Empty on the tree, which is correct rather than a fallback — both callers below are
 * about a card.
 *
 * READONLY, and that is what lets the roadmap hand its register straight back rather than
 * copying it per menu: only `.has` is ever asked of the answer. The register belongs to
 * one render pass (`rowContext` mints it), so nothing outlives the frame it describes.
 */
export function cardedPaths(host: BacklogViewHost): ReadonlySet<string> {
	const roadmap = host.roadmap;
	if (roadmap) return roadmap.placed;
	const board = host.board?.board;
	return board ? cardPaths(board) : new Set();
}

/**
 * What the row MENU will list as `Open child "…"` — the `cardChildrenShown` gate and the
 * `unreachableChildren` narrowing as one answer, so nothing derives half of it.
 *
 * `cardChildrenShown` is the gate `addChildrenSection` opens on, and a timeline row joins
 * that set through its FOLD chevron while listing nothing on its face — which is why the
 * menu's already-listed set is not the face's, and why this is asked rather than reusing
 * `listedChildren`. `unreachableChildren` is the second half: the menu names only a child
 * with no card of its own.
 *
 * The horizon board's exemption is NOT stated here, and that is the whole of what this
 * function knows about it: `addChildrenSection` — the only caller — returns on
 * `menusListChildren` before the separator, so a copy of that gate in this body could
 * never run. There was one until 2026-08-17, kept because `matchesFor` subtracted this
 * list from the match walk and so needed it EMPTY as well as undrawn; 88e03e8 deleted
 * that reason with `matchesFor` itself. A second caller wanting the exemption asks
 * `menusListChildren` for it, the way this one's caller does.
 */
export function menuChildren(host: BacklogViewHost, item: BacklogItem, carded: ReadonlySet<string>): BacklogItem[] {
	return host.cardChildrenShown.has(item.file.path) ? unreachableChildren(host, item, carded) : [];
}

