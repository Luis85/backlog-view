import { dropTargetFor, zoneForRatio } from '../../domain/dropTargets';
import { projectionMember } from '../projection';
import { DropZone } from '../../domain/dropTargets';
import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel } from '../../domain/model';

export interface DragDropElements {
	viewEl: HTMLElement;
	treeEl: HTMLElement;
}

/**
 * Owns all transient drag state: the dragged path, drop indicators and the
 * hover-to-expand timer. Drop targets themselves are computed by the pure
 * functions in dropTargets.ts.
 */
export class DragDropController {
	private readonly host: BacklogViewHost;
	private readonly els: DragDropElements;
	private draggedPath: string | null = null;
	private dragSourceRow: HTMLElement | null = null;
	private activeDropRow: HTMLElement | null = null;
	private hoverExpand: { path: string; timer: number; row: HTMLElement } | null = null;

	constructor(host: BacklogViewHost, els: DragDropElements) {
		this.host = host;
		this.els = els;
		this.wireTree(els.treeEl);
	}

	/**
	 * The tree's drag handlers, wired ONCE on the pane rather than once per row — a
	 * listener set per row was rebuilt on every data update, and the measurement that
	 * retired it is in `docs/bugs/The render is the whole cost of a data update.md`.
	 * Both ends of the gesture are resolved at EVENT time: the dragged item was already
	 * looked up per event (`dragContext`, for the mid-drag refresh), and the row under
	 * the cursor now is too (`rowTarget`), so expansion state and the item itself are
	 * always the current model's. There is no delegated `dragend`: the document listener
	 * the view registers already hears every one, including from a row detached
	 * mid-drag — the per-row copy this replaces made each cleanup run twice.
	 */
	private wireTree(treeEl: HTMLElement): void {
		treeEl.addEventListener('dragstart', (evt) => {
			const target = this.rowTarget(evt);
			// The render's own statement of what may be picked up: `renderItem` sets
			// `draggable` false while filtering and on a context row, and reading it back
			// keeps this one rule theirs rather than restating it here.
			if (!target || !target.row.draggable) return;
			this.draggedPath = target.item.file.path;
			if (evt.dataTransfer) {
				evt.dataTransfer.setData('text/plain', target.item.file.path);
				evt.dataTransfer.effectAllowed = 'move';
			}
			this.els.viewEl.addClass('pbl-dragging');
			target.row.addClass('pbl-drag-source');
			this.dragSourceRow = target.row;
		});

		treeEl.addEventListener('dragover', (evt) => {
			const target = this.rowTarget(evt);
			if (!target) return;
			const { row, item } = target;
			const drag = this.dragContext();
			if (!drag || drag.dragged === item) {
				this.setDropIndicator(row, null);
				return;
			}
			const zone = this.zoneFor(evt, row, this.hasVisibleChildren(item));
			const dropTarget = dropTargetFor(drag.model, item, zone, drag.dragged, projectionMember(this.host.projection));
			if (!dropTarget) {
				this.setDropIndicator(row, null);
				return;
			}
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
			this.setDropIndicator(row, zone);
			const collapsed = this.host.isCollapsed(item.file.path);
			if (zone === 'inside' && this.hasVisibleChildren(item) && collapsed) this.scheduleHoverExpand(row, item);
			else if (this.hoverExpand?.path === item.file.path) this.cancelHoverExpand();
		});

		treeEl.addEventListener('dragleave', (evt) => {
			const target = this.rowTarget(evt);
			if (!target) return;
			if (evt.relatedTarget instanceof Node && target.row.contains(evt.relatedTarget)) return;
			if (this.activeDropRow === target.row) this.setDropIndicator(target.row, null);
			if (this.hoverExpand?.path === target.item.file.path) this.cancelHoverExpand();
		});

		treeEl.addEventListener('drop', (evt) => {
			const target = this.rowTarget(evt);
			if (!target) return;
			evt.preventDefault();
			evt.stopPropagation();
			const drag = this.dragContext();
			const zone = this.zoneFor(evt, target.row, this.hasVisibleChildren(target.item));
			const dropTarget =
				drag && drag.dragged !== target.item
					? dropTargetFor(drag.model, target.item, zone, drag.dragged, projectionMember(this.host.projection))
					: null;
			this.clearDragState();
			if (drag && dropTarget) void this.host.performDrop(drag.dragged, dropTarget);
		});
	}

