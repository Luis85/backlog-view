import { dropTargetFor, rootDropTarget, zoneForRatio } from '../dropTargets';
import { BacklogViewHost, DropZone } from '../host';
import { BacklogItem } from '../model';

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
	private activeDropRow: HTMLElement | null = null;
	private hoverExpand: { path: string; timer: number; row: HTMLElement } | null = null;

	constructor(host: BacklogViewHost, els: DragDropElements) {
		this.host = host;
		this.els = els;
	}

	/** Wire the drag handlers of one rendered row. */
	wireRow(row: HTMLElement, item: BacklogItem, hasChildren: boolean, collapsed: boolean): void {
		row.addEventListener('dragstart', (evt) => {
			this.draggedPath = item.file.path;
			if (evt.dataTransfer) {
				evt.dataTransfer.setData('text/plain', item.file.path);
				evt.dataTransfer.effectAllowed = 'move';
			}
			this.els.viewEl.addClass('pbl-dragging');
			row.addClass('pbl-drag-source');
		});

		row.addEventListener('dragover', (evt) => {
			const dragged = this.getDraggedItem();
			if (!dragged || dragged === item) {
				this.setDropIndicator(row, null);
				return;
			}
			const zone = this.zoneFor(evt, row, hasChildren);
			const target = this.host.model ? dropTargetFor(this.host.model, item, zone, dragged) : null;
			if (!target) {
				this.setDropIndicator(row, null);
				return;
			}
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
			this.setDropIndicator(row, zone);
			if (zone === 'inside' && hasChildren && collapsed) this.scheduleHoverExpand(row, item.file.path);
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
			const dragged = this.getDraggedItem();
			const zone = this.zoneFor(evt, row, hasChildren);
			const target =
				dragged && dragged !== item && this.host.model
					? dropTargetFor(this.host.model, item, zone, dragged)
					: null;
			this.clearDragState();
			if (dragged && target) void this.host.performDrop(dragged, target);
		});

		row.addEventListener('dragend', () => this.clearDragState());
	}

	/** Wire the persistent "Move to top level" strip and the tree background. */
	setupRootDropZone(): void {
		const handleOver = (evt: DragEvent, hover: (on: boolean) => void) => {
			const dragged = this.getDraggedItem();
			const target = dragged && this.host.model ? rootDropTarget(this.host.model, dragged) : null;
			if (!dragged || !target) return null;
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
			hover(true);
			return { dragged, target };
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
			const dragged = this.getDraggedItem();
			if (!dragged || !this.host.model || !rootDropTarget(this.host.model, dragged)) return;
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
		});
		this.els.treeEl.addEventListener('drop', (evt) => {
			if (evt.target !== this.els.treeEl) return;
			evt.preventDefault();
			const dragged = this.getDraggedItem();
			const target = dragged && this.host.model ? rootDropTarget(this.host.model, dragged) : null;
			this.clearDragState();
			if (dragged && target) void this.host.performDrop(dragged, target);
		});
	}

	/** Rows are about to be rebuilt; drop the reference to the old indicator row. */
	onRenderStart(): void {
		this.activeDropRow = null;
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
		this.els.treeEl.querySelectorAll('.pbl-drag-source').forEach((el) => el.classList.remove('pbl-drag-source'));
	}

	dispose(): void {
		this.cancelHoverExpand();
	}

	private zoneFor(evt: DragEvent, row: HTMLElement, hasChildren: boolean): DropZone {
		const rect = row.getBoundingClientRect();
		const ratio = rect.height > 0 ? (evt.clientY - rect.top) / rect.height : 0.5;
		return zoneForRatio(ratio, !hasChildren);
	}

	private getDraggedItem(): BacklogItem | null {
		if (!this.draggedPath || !this.host.model) return null;
		return this.host.model.byPath.get(this.draggedPath) ?? null;
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

	private scheduleHoverExpand(row: HTMLElement, path: string): void {
		if (this.hoverExpand?.path === path) return;
		this.cancelHoverExpand();
		// The chevron animates while the timer runs — "keep hovering to expand".
		row.addClass('pbl-hover-expanding');
		const timer = window.setTimeout(() => {
			this.hoverExpand = null;
			row.removeClass('pbl-hover-expanding');
			if (this.host.setCollapsed(path, false)) {
				this.host.persistCollapsedState();
				this.host.render();
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
