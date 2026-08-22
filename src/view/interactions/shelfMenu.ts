import { Menu } from 'obsidian';
import { MessageKey, t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { ShelfCard } from '../../domain/bars';
import { organizeShelf, ShelfLayout, ShelfSort } from '../../domain/shelf';
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

/**
 * The three sorts. `value` is persisted view state and is not text; `label` is a catalog
 * KEY rather than the sentence itself, so the list stays data and the lookup happens at
 * draw time — a module constant holding `t(...)` would freeze English at import, before
 * `initLocale()` has run.
 */
const SHELF_SORTS = [
	{ value: 'tree', label: 'menu.shelfSortTree' },
	{ value: 'title', label: 'menu.shelfSortTitle' },
	{ value: 'modified', label: 'menu.shelfSortModified' },
] as const satisfies readonly { value: ShelfSort; label: MessageKey }[];

/**
 * The two layouts, in the same shape and for the same reason as `SHELF_SORTS` above:
 * `value` is persisted view state and is not text, `label` is a catalog KEY so the list
 * stays data and the lookup happens at draw time.
 */
const SHELF_LAYOUTS = [
	{ value: 'cards', label: 'menu.shelfLayoutCards', icon: 'layout-grid' },
	{ value: 'list', label: 'menu.shelfLayoutList', icon: 'list' },
] as const satisfies readonly { value: ShelfLayout; label: MessageKey; icon: string }[];

/**
 * Which layout the shelf draws, as menu items — the sort's own shape one row down, and
 * offered on the same two surfaces for the same reason. The ICON travels with the entry
 * because the header's picker wears it too: the button shows the layout currently in
 * force, so a reader can tell the two apart without opening anything, and one table is
 * what stops the button and its menu illustrating different picks.
 */
export function addShelfLayoutItems(host: BacklogViewHost, menu: Menu, after?: () => void): void {
	for (const { value, label, icon } of SHELF_LAYOUTS) {
		menu.addItem((mi) =>
			mi
				.setTitle(t(label))
				.setIcon(icon)
				.setChecked(host.shelfLayout === value)
				.onClick(() => {
					host.setShelfLayout(value);
					after?.();
				}),
		);
	}
}

/** The icon the header's picker wears for the layout in force — see {@link addShelfLayoutItems}. */
export function shelfLayoutIcon(layout: ShelfLayout): string {
	return SHELF_LAYOUTS.find((entry) => entry.value === layout)?.icon ?? SHELF_LAYOUTS[0].icon;
}

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
				.setTitle(t(label))
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
			.setTitle(t('menu.showAllTypes'))
			.setIcon('eye')
			.setDisabled(host.shelfHiddenTypes.size === 0)
			.onClick(() => apply([])),
	);
	menu.addItem((mi) =>
		mi
			.setTitle(t('menu.hideAllTypes'))
			.setIcon('eye-off')
			.setDisabled(groups.every((group) => host.shelfHiddenTypes.has(group.type)))
			.onClick(() => apply([...host.shelfHiddenTypes, ...groups.map((group) => group.type)])),
	);
	menu.addSeparator();
	for (const group of groups) {
		menu.addItem((mi) =>
			mi
				.setTitle(t('menu.shelfTypeCount', { type: group.type, count: group.cards.length }))
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
			.setTitle(t('menu.searchShelf'))
			.setIcon('search')
			.onClick(() =>
				new ValuePromptModal(host.app, {
					// `shelf.search` is the header box's own label: one act, one wording.
					title: t('shelf.search'),
					fieldName: t('menu.searchField'),
					placeholder: t('menu.searchPlaceholder'),
					ctaLabel: t('menu.searchCta'),
					known: [],
					onSubmit: (value) => host.setShelfSearch(value),
				}).open(),
			),
	);
	if (host.shelfSearch === '') return;
	menu.addItem((mi) => mi.setTitle(t('shelf.clearSearch')).setIcon('x').onClick(() => host.setShelfSearch('')));
}

