import {
	BasesPropertyId,
	BasesView,
	Keymap,
	Menu,
	MenuItem,
	Notice,
	NullValue,
	QueryController,
	setIcon,
	setTooltip,
} from 'obsidian';
import { TitlePromptModal } from './modal';
import { BacklogItem, BacklogModel, buildModel, displayType } from './model';
import {
	applyWrites,
	computeDropWrites,
	computeInitWrites,
	createBacklogItem,
	DropTarget,
	ItemWrite,
	ORDER_SPACING,
} from './ops';
import { BacklogSettings, defaultSettings, levelForDepth, resolveSettings } from './settings';

export const PRODUCT_BACKLOG_VIEW_TYPE = 'product-backlog';

const BADGE_COLOR_COUNT = 8;
type DropZone = 'before' | 'after' | 'inside';

export class ProductBacklogView extends BasesView {
	type = PRODUCT_BACKLOG_VIEW_TYPE;

	private viewEl: HTMLElement;
	private toolbarEl: HTMLElement;
	private treeEl: HTMLElement;
	private rootDropEl: HTMLElement;

	private settings: BacklogSettings = defaultSettings();
	private model: BacklogModel | null = null;
	private collapsedPaths = new Set<string>();

	private draggedPath: string | null = null;
	private activeDropRow: HTMLElement | null = null;
	private hoverExpand: { path: string; timer: number } | null = null;
	private applying = false;

	constructor(controller: QueryController, containerEl: HTMLElement) {
		super(controller);
		this.viewEl = containerEl.createDiv({ cls: 'pbl-view' });
		this.toolbarEl = this.viewEl.createDiv({ cls: 'pbl-toolbar' });
		this.treeEl = this.viewEl.createDiv({ cls: 'pbl-tree' });
		this.rootDropEl = this.viewEl.createDiv({ cls: 'pbl-root-drop' });
		setIcon(this.rootDropEl.createSpan({ cls: 'pbl-root-drop-icon' }), 'corner-left-up');
		this.rootDropEl.createSpan({ text: 'Move to top level' });

		this.setupRootDropZone();
		this.registerDomEvent(document, 'dragend', () => this.clearDragState());
	}

	onunload(): void {
		this.cancelHoverExpand();
		this.viewEl.detach();
	}

	onDataUpdated(): void {
		this.settings = resolveSettings(this.config);
		this.model = buildModel(this.app, this.data?.data ?? [], this.settings);
		this.render();
	}

	// ------------------------------------------------------------------ render

	private render(): void {
		const model = this.model;
		if (!model) return;
		this.activeDropRow = null;

		this.renderToolbar(model);

		const scrollTop = this.treeEl.scrollTop;
		this.treeEl.empty();
		if (model.items.length === 0) {
			this.renderEmptyState();
		} else {
			for (const root of model.roots) this.renderItem(this.treeEl, root);
		}
		this.treeEl.scrollTop = scrollTop;
	}

