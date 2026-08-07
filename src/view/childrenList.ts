import { BacklogViewHost } from './host';
import { BacklogItem } from '../domain/model';

/**
 * The direct children a card may list: the ones the view is showing anyway.
 * `isRowHidden` is the single visibility rule the tree and both card projections
 * share, so a done child hidden from the tree is absent here too — while the card's
 * rollup goes on counting it. The two numbers differ on purpose.
 *
 * Pure and DOM-free on purpose: `render/cardChildren.ts` (the disclosure) and
 * `interactions/menu.ts` (its keyboard path) both need this exact list, and either
 * importing the other would close a cycle — `render/cardChildren.ts` already reaches
 * `render/columns.ts` and `render/rows.ts`, which reach back into `menu.ts`. Living
 * here, with no import of its own into either, is what lets both share one answer
 * without one.
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
