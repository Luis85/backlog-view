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
