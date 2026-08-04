import { displayType } from './itemTypes';
import { ALL_TYPES } from './settings';
import { ShelfCard } from './bars';

/** Display-only ordering of cards within a group. Never written anywhere. */
export type ShelfSort = 'tree' | 'title' | 'modified';

export interface ShelfGroup {
	type: string;
	cards: ShelfCard[];
}

/** The trailing group for any type `ALL_TYPES` does not name. */
// fallow-ignore-next-line unused-export
export const OTHER_GROUP = 'Other';

/**
 * The canonical `ALL_TYPES` entry this card's own badge names, or `OTHER_GROUP` when
 * none does. `displayType`, never raw `item.typeName`: an untyped child infers a
 * `levelIndex` from its parent and is badged accordingly, and a declared type's casing
 * on the note is not the casing `ALL_TYPES` spells it with — grouping on the raw field
 * would put both under `Other` despite the card's own badge visibly disagreeing.
 */
function groupKey(card: ShelfCard): string {
	const shown = displayType(card.item).toLowerCase();
	return ALL_TYPES.find((t) => t.toLowerCase() === shown) ?? OTHER_GROUP;
}

function compareCards(sort: ShelfSort, a: ShelfCard, b: ShelfCard): number {
	if (sort === 'title') return a.item.title.localeCompare(b.item.title);
	if (sort === 'modified') return b.item.file.stat.mtime - a.item.file.stat.mtime;
	// 'tree': the input is already sibling order: `roadmap.shelf` keeps it, and a
	// stable sort over an already-ordered array leaves it exactly where it was.
	return 0;
}

/**
 * Group the shelf's cards by the type each one's own badge already shows, in
 * `ALL_TYPES` order plus a trailing `OTHER_GROUP` — never the input order. A group is
 * omitted whole when it is empty or its type is hidden. Within a surviving group, sort
 * orders cards for display only: nothing here is ever written to a note.
 */
export function organizeShelf(cards: ShelfCard[], sort: ShelfSort, hiddenTypes: ReadonlySet<string>): ShelfGroup[] {
	const byType = new Map<string, ShelfCard[]>();
	for (const card of cards) {
		const key = groupKey(card);
		const group = byType.get(key);
		if (group) group.push(card);
		else byType.set(key, [card]);
	}
	const groups: ShelfGroup[] = [];
	for (const type of [...ALL_TYPES, OTHER_GROUP]) {
		if (hiddenTypes.has(type)) continue;
		const groupCards = byType.get(type);
		if (!groupCards || groupCards.length === 0) continue;
		groups.push({ type, cards: [...groupCards].sort((a, b) => compareCards(sort, a, b)) });
	}
	return groups;
}