	private renderToolbar(model: BacklogModel): void {
		const bar = this.toolbarEl;
		bar.empty();

		const topLevel = this.settings.levels[0];
		const newBtn = bar.createEl('button', { cls: 'pbl-new-btn' });
		setIcon(newBtn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
		newBtn.createSpan({ text: `New ${topLevel}` });
		newBtn.addEventListener('click', () => this.promptCreate(topLevel, null));

		this.iconButton(bar, 'sparkles', 'Assign missing type and order properties', () => {
			void this.runInit();
		});
		this.iconButton(bar, 'chevrons-up-down', 'Expand all', () => {
			this.collapsedPaths.clear();
			this.render();
		});
		this.iconButton(bar, 'chevrons-down-up', 'Collapse all', () => {
			for (const item of model.items) {
				if (item.children.length > 0) this.collapsedPaths.add(item.file.path);
			}
			this.render();
		});

		bar.createDiv({ cls: 'pbl-toolbar-spacer' });
		const count = model.items.length;
		bar.createSpan({ cls: 'pbl-count-label', text: `${count} item${count === 1 ? '' : 's'}` });
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLElement {
		const btn = parent.createDiv({ cls: 'clickable-icon pbl-icon-btn', attr: { 'aria-label': label } });
		setIcon(btn, icon);
		setTooltip(btn, label);
		btn.addEventListener('click', onClick);
		return btn;
	}

	private renderEmptyState(): void {
		const topLevel = this.settings.levels[0];
		const empty = this.treeEl.createDiv({ cls: 'pbl-empty' });
		setIcon(empty.createDiv({ cls: 'pbl-empty-icon' }), 'list-tree');
		empty.createDiv({ cls: 'pbl-empty-title', text: 'No backlog items' });
		empty.createDiv({
			cls: 'pbl-empty-hint',
			text: `Point this Base's filter at your backlog folder, then create your first ${topLevel}. New items automatically get the parent, order and type properties this view needs.`,
		});
		const btn = empty.createEl('button', { cls: 'mod-cta' });
		setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
		btn.createSpan({ text: `New ${topLevel}` });
		btn.addEventListener('click', () => this.promptCreate(topLevel, null));
	}

	private renderItem(containerEl: HTMLElement, item: BacklogItem): void {
		const hasChildren = item.children.length > 0;
		const collapsed = this.collapsedPaths.has(item.file.path);
		const childLevel = levelForDepth(this.settings.levels, item.depth + 1);

		const row = containerEl.createDiv({ cls: 'pbl-row' });
		row.style.setProperty('--pbl-depth', String(item.depth));
		row.dataset.path = item.file.path;
		row.draggable = true;

		const grip = row.createDiv({ cls: 'pbl-grip' });
		setIcon(grip, 'grip-vertical');

		const chevron = row.createDiv({ cls: 'pbl-chevron' + (hasChildren ? '' : ' pbl-leaf') });
		if (hasChildren) {
			setIcon(chevron, 'chevron-right');
			chevron.toggleClass('pbl-expanded', !collapsed);
			chevron.addEventListener('click', (evt) => {
				evt.stopPropagation();
				this.toggleCollapsed(item);
			});
		}

		const badgeText = displayType(item, this.settings);
		if (badgeText) {
			const badge = row.createSpan({ cls: 'pbl-badge', text: badgeText });
			if (item.levelIndex >= 0) badge.addClass(`pbl-lvl-${item.levelIndex % BADGE_COLOR_COUNT}`);
			else badge.addClass('pbl-lvl-unknown');
			if (item.impliedType) {
				badge.addClass('pbl-implied');
				setTooltip(badge, 'Type property not set — level implied from position. Use "Assign missing properties" to write it.');
			}
		}

		const title = row.createSpan({ cls: 'pbl-title', text: item.title });
		title.addEventListener('mouseover', (evt) => {
			this.app.workspace.trigger('hover-link', {
				event: evt,
				source: PRODUCT_BACKLOG_VIEW_TYPE,
				hoverParent: this.app.renderContext,
				targetEl: title,
				linktext: item.file.path,
				sourcePath: item.file.path,
			});
		});

		if (item.orphan) {
			const orphan = row.createSpan({ cls: 'pbl-orphan' });
			setIcon(orphan, 'unlink');
			setTooltip(orphan, 'Parent is set but not part of this view');
		}

		const chips = row.createDiv({ cls: 'pbl-chips' });
		if (this.settings.showChips) this.renderChips(chips, item);
		chips.addEventListener('click', (evt) => evt.stopPropagation());

		if (this.settings.showCounts && item.descendantCount > 0) {
			row.createSpan({ cls: 'pbl-count', text: String(item.descendantCount) });
		}

		const addBtn = row.createDiv({ cls: 'pbl-add clickable-icon', attr: { 'aria-label': `New ${childLevel}` } });
		setIcon(addBtn, 'plus');
		setTooltip(addBtn, `New ${childLevel}`);
		addBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.promptCreate(childLevel, item);
		});

		row.addEventListener('click', (evt) => {
			void this.app.workspace.getLeaf(Keymap.isModEvent(evt)).openFile(item.file);
		});
		row.addEventListener('auxclick', (evt) => {
			if (evt.button === 1) void this.app.workspace.getLeaf('tab').openFile(item.file);
		});
		row.addEventListener('contextmenu', (evt) => this.showItemMenu(evt, item, childLevel));

		this.setupRowDragAndDrop(row, item, hasChildren, collapsed);

		if (hasChildren && !collapsed) {
			const childrenEl = containerEl.createDiv({ cls: 'pbl-children' });
			for (const child of item.children) this.renderItem(childrenEl, child);
		}
	}

