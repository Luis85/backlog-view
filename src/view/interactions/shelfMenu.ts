import { Menu } from 'obsidian';
import { BacklogViewHost } from '../host';
import { ShelfCard } from '../../domain/bars';
import { organizeShelf, ShelfSort } from '../../domain/shelf';
import { ValuePromptModal } from '../../ui/prompts';

/**
 * What the shelf's own picks look like as MENU ITEMS — the sort, the type filter and the
 * search — built once and offered on two surfaces: the shelf header's own controls
 * (`render/shelfControls.ts`) and the card menu's shelf section (`interactions/menu.ts`,
 * which is the keyboard path for controls the composite pane keeps out of the tab order).
 * Two builders offering the same choices are one edit from disagreeing about what is
 * offered or which entry is checked, which is why there is one of each and why they live
 * apart from either caller.
 */

const SHELF_SORTS: { value: ShelfSort; label: string }[] = [
	{ value: 'tree', label: 'Sibling order' },
	{ value: 'title', label: 'Title (A to Z)' },
	{ value: 'modified', label: 'Last modified' },
];

/**
 * The shelf's display picks as menu items. ONE builder serves both surfaces — the
 * shelf header's own pickers and the keyboard path below — for the reason the horizon
 * chip and its menu share one: two builders offering the same choices are one edit from
 * disagreeing about what is offered or which entry is checked.
 *
 * `after` is where the two surfaces legitimately differ, and the only place they may.
 * A pick rebuilds the pane and destroys the button its menu was opened from; a menu
 * opened from the shelf's HEADER has to give focus back to that header's replacement,
 * while one opened from a CARD leaves focus where the card left it. Passing the
 * difference in keeps a single builder rather than forking it over one line.
 */
export function addShelfSortItems(host: BacklogViewHost, menu: Menu, after?: () => void): void {
	for (const { value, label } of SHELF_SORTS) {
		menu.addItem((mi) =>
			mi
				.setTitle(label)
				.setChecked(host.shelfSort === value)
				.onClick(() => {
					host.setShelfSort(value);
					after?.();
				}),
		);
	}
}

/**
 * One entry per type ON the shelf, from the UNFILTERED grouping: hiding a type must
 * never remove its own way back, so the list a hidden type is restored from cannot be
 * narrowed by the hiding — nor by the shelf's search, which is why `searchShelf` runs
 * where it does rather than inside `organizeShelf`.
 *
 * Two bulk entries lead the list, and they are what makes "only the type I want" a pick
 * rather than a sweep: hide all, then show back the one. Each is offered exactly when it
 * would change something, the checkmark rule stated as a `setDisabled` — an entry that
 * writes nothing is one this codebase does not offer anywhere else either.
 *
 * The two are NOT mirror images, and 4a in [[The shelf, organized]] is what decides it:
 * a type hidden while its last card was still shelved stays hidden in the store, unused
 * until a card of that type comes back. `Show all` therefore clears the whole set — an
 * entry saying ALL that left one of those standing would be answering a narrower question
 * than it asks — while `Hide all` ADDS to it rather than replacing it, since a set built
 * from the groups on screen would silently un-hide exactly those remembered types, and
 * the un-hiding would only show up the day one of them was shelved again.
 *
 * **Each gate asks what its OWN handler would change, and the two therefore ask different
 * sets.** `Show all` clears the STORE, so it is live whenever the store holds anything —
 * including a type with no card on this shelf, which is the only way to take a remembered
 * hiding back and, gated on the groups on screen, was an entry disabled in exactly the
 * state it exists for. `Hide all` writes the union, so it is dead once every group in
 * front of the reader is hidden, whatever else the store remembers. A gate copied from
 * the entry beside it would be wrong in one direction or the other; both were, one round
 * apart (found by review, Codex on PR #161).
 */
export function addShelfTypeItems(host: BacklogViewHost, menu: Menu, shelf: ShelfCard[], after?: () => void): void {
	const groups = organizeShelf(shelf, 'tree', new Set());
	const apply = (hidden: Iterable<string>) => {
		host.setShelfHiddenTypes(new Set(hidden));
		after?.();
	};
	menu.addItem((mi) =>
		mi
			.setTitle('Show all types')
			.setIcon('eye')
			.setDisabled(host.shelfHiddenTypes.size === 0)
			.onClick(() => apply([])),
	);
	menu.addItem((mi) =>
		mi
			.setTitle('Hide all types')
			.setIcon('eye-off')
			.setDisabled(groups.every((group) => host.shelfHiddenTypes.has(group.type)))
			.onClick(() => apply([...host.shelfHiddenTypes, ...groups.map((group) => group.type)])),
	);
	menu.addSeparator();
	for (const group of groups) {
		menu.addItem((mi) =>
			mi
				.setTitle(`${group.type} (${group.cards.length})`)
				.setChecked(!host.shelfHiddenTypes.has(group.type))
				.onClick(() => {
					const hidden = new Set(host.shelfHiddenTypes);
					if (hidden.has(group.type)) hidden.delete(group.type);
					else hidden.add(group.type);
					apply(hidden);
				}),
		);
	}
}

/**
 * The shelf's search, for a reader with no pointer. Its box is a `tabindex="-1"` form
 * control inside the pane (see `render/shelfControls.ts` for why it may be a form control
 * at all), so this is its keyboard path, the same obligation every other `-1` control here
 * carries. A prompt rather than a live filter: a modal is the one place a keyboard can
 * type without competing with the composite for the arrows.
 *
 * The clear is a second entry rather than an empty submit — `ValuePromptModal` refuses a
 * blank value — and it is offered only while a search runs, so neither entry can do
 * nothing.
 */
export function addShelfSearchItems(host: BacklogViewHost, menu: Menu): void {
	menu.addItem((mi) =>
		mi
			.setTitle('Search unplaced...')
			.setIcon('search')
			.onClick(() =>
				new ValuePromptModal(host.app, {
					title: 'Search unplaced',
					fieldName: 'Title contains',
					placeholder: 'Part of a title',
					ctaLabel: 'Search',
					known: [],
					onSubmit: (value) => host.setShelfSearch(value),
				}).open(),
			),
	);
	if (host.shelfSearch === '') return;
	menu.addItem((mi) => mi.setTitle('Clear unplaced search').setIcon('x').onClick(() => host.setShelfSearch('')));
}