	/**
	 * The row an event landed on and the item it is about, or null anywhere else —
	 * `.pbl-row` is the tree's alone (cards are `.pbl-card`), so a card projection's
	 * native drags, bubbling through the same pane, resolve nothing here and pass by.
	 */
	private rowTarget(evt: Event): { row: HTMLElement; item: BacklogItem } | null {
		const row = evt.target instanceof Element ? evt.target.closest('.pbl-row') : null;
		if (!(row instanceof HTMLElement) || !row.dataset.path) return null;
		const item = this.host.model?.byPath.get(row.dataset.path);
		return item ? { row, item } : null;
	}

	/** Read live on every ask — a targeted subtree refresh changes it with no drag event between. */
	private hasVisibleChildren(item: BacklogItem): boolean {
		return item.children.some((child) => !this.host.isRowHidden(child));
	}

	/** Rows are about to be rebuilt; drop the references to the old indicator and source rows. */
	onRenderStart(): void {
		this.activeDropRow = null;
		this.dragSourceRow = null;
	}

	clearDragState(): void {
		this.draggedPath = null;
		this.els.viewEl.removeClass('pbl-dragging');
		this.cancelHoverExpand();
		if (this.activeDropRow) {
			this.activeDropRow.classList.remove('pbl-drop-before', 'pbl-drop-after', 'pbl-drop-inside');
			this.activeDropRow = null;
		}
		if (this.dragSourceRow) {
			this.dragSourceRow.classList.remove('pbl-drag-source');
			this.dragSourceRow = null;
		}
	}

	dispose(): void {
		this.cancelHoverExpand();
	}

	private zoneFor(evt: DragEvent, row: HTMLElement, hasChildren: boolean): DropZone {
		const rect = row.getBoundingClientRect();
		const ratio = rect.height > 0 ? (evt.clientY - rect.top) / rect.height : 0.5;
		return zoneForRatio(ratio, !hasChildren);
	}

	/**
	 * The drag in flight, with the model it is happening in — one lookup, so no call
	 * site has to re-check a model it already knows is there. The dragged path outlives
	 * the model it was taken from (a refresh mid-drag can drop the note entirely), which
	 * is why the item is looked up on every event rather than captured at dragstart.
	 */
	private dragContext(): { dragged: BacklogItem; model: BacklogModel } | null {
		const model = this.host.model;
		if (!model || !this.draggedPath) return null;
		const dragged = model.byPath.get(this.draggedPath);
		return dragged ? { dragged, model } : null;
	}

	private setDropIndicator(row: HTMLElement, zone: DropZone | null): void {
		if (this.activeDropRow && this.activeDropRow !== row) {
			this.activeDropRow.classList.remove('pbl-drop-before', 'pbl-drop-after', 'pbl-drop-inside');
		}
		this.activeDropRow = zone ? row : null;
		row.classList.toggle('pbl-drop-before', zone === 'before');
		row.classList.toggle('pbl-drop-after', zone === 'after');
		row.classList.toggle('pbl-drop-inside', zone === 'inside');
	}

	private scheduleHoverExpand(row: HTMLElement, item: BacklogItem): void {
		const path = item.file.path;
		if (this.hoverExpand?.path === path) return;
		this.cancelHoverExpand();
		// The chevron animates while the timer runs — "keep hovering to expand".
		row.addClass('pbl-hover-expanding');
		const timer = window.setTimeout(() => {
			this.hoverExpand = null;
			row.removeClass('pbl-hover-expanding');
			if (this.host.setCollapsed(path, false)) {
				this.host.refreshSubtree(item);
			}
		}, 600);
		this.hoverExpand = { path, timer, row };
	}

	private cancelHoverExpand(): void {
		if (this.hoverExpand) {
			window.clearTimeout(this.hoverExpand.timer);
			this.hoverExpand.row.removeClass('pbl-hover-expanding');
			this.hoverExpand = null;
		}
	}
}