	private renderChips(containerEl: HTMLElement, item: BacklogItem): void {
		let props: BasesPropertyId[] = [];
		try {
			props = this.config.getOrder();
		} catch (e) {
			return;
		}
		const skip = new Set<string>([
			'file.name',
			`note.${this.settings.parentKey}`,
			`note.${this.settings.orderKey}`,
			`note.${this.settings.typeKey}`,
		]);
		for (const prop of props) {
			if (skip.has(prop)) continue;
			let value = null;
			try {
				value = item.entry.getValue(prop);
			} catch (e) {
				continue;
			}
			if (value === null || value instanceof NullValue) continue;
			const text = value.toString();
			const chip = containerEl.createDiv({ cls: 'pbl-chip' });
			let label = prop.substring(prop.indexOf('.') + 1);
			try {
				label = this.config.getDisplayName(prop);
			} catch (e) {
				// keep the raw property name
			}
			chip.createSpan({ cls: 'pbl-chip-label', text: label });
			const valueEl = chip.createSpan({ cls: 'pbl-chip-value' });
			try {
				value.renderTo(valueEl, this.app.renderContext);
			} catch (e) {
				valueEl.setText(text);
			}
			if (valueEl.textContent?.trim() === '' && text.trim() === '') chip.detach();
		}
	}

	// ------------------------------------------------------------ interactions

	private toggleCollapsed(item: BacklogItem): void {
		if (this.collapsedPaths.has(item.file.path)) this.collapsedPaths.delete(item.file.path);
		else this.collapsedPaths.add(item.file.path);
		this.render();
	}

	private showItemMenu(evt: MouseEvent, item: BacklogItem, childLevel: string): void {
		evt.preventDefault();
		const model = this.model;
		if (!model) return;
		const menu = new Menu();

		menu.addItem((mi) =>
			mi
				.setTitle(`New ${childLevel}`)
				.setIcon('plus')
				.onClick(() => this.promptCreate(childLevel, item)),
		);
		this.addSetTypeMenu(menu, item);
		menu.addSeparator();

		const siblingList = item.parent ? item.parent.children : model.roots;
		const idx = siblingList.indexOf(item);
		if (idx > 0) {
			menu.addItem((mi) =>
				mi.setTitle('Move up').setIcon('arrow-up').onClick(() => this.moveWithinSiblings(item, -1)),
			);
			menu.addItem((mi) =>
				mi
					.setTitle(`Indent under "${siblingList[idx - 1].title}"`)
					.setIcon('indent-increase')
					.onClick(() => this.indent(item)),
			);
		}
		if (idx >= 0 && idx < siblingList.length - 1) {
			menu.addItem((mi) =>
				mi.setTitle('Move down').setIcon('arrow-down').onClick(() => this.moveWithinSiblings(item, 1)),
			);
		}
		if (item.parent) {
			menu.addItem((mi) =>
				mi.setTitle('Outdent').setIcon('indent-decrease').onClick(() => this.outdent(item)),
			);
		}
		menu.addSeparator();
		menu.addItem((mi) =>
			mi
				.setTitle('Open in new tab')
				.setIcon('file-plus')
				.onClick(() => void this.app.workspace.getLeaf('tab').openFile(item.file)),
		);

		this.app.workspace.trigger('file-menu', menu, item.file, PRODUCT_BACKLOG_VIEW_TYPE);
		menu.showAtMouseEvent(evt);
	}

