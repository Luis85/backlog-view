import { Menu, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { showMenuForClick } from '../interactions/menu';
import { organizeShelf, ShelfSort } from '../../domain/shelf';
import { ShelfCard } from '../../domain/bars';
import { SHELF_LABEL } from '../../domain/roadmap';

const SORT_OPTIONS: { value: ShelfSort; label: string }[] = [
	{ value: 'tree', label: 'Sibling order' },
	{ value: 'title', label: 'Title (A to Z)' },
	{ value: 'modified', label: 'Last modified' },
];

/**
 * The shelf's own header chrome: the disclosure that names it, counts it and opens it,
 * and — while it is open — a sort pick and a type filter. It lives in the shelf rather
 * than in the view's toolbar because that is where a reader working through unplaced
 * work is already looking; a control for the shelf, three regions away from it, was a
 * control nobody found.
 *
 * Both pickers open an Obsidian `Menu` from a `tabindex="-1"` button rather than
 * rendering a `<select>` or checkboxes inline. That is not decoration: the roadmap pane
 * wears `role="listbox"` while any card renders, and a focusable form control inside a
 * one-tab-stop composite is a second tab stop the widget does not have. It is the same
 * answer the tree's own per-row controls give (`.pbl-add`, the state chip) — reachable
 * by pointer and by assistive tech, invisible to Tab.
 *
 * The count is the shelf's TRUE total, never what the type filter currently leaves
 * showing: hiding a type is a display choice, and a count that moved with it would stop
 * answering the question the shelf exists to answer.
 */
export function renderShelfControls(host: BacklogViewHost, headerEl: HTMLElement, shelf: ShelfCard[]): void {
	// An empty shelf is a bare label: it renders only so a drag has somewhere to land,
	// and a disclosure over nothing would offer to open what has no content.
	if (shelf.length === 0) {
		setIcon(headerEl.createSpan({ cls: 'pbl-shelf-icon' }), 'inbox');
		headerEl.createSpan({ cls: 'pbl-shelf-name', text: SHELF_LABEL });
		return;
	}
	const collapsed = host.shelfCollapsed;
	const disclosure = headerEl.createEl('button', {
		cls: 'pbl-shelf-disclosure clickable-icon',
		attr: { type: 'button', tabindex: '-1', 'aria-expanded': String(!collapsed) },
	});
	setIcon(disclosure.createSpan({ cls: 'pbl-shelf-collapse-icon' }), collapsed ? 'chevron-right' : 'chevron-down');
	setIcon(disclosure.createSpan({ cls: 'pbl-shelf-icon' }), 'inbox');
	disclosure.createSpan({ cls: 'pbl-shelf-name', text: SHELF_LABEL });
	disclosure.createSpan({ cls: 'pbl-shelf-count', text: String(shelf.length) });
	// `aria-expanded` carries the state an icon and a chevron only show: without it a
	// screen-reader user at this button cannot tell a shut shelf from an open one.
	const action = `${collapsed ? 'Expand' : 'Collapse'} ${SHELF_LABEL} (${shelf.length})`;
	disclosure.setAttribute('aria-label', action);
	setTooltip(disclosure, action);
	disclosure.addEventListener('click', () => host.setShelfCollapsed(!collapsed));
	// Nothing to order or narrow while the cards are shut away, and a control that
	// visibly does nothing is worse than none — the toolbar's own expand/collapse rule.
	if (collapsed) return;
	renderSortPicker(host, headerEl);
	renderTypeFilter(host, headerEl, shelf);
}

/**
 * Whether the shelf's disclosure may sit outside the tab order, resolved from the same
 * card count the pane's own role is: with cards on screen the pane is a one-tab-stop
 * composite and every control it carries is `tabindex="-1"`, the tree's per-row rule;
 * with none it is a plain `region`, that rule has nothing to apply to, and the
 * disclosure is the ONLY way back to the cards a shut shelf is holding. Leaving it at
 * `-1` there strands a keyboard user on an all-shelved roadmap with no way to open it —
 * the composite's justification gone, its cost kept.
 *
 * Decided after the render rather than while building the button, because that is when
 * the count is final: two deciders reading the same question at different times is how
 * the role and the class it pairs with came apart before.
 */
export function syncShelfTabStop(shelfEl: HTMLElement, paneIsComposite: boolean): void {
	shelfEl.querySelector<HTMLElement>('.pbl-shelf-disclosure')?.setAttribute('tabindex', paneIsComposite ? '-1' : '0');
}

function headerButton(parent: HTMLElement, cls: string, icon: string, label: string): HTMLButtonElement {
	const btn = parent.createEl('button', {
		cls: `clickable-icon ${cls}`,
		attr: { type: 'button', tabindex: '-1', 'aria-label': label },
	});
	setIcon(btn, icon);
	setTooltip(btn, label);
	return btn;
}

/** Display order within each type group — never written to a note. */
function renderSortPicker(host: BacklogViewHost, headerEl: HTMLElement): void {
	const btn = headerButton(headerEl, 'pbl-shelf-sort', 'arrow-up-down', 'Sort the shelf');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		for (const { value, label } of SORT_OPTIONS) {
			menu.addItem((mi) =>
				mi
					.setTitle(label)
					.setChecked(host.shelfSort === value)
					.onClick(() => host.setShelfSort(value)),
			);
		}
		showMenuForClick(menu, evt);
	});
}

/**
 * Which type groups show. The menu is built from the UNFILTERED shelf
 * (`organizeShelf(..., new Set())`) so a hidden type is always still listed and can
 * always be turned back on — narrowing the menu by what it narrows would make the last
 * type hidden the one nobody could restore.
 */
function renderTypeFilter(host: BacklogViewHost, headerEl: HTMLElement, shelf: ShelfCard[]): void {
	const groups = organizeShelf(shelf, 'tree', new Set());
	const btn = headerButton(headerEl, 'pbl-shelf-filter', 'list-filter', 'Filter the shelf by type');
	// The filter is the one of the two picks that can HIDE work, so it says on its face
	// that it is doing so — a shelf whose count and contents disagree, with nothing
	// explaining why, reads as a bug.
	btn.toggleClass('is-active', groups.some((group) => host.shelfHiddenTypes.has(group.type)));
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		for (const group of groups) {
			menu.addItem((mi) =>
				mi
					.setTitle(`${group.type} (${group.cards.length})`)
					.setChecked(!host.shelfHiddenTypes.has(group.type))
					.onClick(() => toggleType(host, group.type)),
			);
		}
		showMenuForClick(menu, evt);
	});
}

function toggleType(host: BacklogViewHost, type: string): void {
	const hidden = new Set(host.shelfHiddenTypes);
	if (hidden.has(type)) hidden.delete(type);
	else hidden.add(type);
	host.setShelfHiddenTypes(hidden);
}
