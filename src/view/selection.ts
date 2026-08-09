import { BacklogItem } from '../domain/model';

/**
 * What a click inside the pane can land on and still mean something: something the
 * selection can REST on, or something that can be operated. Everything else the pane
 * draws is background, and a click there means "nothing" — see the listener in the
 * constructor.
 *
 * Both halves are CATEGORIES rather than lists of the things that exist today, and each
 * was a list first that shipped a hole. `[aria-selected]` is what selectable looks like
 * here — a tree row, a card in either card projection, and the board column's header,
 * which is a stop of its own precisely so an empty column stays reachable; naming
 * `.pbl-row, .pbl-card` covered two of those three and discarded a held column position
 * on a click on its header. `[tabindex]` is what operable looks like, since a pane
 * control is a tab stop by construction — `-1` for the per-row buttons, `0` for the
 * timeline's resize grip, a `role="separator"` div that no list of items and buttons
 * caught. `button` stays beside it for the few carrying no explicit tabindex. A row's own
 * controls need no term at all: they sit inside a row, which the first half already has.
 *
 * The scroller itself carries `tabindex="0"` and is caught by that same term, so the
 * listener has to rule it back out — it is the background, not a control on it.
 */
const NOT_BACKGROUND = '[aria-selected], button, [tabindex]';

/** Source of unique element ids for the aria attributes, shared across view instances. */
let elementIdCounter = 0;

/**
 * A DOM id no other view instance can have. Two saved views can sit in split panes
 * over the same notes, and `aria-activedescendant` and `aria-describedby` both
 * resolve their target by id across the WHOLE document — a per-view counter would
 * point one board's attributes at the other board's elements.
 */
export function uniqueElementId(prefix: string): string {
	return `${prefix}-${++elementIdCounter}`;
}

/**
 * The one selection either projection holds: a row or card by path, or — board
 * only — a column stop, so an empty column is still reachable by keyboard. Owns
 * the selected classes, `aria-activedescendant` and the scroll-into-view; the
 * view delegates its host surface here and re-points after each render pass,
 * because a rebuild replaces every element a selection was drawn on.
 *
 * Focus stays on the scroller element throughout; `aria-activedescendant` tells
 * assistive tech which element is active, and the `pbl-has-selection` class tells
 * CSS whether the scroller or the selection carries the focus ring — a `:has()`
 * selector would answer that too, at the price of invalidating on every subtree
 * change, which is why it is a class set where the state changes.
 */
export class SelectionController {
	private readonly treeEl: HTMLElement;
	private readonly rows: Map<string, HTMLElement>;
	private readonly colEls: () => HTMLElement[];
	selectedPath: string | null = null;
	selectedBoardColumn: number | null = null;
	private selectedRowEl: HTMLElement | null = null;

	constructor(treeEl: HTMLElement, rows: Map<string, HTMLElement>, colEls: () => HTMLElement[]) {
		this.treeEl = treeEl;
		this.rows = rows;
		this.colEls = colEls;
		// The pointer's way OUT of a selection, and the reason it is needed: `Escape`
		// clears one, but only while the pane has focus, and opening a note hands focus
		// to the editor — so after the gesture that selects, the key that unselects is
		// out of reach.
		//
		// Background is defined by what it is NOT, and it has to be: `evt.target ===
		// treeEl` describes the empty strip under a tree's last row and almost nothing
		// else, because every projection fills the pane with containers of its own —
		// `.pbl-board-cols`, a column's card list, the roadmap's grid, a row's
		// `.pbl-children`. A click in the blank part of any of those is a click on
		// nothing, and the equality test called it a click on something.
		treeEl.addEventListener('click', (evt) => {
			const hit = (evt.target as Element | null)?.closest(NOT_BACKGROUND) ?? null;
			if (hit === null || hit === treeEl) this.clearSelection();
		});
	}

	selectItem(item: BacklogItem, scroll = true): void {
		// The selection is one thing: taking a card releases a held column.
		if (this.selectedBoardColumn !== null) this.selectBoardColumn(null);
		this.selectedPath = item.file.path;
		this.deselectRows();
		const row = this.rows.get(item.file.path) ?? null;
		this.selectedRowEl = row;
		this.syncActiveDescendant(row);
		if (row) {
			row.classList.add('pbl-selected');
			row.setAttribute('aria-selected', 'true');
			if (scroll) row.scrollIntoView({ block: 'nearest' });
		}
	}

	clearSelection(): void {
		// A held column stop is a selection too, and clearing one while leaving the
		// other is a pane that reads as empty and still answers the move keys.
		if (this.selectedBoardColumn !== null) this.selectBoardColumn(null);
		this.selectedPath = null;
		this.deselectRows();
		this.syncActiveDescendant(null);
	}

	/**
	 * Rest the board selection on a column itself; null releases it. The active
	 * descendant is the column's `.pbl-board-col-stop` — an option-like element the
	 * board render puts in each header — never the column container: that is a
	 * group, and a group is not a valid active item for a listbox, so a reader
	 * told to rest on one may announce nothing.
	 */
	selectBoardColumn(index: number | null): void {
		const els = this.colEls();
		const next = index !== null && index >= 0 && index < els.length ? index : null;
		this.selectedBoardColumn = next;
		els.forEach((el, i) => {
			el.toggleClass('pbl-col-selected', i === next);
			this.stopElOf(el)?.setAttribute('aria-selected', String(i === next));
		});
		if (next === null) {
			// Released with no card taking over: the scroller has no active element.
			if (this.selectedPath === null) this.syncActiveDescendant(null);
			return;
		}
		if (this.selectedPath !== null) {
			this.selectedPath = null;
			this.deselectRows();
		}
		const el = els[next];
		const stop = this.stopElOf(el) ?? el;
		if (!stop.id) stop.id = uniqueElementId('pbl-row');
		this.treeEl.toggleClass('pbl-has-selection', true);
		this.treeEl.setAttribute('aria-activedescendant', stop.id);
		el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	private stopElOf(colEl: HTMLElement): HTMLElement | null {
		return colEl.querySelector<HTMLElement>('.pbl-board-col-stop');
	}

	/**
	 * Re-point the selection at the elements of a fresh render pass — the rows map
	 * was rebuilt, so the tracked element is stale even when the path survived.
	 * Column stops are the caller's to reapply (they live on the board it just
	 * drew), and it does so BEFORE this runs — so a held column is left alone here,
	 * or the resync would strip the active descendant the reapply just set and
	 * assistive tech would lose the board position while the column stayed
	 * visually marked.
	 */
	resyncAfterRender(): void {
		if (this.selectedPath === null && this.selectedBoardColumn !== null) return;
		this.selectedRowEl = this.selectedPath ? this.rows.get(this.selectedPath) ?? null : null;
		this.syncActiveDescendant(this.selectedRowEl);
	}

	/** Only one row is ever selected, so the tracked element is the whole search. */
	private deselectRows(): void {
		const row = this.selectedRowEl;
		this.selectedRowEl = null;
		if (!row) return;
		row.classList.remove('pbl-selected');
		row.setAttribute('aria-selected', 'false');
	}

	private syncActiveDescendant(row: HTMLElement | null): void {
		this.treeEl.toggleClass('pbl-has-selection', row !== null);
		if (!row) {
			this.treeEl.removeAttribute('aria-activedescendant');
			return;
		}
		if (!row.id) row.id = uniqueElementId('pbl-row');
		this.treeEl.setAttribute('aria-activedescendant', row.id);
	}
}