	private addSetTypeMenu(menu: Menu, item: BacklogItem): void {
		const apply = (level: string) => {
			void this.applySafely([{ file: item.file, typeName: level }]);
		};
		menu.addItem((mi) => {
			mi.setTitle('Set type').setIcon('tag');
			const withSubmenu = mi as MenuItem & { setSubmenu?: () => Menu };
			if (typeof withSubmenu.setSubmenu === 'function') {
				const submenu = withSubmenu.setSubmenu();
				for (const level of this.settings.levels) {
					submenu.addItem((si) => {
						si.setTitle(level).onClick(() => apply(level));
						if (item.typeName !== null && item.typeName.toLowerCase() === level.toLowerCase()) {
							si.setChecked(true);
						}
					});
				}
			} else {
				// Older API without submenus: cycle through the configured levels.
				mi.setTitle('Set type: next level');
				mi.onClick(() => {
					const current = this.settings.levels.findIndex(
						(l) => item.typeName !== null && l.toLowerCase() === item.typeName.toLowerCase(),
					);
					apply(this.settings.levels[(current + 1) % this.settings.levels.length]);
				});
			}
		});
	}

	// -------------------------------------------------------------- drag & drop

	private setupRowDragAndDrop(row: HTMLElement, item: BacklogItem, hasChildren: boolean, collapsed: boolean): void {
		row.addEventListener('dragstart', (evt) => {
			this.draggedPath = item.file.path;
			if (evt.dataTransfer) {
				evt.dataTransfer.setData('text/plain', item.file.path);
				evt.dataTransfer.effectAllowed = 'move';
			}
			this.viewEl.addClass('pbl-dragging');
			row.addClass('pbl-drag-source');
		});

		row.addEventListener('dragover', (evt) => {
			const dragged = this.getDraggedItem();
			if (!dragged || dragged === item) {
				this.setDropIndicator(row, null);
				return;
			}
			const zone = this.zoneFor(evt, row);
			const target = this.dropTargetFor(item, zone, dragged);
			if (!target) {
				this.setDropIndicator(row, null);
				return;
			}
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
			this.setDropIndicator(row, zone);
			if (zone === 'inside' && hasChildren && collapsed) this.scheduleHoverExpand(item.file.path);
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
			const zone = this.zoneFor(evt, row);
			const target = dragged && dragged !== item ? this.dropTargetFor(item, zone, dragged) : null;
			this.clearDragState();
			if (dragged && target) void this.performDrop(dragged, target);
		});

		row.addEventListener('dragend', () => this.clearDragState());
	}

	private setupRootDropZone(): void {
		const handleOver = (evt: DragEvent, hover: (on: boolean) => void) => {
			const dragged = this.getDraggedItem();
			const target = dragged ? this.rootDropTarget(dragged) : null;
			if (!dragged || !target) return null;
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
			hover(true);
			return { dragged, target };
		};

		this.rootDropEl.addEventListener('dragover', (evt) => {
			handleOver(evt, (on) => this.rootDropEl.toggleClass('pbl-drop-hover', on));
		});
		this.rootDropEl.addEventListener('dragleave', () => this.rootDropEl.removeClass('pbl-drop-hover'));
		this.rootDropEl.addEventListener('drop', (evt) => {
			const result = handleOver(evt, () => undefined);
			this.clearDragState();
			if (result) void this.performDrop(result.dragged, result.target);
		});

		// Dropping on the empty area below the tree also moves items to the top level.
		this.treeEl.addEventListener('dragover', (evt) => {
			if (evt.target !== this.treeEl) return;
			const dragged = this.getDraggedItem();
			if (!dragged || !this.rootDropTarget(dragged)) return;
			evt.preventDefault();
			if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
		});
		this.treeEl.addEventListener('drop', (evt) => {
			if (evt.target !== this.treeEl) return;
			evt.preventDefault();
			const dragged = this.getDraggedItem();
			const target = dragged ? this.rootDropTarget(dragged) : null;
			this.clearDragState();
			if (dragged && target) void this.performDrop(dragged, target);
		});
	}

