import { Menu, MenuItem } from 'obsidian';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from '../host';
import { inferFolderParent } from '../../domain/folderNotes';
import { BacklogItem } from '../../domain/model';
import { computeTypeChanges, ItemWrite } from '../../domain/writePlan';
import { stateMenuValues } from '../../domain/settings';
import { canReorder, indent, moveToEdge, moveWithinSiblings, outdent, outdentTarget, visibleNeighbor } from './structure';
import { promptCreateItem } from './create';

/** Context menu for a backlog row (mouse path). */
export function showItemMenu(host: BacklogViewHost, evt: MouseEvent, item: BacklogItem, childLevel: string): void {
	evt.preventDefault();
	const menu = buildItemMenu(host, item, childLevel);
	menu?.showAtMouseEvent(evt);
}

/** Assemble the row menu; the caller decides where to show it. */
export function buildItemMenu(host: BacklogViewHost, item: BacklogItem, childLevel: string): Menu | null {
	const model = host.model;
	if (!model) return null;
	const menu = new Menu();

	// Creating a child writes a new note, not this one — the one mutation that is
	// still fair game on an ancestor the Base excluded. Everything that would edit
	// the row's own frontmatter is withheld: it is context, not a result.
	const editable = !item.outsideFilter;
	menu.addItem((mi) =>
		mi
			.setTitle(`New ${childLevel}`)
			.setIcon('plus')
			.onClick(() => promptCreateItem(host, childLevel, item)),
	);
	if (editable) {
		addSetTypeMenu(host, menu, item);
		if (host.settings.stateKey) addSetStateMenu(host, menu, item);
	}
	menu.addSeparator();

	addMoveSection(host, menu, item);
	if (editable) addParentLinkSection(host, menu, item);
	menu.addSeparator();
	menu.addItem((mi) =>
		mi
			.setTitle('Open in new tab')
			.setIcon('file-plus')
			.onClick(() => host.openItemInNewTab(item)),
	);
	menu.addItem((mi) =>
		mi
			.setTitle('Open to the right')
			.setIcon('separator-vertical')
			.onClick(() => host.openItemToSide(item)),
	);

	host.app.workspace.trigger('file-menu', menu, item.file, PRODUCT_BACKLOG_VIEW_TYPE);
	return menu;
}

function addParentLinkSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	if (!item.parent && item.hasParentValue) {
		// Top-level item whose parent property points outside the view (or was
		// part of a cycle): remove the stale link. In folder mode the item then
		// returns to its folder position instead of being pinned to the top.
		menu.addItem((mi) =>
			mi
				.setTitle('Clear parent link')
				.setIcon('unlink')
				.onClick(() => void host.applySafely(removeParentWrites(host, item))),
		);
	} else if (host.settings.folderHierarchy && (item.hasParentValue || item.explicitRoot)) {
		// A link override or a top-level pin is hiding the folder position;
		// removing the property hands the item back to folder-note inference.
		menu.addItem((mi) =>
			mi
				.setTitle('Use folder position')
				.setIcon('folder')
				.onClick(() => void host.applySafely(removeParentWrites(host, item))),
		);
	}
}

/**
 * Removing the parent property re-homes the item (folder position or top
 * level); with autoType on it must retype like any other reparenting move.
 */
function removeParentWrites(host: BacklogViewHost, item: BacklogItem): ItemWrite[] {
	const writes: ItemWrite[] = [{ file: item.file, removeParentKey: true }];
	const model = host.model;
	if (!host.settings.autoType || !model) return writes;

	const landingParent = host.settings.folderHierarchy ? inferFolderParent(item, model.byPath) : null;
	const { typeField, cascade } = computeTypeChanges(item, landingParent, host.settings, true);
	if (typeField !== undefined) writes[0].typeName = typeField;
	writes.push(...cascade);
	return writes;
}

