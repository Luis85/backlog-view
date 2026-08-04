import { setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { organizeShelf, ShelfSort } from '../../domain/shelf';
import { ShelfCard } from '../../domain/bars';
import { SHELF_LABEL } from '../../domain/roadmap';

const SORT_OPTIONS: { value: ShelfSort; label: string }[] = [
	{ value: 'tree', label: 'Sibling order' },
	{ value: 'title', label: 'Title (A to Z)' },
	{ value: 'modified', label: 'Last modified' },
];

/**
 * The shelf's interactive chrome — collapse toggle, sort picker, type filter — built
 * as toolbar chrome, a sibling of `.pbl-tree`, never a descendant: the roadmap pane
 * carries `role="listbox"` while any cards render, a one-tab-stop composite widget
 * whose own controls are `tabindex="-1"` buttons with no room for a `<select>` or
 * checkboxes. Structure only: `host.roadmap` is not current yet at the point
 * `renderToolbar` runs (see `syncShelfControls`, called after content renders), so
 * nothing here reads live shelf data.
 */
export function renderShelfControls(host: BacklogViewHost, barEl: HTMLElement): void {
	if (host.projection !== 'roadmap') return;
	const wrap = barEl.createDiv({ cls: 'pbl-shelf-controls', attr: { role: 'group', 'aria-label': SHELF_LABEL } });

	const collapseBtn = wrap.createEl('button', {
		cls: 'pbl-shelf-collapse-btn clickable-icon',
		attr: { type: 'button' },
	});
	collapseBtn.createSpan({ cls: 'pbl-shelf-collapse-icon' });
	collapseBtn.createSpan({ cls: 'pbl-shelf-name', text: SHELF_LABEL });
	// A dedicated span, not text baked only into the aria-label: a sighted user reads
	// this, a screen-reader user reads the aria-label below — the same fact, two
	// modalities, same reason a tooltip and an aria-label both exist elsewhere here.
	collapseBtn.createSpan({ cls: 'pbl-shelf-count' });
	collapseBtn.addEventListener('click', () => host.setShelfCollapsed(!host.shelfCollapsed));

	const sortSelect = wrap.createEl('select', { cls: 'pbl-shelf-sort', attr: { 'aria-label': 'Sort the shelf' } });
	for (const { value, label } of SORT_OPTIONS) sortSelect.createEl('option', { value, text: label });
	sortSelect.addEventListener('change', () => host.setShelfSort(sortSelect.value as ShelfSort));

	wrap.createDiv({ cls: 'pbl-shelf-type-filter' });
}

/**
 * Fill in what `renderShelfControls` could not know yet — the shelf's real population,
 * which control values are current, and which types have cards to filter. Called after
 * every content render (`syncCountLabel`'s own timing), so it runs on the plain filter
 * path too, not only on a full render. Split into one helper per control — the
 * collapse button, the sort select, the type filter — purely to stay under the
 * complexity budget lint enforces; each still reads the same `.pbl-shelf-controls`
 * subtree the single function used to.
 */
export function syncShelfControls(host: BacklogViewHost, barEl: HTMLElement): void {
	const wrap = barEl.querySelector<HTMLElement>('.pbl-shelf-controls');
	if (!wrap) return;
	const shelf = host.roadmap?.roadmap.shelf ?? [];
	wrap.toggleClass('pbl-shelf-controls-empty', shelf.length === 0);
	if (shelf.length === 0) return;

	syncCollapseButton(host, wrap, shelf.length);
	syncSortSelect(host, wrap);
	syncTypeFilter(host, wrap, shelf);
}

/** The collapse toggle's icon, count, and the accessible name that carries its state. */
function syncCollapseButton(host: BacklogViewHost, wrap: HTMLElement, shelfCount: number): void {
	const collapseBtn = wrap.querySelector<HTMLButtonElement>('.pbl-shelf-collapse-btn');
	if (!collapseBtn) return;
	const collapsed = host.shelfCollapsed;
	const icon = collapseBtn.querySelector<HTMLElement>('.pbl-shelf-collapse-icon');
	if (icon) setIcon(icon, collapsed ? 'chevron-right' : 'chevron-down');
	const count = collapseBtn.querySelector<HTMLElement>('.pbl-shelf-count');
	if (count) count.setText(String(shelfCount));
	const label = `${SHELF_LABEL} (${shelfCount})`;
	const action = collapsed ? `Expand ${label}` : `Collapse ${label}`;
	// The button's own accessible name carries the toggle-state fact via
	// aria-expanded, not just the count: an icon and a text label are both
	// sighted-only, and without this attribute a screen-reader user at this
	// button cannot tell a collapsed shelf from an expanded one.
	collapseBtn.setAttribute('aria-label', action);
	collapseBtn.setAttribute('aria-expanded', String(!collapsed));
	setTooltip(collapseBtn, action);
}

function syncSortSelect(host: BacklogViewHost, wrap: HTMLElement): void {
	const sortSelect = wrap.querySelector<HTMLSelectElement>('.pbl-shelf-sort');
	if (sortSelect && sortSelect.value !== host.shelfSort) sortSelect.value = host.shelfSort;
}

/**
 * Which type's checkbox currently holds focus, if any — captured before the chips are
 * rebuilt so it can be handed to whichever new node represents the same type.
 * `document.activeElement` plus `contains`/`closest`, not a `:focus` selector — no
 * dependency on how thoroughly the test environment's selector engine matches live
 * focus state.
 */
function focusedShelfType(filterEl: HTMLElement): string | undefined {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !filterEl.contains(active)) return undefined;
	return active.closest<HTMLElement>('.pbl-shelf-type-chip')?.dataset.shelfType;
}

function syncTypeFilter(host: BacklogViewHost, wrap: HTMLElement, shelf: ShelfCard[]): void {
	const filterEl = wrap.querySelector<HTMLElement>('.pbl-shelf-type-filter');
	if (!filterEl) return;
	// Rebuilding the chips would destroy whichever one the user just activated,
	// taking its focus with it — the same problem the toolbar rebuild has, one level
	// deeper. `group.type` is a stable identifier across a rebuild where the DOM node
	// is not.
	const focusedType = focusedShelfType(filterEl);
	filterEl.empty();
	for (const group of organizeShelf(shelf, 'tree', new Set())) {
		const chip = filterEl.createEl('label', {
			cls: 'pbl-shelf-type-chip',
			attr: { 'data-shelf-type': group.type },
		});
		const checkbox = chip.createEl('input', { type: 'checkbox' });
		checkbox.checked = !host.shelfHiddenTypes.has(group.type);
		checkbox.addEventListener('change', () => {
			const hidden = new Set(host.shelfHiddenTypes);
			if (checkbox.checked) hidden.delete(group.type);
			else hidden.add(group.type);
			host.setShelfHiddenTypes(hidden);
		});
		chip.createSpan({ text: `${group.type} (${group.cards.length})` });
		if (group.type === focusedType) checkbox.focus();
	}
}