	private zoneFor(evt: DragEvent, row: HTMLElement): DropZone {
		const rect = row.getBoundingClientRect();
		const ratio = rect.height > 0 ? (evt.clientY - rect.top) / rect.height : 0.5;
		if (ratio < 0.25) return 'before';
		if (ratio > 0.75) return 'after';
		return 'inside';
	}

	private dropTargetFor(item: BacklogItem, zone: DropZone, dragged: BacklogItem): DropTarget | null {
		const model = this.model;
		if (!model) return null;

		let parent: BacklogItem | null;
		let siblings: BacklogItem[];
		let insertIndex: number;

		if (zone === 'inside') {
			parent = item;
			siblings = item.children.filter((c) => c !== dragged);
			insertIndex = siblings.length;
		} else {
			parent = item.parent;
			const fullList = parent ? parent.children : model.roots;
			siblings = fullList.filter((c) => c !== dragged);
			const idx = siblings.indexOf(item);
			if (idx === -1) return null;
			insertIndex = zone === 'before' ? idx : idx + 1;
		}

		if (this.isInvalidParent(parent, dragged)) return null;

		// Dropping into the slot the item already occupies is a no-op.
		if (parent === dragged.parent) {
			const fullList = parent ? parent.children : model.roots;
			if (fullList.indexOf(dragged) === insertIndex) return null;
		}
		return { parent, siblings, insertIndex };
	}

	private rootDropTarget(dragged: BacklogItem): DropTarget | null {
		const model = this.model;
		if (!model) return null;
		const siblings = model.roots.filter((r) => r !== dragged);
		if (dragged.parent === null && model.roots.indexOf(dragged) === model.roots.length - 1) return null;
		return { parent: null, siblings, insertIndex: siblings.length };
	}

	private isInvalidParent(parent: BacklogItem | null, dragged: BacklogItem): boolean {
		for (let p: BacklogItem | null = parent; p !== null; p = p.parent) {
			if (p === dragged) return true;
		}
		return false;
	}

