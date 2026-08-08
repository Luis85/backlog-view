import { BacklogViewHost } from './host';
import { BacklogItem } from '../domain/model';
import { hiddenMatches } from '../domain/board';

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
 * set has no true name. The plural is a naive `+ s`, the same shape `columnLabel` uses
 * for `1 card` / `2 cards`: type names are user data, so a declared type that
 * pluralizes otherwise reads slightly wrong, and the ceiling is a word, never an action.
 */
export function childrenLabel(children: BacklogItem[]): string {
	const count = children.length;
	const type = children[0]?.typeName ?? null;
	if (type !== null && children.every((child) => child.typeName === type)) {
		return `${count} ${type.toLowerCase()}${count === 1 ? '' : 's'}`;
	}
	return `${count} child${count === 1 ? '' : 'ren'}`;
}

/**
 * The matches a card should name on its face: everything `hiddenMatches` found beneath
 * it, minus anything its own disclosure already lists. One card cannot say the same
 * thing twice — and the walk itself is untouched, so a match three levels down still
 * surfaces where nothing else can reach it.
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
	return hiddenMatches(item, (child) => host.isFilterMatch(child), carded).filter(
		(match) => !listed.has(match.file.path),
	);
}
