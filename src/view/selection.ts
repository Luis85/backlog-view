import { BacklogItem } from '../domain/model';

/** Source of unique element ids for aria-activedescendant, shared across view instances. */
let selectionIdCounter = 0;

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
		if (!stop.id) stop.id = `pbl-row-${++selectionIdCounter}`;
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
		if (!row.id) row.id = `pbl-row-${++selectionIdCounter}`;
		this.treeEl.setAttribute('aria-activedescendant', row.id);
	}
}
