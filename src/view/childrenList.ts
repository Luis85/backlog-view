import { BacklogViewHost } from './host';
import { BacklogItem } from '../domain/model';
import { hiddenMatches } from '../domain/board';
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
 * `carded` is the same "already on screen" set `matchesUnderCard` subtracts, and it is
 * the whole of the rule: unfocused, every result gets a card of its own on both card
 * projections, so this is empty and the menu grows nothing. Under a FOCUS the cards are
 * the focus level's alone, so a card's children are drawn only as its own
 * `tabindex="-1"` list entries — and the menu's `Open child "…"` was their keyboard path
 * until it was removed on 2026-08-14 to shorten that menu. Removing it wholesale was
 * measured wrong the next day: an unfocused board is where a menu grew a row per child,
 * and a focused one is where those rows were the only route. Subtracting `carded` is what
 * separates those two, so the clutter stays gone where it was clutter.
 */
export function unreachableChildren(
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
		return `${count} ${type.toLowerCase()}${count === 1 ? '' : 's'}`;
	}
	return `${count} child${count === 1 ? '' : 'ren'}`;
}

/**
 * The matches a card should name on its face: everything `hiddenMatches` found beneath
 * it, minus anything its own disclosure already lists. One card cannot say the same
 * thing twice — and the DEPTH of the walk is untouched, so a match three levels down
 * still surfaces where nothing else can reach it.
 *
 * It is also the one place the walk's own boundary is supplied: `isRowHidden` is the
 * same visibility rule `listedChildren` above filters by, handed down as `drawn` so the
 * walk descends only along edges this projection puts on screen. `domain/board.ts` is
 * pure and can never ask a host, so the predicate comes from here — and because both
 * consumers of a card's matches (the card face's links and the row menu's Open match
 * entries) route through this function, one guard answers for both.
 *
 * Reads `listedChildren`, never the disclosure's own expansion state — the state a
 * toggle owns is irrelevant here, since both this and `listedChildren` only run while
 * the quick filter is active, and filtering forces every disclosure open anyway.
 */
export function undisclosedMatches(
	host: BacklogViewHost,
	item: BacklogItem,
	carded: Set<string>,
): BacklogItem[] {
	const listed = new Set(listedChildren(host, item).map((child) => child.file.path));
	return matchesUnderCard(host, item, carded).filter((match) => !listed.has(match.file.path));
}

/**
 * The same walk WITHOUT that last subtraction, for the card menu.
 *
 * The dedup above is about one surface saying one thing twice, and the two surfaces stopped
 * agreeing on what "twice" means when the menu's `Open child "…"` entries were removed
 * (2026-08-14). On the card FACE the disclosure's list and a match link sit inches apart,
 * so naming an item in both is a repetition. In the MENU nothing else names the children
 * at all any more — so subtracting them there withheld the one keyboard path to a match
 * the card was showing, which is precisely the failure `src/view/CLAUDE.md` records for
 * the board's hidden-match links: the disclosure's own entries are `tabindex="-1"`.
 *
 * `carded` is still subtracted in both: an item with a card of its own is reachable at
 * that card, and offering it here would point at something already on screen.
 */
export function matchesUnderCard(host: BacklogViewHost, item: BacklogItem, carded: Set<string>): BacklogItem[] {
	return hiddenMatches(
		item,
		(child) => host.isFilterMatch(child),
		carded,
		(child) => !host.isRowHidden(child),
	);
}
