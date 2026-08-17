import { t } from '../i18n/t';
import { BacklogViewHost } from './host';
import { BacklogItem } from '../domain/model';
import { cardPaths, hiddenMatches } from '../domain/board';
import { displayType } from '../domain/itemTypes';

/**
 * The direct children a card may list: the ones the view is showing anyway.
 * `isRowHidden` is the single visibility rule the tree and both card projections
 * share, so a done child hidden from the tree is absent here too — while the card's
 * rollup goes on counting it. The two numbers differ on purpose.
 *
 * This lives in `view/`, not `domain/`, because `listedChildren` and `undisclosedMatches`
 * below both take a `BacklogViewHost` — a view type `domain/` can never import, so the
 * layering rule rules `domain/` out regardless of any cycle. It is its OWN file, rather
 * than living inside `render/cardChildren.ts`, because of the cycle that would otherwise close:
 * `render/cardChildren.ts` already reaches `render/columns.ts` and `render/rows.ts`,
 * which reach back into `interactions/menu.ts`, so `menu.ts` importing from
 * `cardChildren.ts` directly would close it. Pure and DOM-free, with no import of its
 * own into either, is what lets `render/cardChildren.ts` (the disclosure) and
 * `interactions/menu.ts` (its keyboard path, and the match-list dedup beside it)
 * share one answer without one.
 */
export function listedChildren(host: BacklogViewHost, item: BacklogItem): BacklogItem[] {
	return item.children.filter((child) => !host.isRowHidden(child));
}

/**
 * The listed children with no card of their own — the ones a pointer can reach on this
 * card's face and a keyboard cannot reach anywhere.
 *
 * `carded` is the same "already on screen" set `undisclosedMatches` subtracts, and it is
 * the whole of the rule: unfocused, every result gets a card of its own on both card
 * projections, so this is empty and the menu grows nothing. Under a FOCUS the cards are
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
	carded: Set<string>,
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
 * The matches a surface should name on its face: everything `hiddenMatches` found
 * beneath the item, minus anything that surface already lists. One surface cannot say
 * the same thing twice — and the DEPTH of the walk is untouched, so a match three levels
 * down still surfaces where nothing else can reach it.
 *
 * It is also the one place the walk's own boundary is supplied: `isRowHidden` is the
 * same visibility rule `listedChildren` above filters by, handed down as `drawn` so the
 * walk descends only along edges this projection puts on screen. `domain/board.ts` is
 * pure and can never ask a host, so the predicate comes from here — and because both
 * consumers of a card's matches (the card face's links and the row menu's Open match
 * entries) route through this function, one guard answers for both.
 *
 * **`listed` is what the CALLER already shows**, never a set decided here. The rule is
 * that a surface must not name twice what it already shows, and only the surface knows
 * what it shows: a card draws a disclosure and passes `listedChildren`, while a timeline
 * row draws none at all and passes nothing — subtracting there would delete a
 * direct-child match, the below-focus result this whole feature exists to reach.
 *
 * Where a caller does pass `listedChildren`, it is that function's answer and never the
 * disclosure's own expansion state — the state a toggle owns is irrelevant here, since
 * both only run while the quick filter is active, and filtering forces every disclosure
 * open anyway.
 */
export function undisclosedMatches(
	host: BacklogViewHost,
	item: BacklogItem,
	carded: Set<string>,
	listed: readonly BacklogItem[],
): BacklogItem[] {
	const shown = new Set(listed.map((child) => child.file.path));
	return hiddenMatches(
		item,
		(child) => host.isFilterMatch(child),
		carded,
		(child) => !host.isRowHidden(child),
	).filter((match) => !shown.has(match.file.path));
}

/**
 * Every path this projection drew a card for — the "already on screen" test.
 *
 * A board asks its model: a `BoardModel` is already narrowed to what draws (a folded
 * column's cards are emptied in the snapshot), so `cardPaths` is honest there. The
 * roadmap asks the register its render filled, because its model is not what it draws.
 * Empty on the tree, which is correct rather than a fallback — both callers below are
 * about a card.
 */
export function cardedPaths(host: BacklogViewHost): Set<string> {
	const roadmap = host.roadmap;
	if (roadmap) return new Set(roadmap.placed.keys());
	const board = host.board?.board;
	return board ? cardPaths(board) : new Set();
}

/**
 * Whether the horizon board is what is on screen — the axis whose card menu carries no
 * children section at all (asked for directly, 2026-08-17; the task note records what
 * that withholds). The spelling is `interactions/plan.ts`'s own for the same question:
 * the snapshot alone cannot answer it, since `host.roadmap` describes the last roadmap
 * render, and the projection alone cannot either, since the dated axis keeps the section.
 */
export function horizonBoardShowing(host: BacklogViewHost): boolean {
	return host.projection === 'roadmap' && host.roadmap?.roadmap.axis === 'horizons';
}

/**
 * What the row MENU will list as `Open child "…"` — the gate and the narrowing together,
 * so the two surfaces below cannot disagree about it.
 *
 * `cardChildrenShown` is the gate `addChildrenSection` opens on, and a timeline row joins
 * that set through its FOLD chevron while listing nothing on its face — which is why the
 * menu's already-listed set is not the face's, and why this is asked rather than reusing
 * `listedChildren`. `unreachableChildren` is the second half: the menu names only a child
 * with no card of its own.
 *
 * Empty on the horizon board, and stated HERE rather than only in `addChildrenSection`,
 * because `matchesFor` below subtracts exactly this list: gating the section alone would
 * leave the match walk still ceding a matched child to entries no menu draws, and the
 * child would be named nowhere. With the list empty, ownership of a matched uncarded
 * child moves to `Open match "…"` — the count invariant ("exactly one entry ends in its
 * title") holds, the owner moves, which is the drift the invariant was written to allow.
 */
export function menuChildren(host: BacklogViewHost, item: BacklogItem, carded: Set<string>): BacklogItem[] {
	if (horizonBoardShowing(host)) return [];
	return host.cardChildrenShown.has(item.file.path) ? unreachableChildren(host, item, carded) : [];
}

/**
 * The matches to offer for this item, asked of whichever projection drew it.
 *
 * The menu is handed an item and no surface, so the disclosure policy has to be looked
 * up rather than assumed: always subtracting would lose a row's direct-child match, and
 * never subtracting would offer a card's disclosure entries a second time. It subtracts
 * `menuChildren` — what this menu will itself list — rather than `listedChildren`, so a
 * child the menu is NOT naming (it has a card of its own) can still be named as a match,
 * and one it IS naming is named once. Those two sets came apart on 2026-08-15, when the
 * per-child entries were narrowed to the unreachable ones; subtracting the wider set
 * would silently drop a match, which is the failure this whole feature exists against.
 */
export function matchesFor(host: BacklogViewHost, item: BacklogItem): BacklogItem[] {
	if (!host.roadmap && !host.board) return [];
	const carded = cardedPaths(host);
	return undisclosedMatches(host, item, carded, menuChildren(host, item, carded));
}
