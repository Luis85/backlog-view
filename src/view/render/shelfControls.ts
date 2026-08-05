import { Menu, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { addShelfSortItems, addShelfTypeItems, showMenuForClick } from '../interactions/menu';
import { organizeShelf } from '../../domain/shelf';
import { ShelfCard } from '../../domain/bars';
import { SHELF_LABEL } from '../../domain/roadmap';

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
 * by pointer and by assistive tech, invisible to Tab. Their keyboard path is the card
 * menu's own shelf section (`interactions/menu.ts`), built from the same two item
 * builders these buttons use, so neither surface can offer what the other does not.
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
 * Whether the shelf's header controls may sit outside the tab order, resolved from the
 * same card count the pane's own role is: with cards on screen the pane is a
 * one-tab-stop composite and everything it carries is `tabindex="-1"`, the tree's
 * per-row rule, with the card menu's shelf section as the keyboard path; with none it
 * is a plain `region`, that rule has nothing to apply to, and no card menu can open
 * either — so the header's own controls are all that is left and every one of them
 * has to be reachable.
 *
 * ALL of them, not the disclosure alone. Hiding the last visible type on a roadmap
 * with nothing placed empties the pane by itself, and rescuing only the disclosure
 * leaves a keyboard user shutting and reopening an empty shelf forever with the filter
 * that caused it out of reach. The rule is about the composite, so it lifts for
 * everything at once or it is not that rule.
 *
 * Decided after the render rather than while building the buttons, because that is when
 * the count is final: two deciders reading the same question at different times is how
 * the role and the class it pairs with came apart before.
 */
export function syncShelfTabStops(shelfEl: HTMLElement, paneIsComposite: boolean): void {
	const tabindex = paneIsComposite ? '-1' : '0';
	for (const btn of Array.from(shelfEl.querySelectorAll<HTMLElement>('.pbl-shelf-header button'))) {
		btn.setAttribute('tabindex', tabindex);
	}
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
		addShelfSortItems(host, menu);
		showMenuForClick(menu, evt);
	});
}

/** Which type groups show. */
function renderTypeFilter(host: BacklogViewHost, headerEl: HTMLElement, shelf: ShelfCard[]): void {
	const btn = headerButton(headerEl, 'pbl-shelf-filter', 'list-filter', 'Filter the shelf by type');
	// The filter is the one of the two picks that can HIDE work, so it says on its face
	// that it is doing so — a shelf whose count and contents disagree, with nothing
	// explaining why, reads as a bug. The UNFILTERED grouping decides that, the same
	// list the menu itself is built from.
	const hiding = organizeShelf(shelf, 'tree', new Set()).some((group) => host.shelfHiddenTypes.has(group.type));
	btn.toggleClass('is-active', hiding);
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		addShelfTypeItems(host, menu, shelf);
		showMenuForClick(menu, evt);
	});
}
