import { Menu, MenuItem } from 'obsidian';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from '../host';
import { BacklogItem, BacklogModel } from '../model';
import { indent, moveToEdge, moveWithinSiblings, outdent } from './structure';
import { promptCreateItem } from './create';

/** Context menu for a backlog row. */
export function showItemMenu(host: BacklogViewHost, evt: MouseEvent, item: BacklogItem, childLevel: string): void {
	evt.preventDefault();
	const model = host.model;
	if (!model) return;
	const menu = new Menu();

	menu.addItem((mi) =>
		mi
			.setTitle(`New ${childLevel}`)
			.setIcon('plus')
			.onClick(() => promptCreateItem(host, childLevel, item)),
	);
	addSetTypeMenu(host, menu, item);
	menu.addSeparator();

	addMoveSection(host, menu, item, model);
	if (!item.parent && item.hasParentValue) {
		// Top-level item whose parent property points outside the view (or was
		// part of a cycle): offer an explicit way to drop the stale link.
		menu.addItem((mi) =>
			mi
				.setTitle('Clear parent link')
				.setIcon('unlink')
				.onClick(() => void host.applySafely([{ file: item.file, parent: null }])),
		);
	}
	menu.addSeparator();
	menu.addItem((mi) =>
		mi
			.setTitle('Open in new tab')
			.setIcon('file-plus')
			.onClick(() => host.openItemInNewTab(item)),
	);

	host.app.workspace.trigger('file-menu', menu, item.file, PRODUCT_BACKLOG_VIEW_TYPE);
	menu.showAtMouseEvent(evt);
}

function addMoveSection(host: BacklogViewHost, menu: Menu, item: BacklogItem, model: BacklogModel): void {
	// The top row of a focused view has no shared sibling ranking to move within.
	if (item.focusRoot) return;
	const siblingList = item.parent ? item.parent.children : model.roots;
	const idx = siblingList.indexOf(item);

	if (idx > 0) {
		menu.addItem((mi) =>
			mi.setTitle('Move up').setIcon('arrow-up').onClick(() => moveWithinSiblings(host, item, -1)),
		);
		menu.addItem((mi) =>
			mi
				.setTitle(`Indent under "${siblingList[idx - 1].title}"`)
				.setIcon('indent-increase')
				.onClick(() => indent(host, item)),
		);
	}
	if (idx >= 0 && idx < siblingList.length - 1) {
		menu.addItem((mi) =>
			mi.setTitle('Move down').setIcon('arrow-down').onClick(() => moveWithinSiblings(host, item, 1)),
		);
	}
	if (idx > 0) {
		menu.addItem((mi) =>
			mi.setTitle('Move to top').setIcon('arrow-up-to-line').onClick(() => moveToEdge(host, item, 'top')),
		);
	}
	if (idx >= 0 && idx < siblingList.length - 1) {
		menu.addItem((mi) =>
			mi
				.setTitle('Move to bottom')
				.setIcon('arrow-down-to-line')
				.onClick(() => moveToEdge(host, item, 'bottom')),
		);
	}
	if (item.parent) {
		menu.addItem((mi) => mi.setTitle('Outdent').setIcon('indent-decrease').onClick(() => outdent(host, item)));
	}
}

function addSetTypeMenu(host: BacklogViewHost, menu: Menu, item: BacklogItem): void {
	const apply = (level: string) => {
		void host.applySafely([{ file: item.file, typeName: level }]);
	};
	menu.addItem((mi) => {
		mi.setTitle('Set type').setIcon('tag');
		const withSubmenu = mi as MenuItem & { setSubmenu?: () => Menu };
		if (typeof withSubmenu.setSubmenu === 'function') {
			const submenu = withSubmenu.setSubmenu();
			for (const level of host.settings.levels) {
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
				const current = host.settings.levels.findIndex(
					(l) => item.typeName !== null && l.toLowerCase() === item.typeName.toLowerCase(),
				);
				apply(host.settings.levels[(current + 1) % host.settings.levels.length]);
			});
		}
	});
}