	private getDraggedItem(): BacklogItem | null {
		if (!this.draggedPath || !this.model) return null;
		return this.model.byPath.get(this.draggedPath) ?? null;
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

	private scheduleHoverExpand(path: string): void {
		if (this.hoverExpand?.path === path) return;
		this.cancelHoverExpand();
		const timer = window.setTimeout(() => {
			this.hoverExpand = null;
			if (this.collapsedPaths.delete(path)) this.render();
		}, 600);
		this.hoverExpand = { path, timer };
	}

	private cancelHoverExpand(): void {
		if (this.hoverExpand) {
			window.clearTimeout(this.hoverExpand.timer);
			this.hoverExpand = null;
		}
	}

	private clearDragState(): void {
		this.draggedPath = null;
		this.viewEl.removeClass('pbl-dragging');
		this.rootDropEl.removeClass('pbl-drop-hover');
		this.cancelHoverExpand();
		if (this.activeDropRow) {
			this.activeDropRow.classList.remove('pbl-drop-before', 'pbl-drop-after', 'pbl-drop-inside');
			this.activeDropRow = null;
		}
		this.treeEl.querySelectorAll('.pbl-drag-source').forEach((el) => el.classList.remove('pbl-drag-source'));
	}

	// ---------------------------------------------------------------- mutations

	private async performDrop(dragged: BacklogItem, target: DropTarget): Promise<void> {
		if (target.parent) this.collapsedPaths.delete(target.parent.file.path);
		const writes = computeDropWrites(dragged, target, this.settings);
		await this.applySafely(writes);
	}

	private moveWithinSiblings(item: BacklogItem, delta: -1 | 1): void {
		const model = this.model;
		if (!model) return;
		const fullList = item.parent ? item.parent.children : model.roots;
		const idx = fullList.indexOf(item);
		if (idx === -1) return;
		const insertIndex = delta === -1 ? idx - 1 : idx + 1;
		if (insertIndex < 0 || insertIndex >= fullList.length) return;
		const siblings = fullList.filter((s) => s !== item);
		void this.performDrop(item, { parent: item.parent, siblings, insertIndex });
	}

	private outdent(item: BacklogItem): void {
		const model = this.model;
		const parent = item.parent;
		if (!model || !parent) return;
		const grandparent = parent.parent;
		const fullList = grandparent ? grandparent.children : model.roots;
		const siblings = fullList.filter((s) => s !== item);
		const insertIndex = siblings.indexOf(parent) + 1;
		void this.performDrop(item, { parent: grandparent, siblings, insertIndex });
	}

	private indent(item: BacklogItem): void {
		const model = this.model;
		if (!model) return;
		const fullList = item.parent ? item.parent.children : model.roots;
		const idx = fullList.indexOf(item);
		if (idx <= 0) return;
		const newParent = fullList[idx - 1];
		const siblings = newParent.children.filter((s) => s !== item);
		void this.performDrop(item, { parent: newParent, siblings, insertIndex: siblings.length });
	}

	private async runInit(): Promise<void> {
		const model = this.model;
		if (!model) return;
		const writes = computeInitWrites(model, this.settings);
		if (writes.length === 0) {
			new Notice('All items already have type and order properties.');
			return;
		}
		await this.applySafely(writes);
		new Notice(`Product Backlog: updated ${writes.length} item${writes.length === 1 ? '' : 's'}.`);
	}

	private async applySafely(writes: ItemWrite[]): Promise<void> {
		if (this.applying || writes.length === 0) return;
		this.applying = true;
		try {
			await applyWrites(this.app, this.settings, writes);
		} catch (e) {
			console.error('Product Backlog: failed to update items', e);
			new Notice('Product Backlog: failed to update items. See developer console for details.');
		} finally {
			this.applying = false;
		}
	}

	private promptCreate(levelName: string, parentItem: BacklogItem | null): void {
		new TitlePromptModal(this.app, `New ${levelName}`, (title) => {
			void (async () => {
				if (parentItem) this.collapsedPaths.delete(parentItem.file.path);
				const siblings = parentItem ? parentItem.children : this.model?.roots ?? [];
				let maxOrder = 0;
				for (const s of siblings) {
					if (s.order !== null && s.order > maxOrder) maxOrder = s.order;
				}
				try {
					const file = await createBacklogItem(this.app, this.settings, {
						folder: this.settings.newItemFolder || this.inferFolder(),
						title,
						typeName: levelName,
						parent: parentItem?.file ?? null,
						order: Math.floor(maxOrder) + ORDER_SPACING,
					});
					new Notice(`Created "${file.basename}".`);
				} catch (e) {
					console.error('Product Backlog: failed to create item', e);
					new Notice('Product Backlog: could not create the item. See developer console for details.');
				}
			})();
		}).open();
	}

	/** Without a configured folder, place new items where most existing items live. */
	private inferFolder(): string {
		const counts = new Map<string, number>();
		for (const item of this.model?.items ?? []) {
			const path = item.file.parent?.path ?? '';
			counts.set(path, (counts.get(path) ?? 0) + 1);
		}
		let best = '';
		let bestCount = 0;
		for (const [path, count] of counts) {
			if (count > bestCount) {
				best = path;
				bestCount = count;
			}
		}
		return best === '/' ? '' : best;
	}
}
