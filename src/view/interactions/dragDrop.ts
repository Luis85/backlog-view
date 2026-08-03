import { dropTargetFor, rootDropTarget, zoneForRatio } from '../../domain/dropTargets';
import { DropZone } from '../../domain/dropTargets';
import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel } from '../../domain/model';

export interface DragDropElements {
	viewEl: HTMLElement;
	treeEl: HTMLElement;
	rootDropEl: HTMLElement;
}

/**
 * Owns all transient drag state: the dragged path, drop indicators, the
 * hover-to-expand timer and the top-level drop strip. Drop targets themselves
 * are computed by the pure functions in dropTargets.ts.
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
	}

	/**
	 * Wire the drag handlers of one rendered row. Expansion state is read live: an
	 * expand no longer rebuilds the tree, so a value captured here would go stale.
	 */
	wireRow(row: HTMLElement, item: BacklogItem): void {
		const hasChildren = () => item.children.some((child) => !this.host.isRowHidden(child));

		row.addEventListener('dragstart', (evt) => {
			this.draggedPath = item.file.path;
			if (evt.dataTransfer) {
				evt.dataTransfer.setData('text/plain', item.file.path);
				evt.dataTransfer.effectAllowed = 'move';
			}
			this.els.viewEl.addClass('pbl-dragging');
			row.addClass('pbl-drag-source');
			this.dragSourceRow = row;
		});

		row.addEventListener('dragover', (evt) => {
			const drag = this.dragContext();
			if (!drag || drag.dragged === item) {
				this.setDropIndicator(row, null);
				return;
			}
			const zone = this.zoneFor(evt, row, hasChildren());
			const target = dropTargetFor(drag.model, item, zone, drag.dragged);
			if (!target) {
				this.setDropIndicator(row, null);
				return;
			}
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
			this.setDropIndicator(row, zone);
			const collapsed = this.host.isCollapsed(item.file.path);
			if (zone === 'inside' && hasChildren() && collapsed) this.scheduleHoverExpand(row, item);
			else if (this.hoverExpand?.path === item.file.path) this.cancelHoverExpand();
		});

		row.addEventListener('dragleave', (evt) => {
			if (evt.relatedTarget instanceof Node && row.contains(evt.relatedTarget)) return;
			if (this.activeDropRow === row) this.setDropIndicator(row, null);
			if (this.hoverExpand?.path === item.file.path) this.cancelHoverExpand();
		});

		row.addEventListener('drop', (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			const drag = this.dragContext();
			const zone = this.zoneFor(evt, row, hasChildren());
			const target = drag && drag.dragged !== item ? dropTargetFor(drag.model, item, zone, drag.dragged) : null;
			this.clearDragState();
			if (drag && target) void this.host.performDrop(drag.dragged, target);
		});

		row.addEventListener('dragend', () => this.clearDragState());
	}

	/** Wire the persistent "Move to top level" strip and the tree background. */
	setupRootDropZone(): void {
		const handleOver = (evt: DragEvent, hover: (on: boolean) => void) => {
			const drag = this.dragContext();
			const target = drag ? rootDropTarget(drag.model, drag.dragged) : null;
			if (!drag || !target) return null;
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
			hover(true);
			return { dragged: drag.dragged, target };
		};

		this.els.rootDropEl.addEventListener('dragover', (evt) => {
			handleOver(evt, (on) => this.els.rootDropEl.toggleClass('pbl-drop-hover', on));
		});
		this.els.rootDropEl.addEventListener('dragleave', () => this.els.rootDropEl.removeClass('pbl-drop-hover'));
		this.els.rootDropEl.addEventListener('drop', (evt) => {
			const result = handleOver(evt, () => undefined);
			this.clearDragState();
			if (result) void this.host.performDrop(result.dragged, result.target);
		});

		// Dropping on the empty area below the tree also moves items to the top level.
		this.els.treeEl.addEventListener('dragover', (evt) => {
			if (evt.target !== this.els.treeEl) return;
			const drag = this.dragContext();
			if (!drag || !rootDropTarget(drag.model, drag.dragged)) return;
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
		});
		this.els.treeEl.addEventListener('drop', (evt) => {
			if (evt.target !== this.els.treeEl) return;
			evt.preventDefault();
			const drag = this.dragContext();
			const target = drag ? rootDropTarget(drag.model, drag.dragged) : null;
			this.clearDragState();
			if (drag && target) void this.host.performDrop(drag.dragged, target);
		});
	}

	/** Rows are about to be rebuilt; drop the references to the old indicator and source rows. */
	onRenderStart(): void {
		this.activeDropRow = null;
		this.dragSourceRow = null;
	}

	clearDragState(): void {
		this.draggedPath = null;
		this.els.viewEl.removeClass('pbl-dragging');
		this.els.rootDropEl.removeClass('pbl-drop-hover');
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