function addMoveSection(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	// Gate on rendered neighbors: with completed items hidden, a swap with a
	// hidden sibling would change nothing visibly. Null for a row that cannot move
	// at all — a focus root, or an ancestor loaded from outside the filter.
	const prev = visibleNeighbor(host, item, -1);
	const next = visibleNeighbor(host, item, 1);
	// Only *reordering* renumbers the item's own group, so only reordering needs
	// this. Indent and outdent land the item elsewhere and answer for their own
	// destination — hiding them here would make the menu offer less than Alt+arrow.
	const ranked = canReorder(host, item);

	if (ranked && prev) {
		menu.addItem((mi) =>
			mi.setTitle('Move up').setIcon('arrow-up').onClick(() => moveWithinSiblings(host, item, -1)),
		);
	}
	if (prev) {
		menu.addItem((mi) =>
			mi
				.setTitle(`Indent under "${prev.title}"`)
				.setIcon('indent-increase')
				.onClick(() => indent(host, item)),
		);
	}
	if (ranked && next) {
		menu.addItem((mi) =>
			mi.setTitle('Move down').setIcon('arrow-down').onClick(() => moveWithinSiblings(host, item, 1)),
		);
	}
	if (ranked && prev) {
		menu.addItem((mi) =>
			mi.setTitle('Move to top').setIcon('arrow-up-to-line').onClick(() => moveToEdge(host, item, 'top')),
		);
	}
	if (ranked && next) {
		menu.addItem((mi) =>
			mi
				.setTitle('Move to bottom')
				.setIcon('arrow-down-to-line')
				.onClick(() => moveToEdge(host, item, 'bottom')),
		);
	}
	if (outdentTarget(host, item)) {
		menu.addItem((mi) => mi.setTitle('Outdent').setIcon('indent-decrease').onClick(() => outdent(host, item)));
	}
}

/**
 * Show a menu for a click that may not have come from a pointer. Enter or Space on
 * a focused button synthesizes a click at (0, 0), and anchoring a menu there drops
 * it in the viewport corner instead of beside the control the user is standing on.
 * Every menu opened from a button goes through here.
 */
export function showMenuForClick(menu: Menu, evt: MouseEvent): void {
	const el = evt.currentTarget;
	if (evt.clientX === 0 && evt.clientY === 0 && el instanceof HTMLElement) {
		const rect = el.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
		return;
	}
	menu.showAtMouseEvent(evt);
}

/** State menu for the row's state chip. */
export function showStateMenu(host: BacklogViewHost, evt: MouseEvent, item: BacklogItem): void {
	evt.preventDefault();
	evt.stopPropagation();
	const menu = new Menu();
	addStateItems(host, menu, item);
	showMenuForClick(menu, evt);
}

/**
 * The states this item's menu offers. The item's own value joins the configured
 * or observed list when missing, so the current state can always render checked.
 */
function stateChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	const values = stateMenuValues(host.settings, host.model?.observedStates ?? []);
	const current = item.stateValue;
	if (current !== null && !values.some((v) => v.toLowerCase() === current.toLowerCase())) {
		return [...values, current];
	}
	return values;
}

function addStateItems(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	for (const state of stateChoices(host, item)) {
		menu.addItem((si) => {
			si.setTitle(state).onClick(() => void host.applySafely([{ file: item.file, state }]));
			if (item.stateValue !== null && item.stateValue.toLowerCase() === state.toLowerCase()) {
				si.setChecked(true);
			}
		});
	}
}

/**
 * `setSubmenu` is missing from the published obsidian typings, not from the app:
 * submenus predate the 1.10.2 this plugin requires, so the cast asserts what is
 * always there rather than guarding against its absence.
 */
function submenuOf(item: MenuItem): Menu {
	return (item as MenuItem & { setSubmenu: () => Menu }).setSubmenu();
}

function addSetStateMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) => {
		mi.setTitle('Set state').setIcon('circle-check');
		addStateItems(host, submenuOf(mi), item);
	});
}

function addSetTypeMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	const apply = (level: string) => {
		void host.applySafely([{ file: item.file, typeName: level }]);
	};
	menu.addItem((mi) => {
		mi.setTitle('Set type').setIcon('tag');
		const submenu = submenuOf(mi);
		for (const level of host.settings.levels) {
			submenu.addItem((si) => {
				si.setTitle(level).onClick(() => apply(level));
				if (item.typeName !== null && item.typeName.toLowerCase() === level.toLowerCase()) {
					si.setChecked(true);
				}
			});
		}
	});
}
