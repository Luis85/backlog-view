import { Menu, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { newItemLevel, promptCreateItem } from '../interactions/create';
import { runInit } from '../interactions/structure';
import { configProblems } from '../settings';

/** Toolbar: creation buttons, backfill, expand/collapse, config warning, item count. */
export function renderToolbar(host: BacklogViewHost, barEl: HTMLElement): void {
	const model = host.model;
	if (!model) return;
	barEl.empty();

	const newLevel = newItemLevel(host.settings, model);
	const newBtn = barEl.createEl('button', { cls: 'pbl-new-btn' });
	setIcon(newBtn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	newBtn.createSpan({ text: `New ${newLevel}` });
	newBtn.addEventListener('click', () => promptCreateItem(host, newLevel, null));

	const pickBtn = iconButton(barEl, 'chevron-down', 'New item of another type', () => undefined);
	pickBtn.addClass('pbl-new-pick');
	pickBtn.addEventListener('click', (evt) => {
		const menu = new Menu();
		for (const level of host.settings.levels) {
			menu.addItem((mi) =>
				mi.setTitle(`New ${level}`).setIcon('plus').onClick(() => promptCreateItem(host, level, null)),
			);
		}
		menu.showAtMouseEvent(evt);
	});

	iconButton(barEl, 'sparkles', 'Assign missing type and order properties', () => {
		void runInit(host);
	});
	iconButton(barEl, 'chevrons-up-down', 'Expand all', () => {
		for (const item of model.items) host.setCollapsed(item.file.path, false);
		host.persistCollapsedState();
		host.render();
	});
	iconButton(barEl, 'chevrons-down-up', 'Collapse all', () => {
		for (const item of model.items) {
			if (item.children.length > 0) host.setCollapsed(item.file.path, true);
		}
		host.persistCollapsedState();
		host.render();
	});

	barEl.createDiv({ cls: 'pbl-toolbar-spacer' });
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		const warn = barEl.createDiv({ cls: 'pbl-config-warning', attr: { 'aria-label': problems.join(' ') } });
		setIcon(warn.createSpan({ cls: 'pbl-warning-icon' }), 'alert-triangle');
		warn.createSpan({ text: 'Check view options' });
		setTooltip(warn, problems.join(' '));
	}
	const count = model.items.length;
	barEl.createSpan({ cls: 'pbl-count-label', text: `${count} item${count === 1 ? '' : 's'}` });
}

function iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLElement {
	const btn = parent.createDiv({ cls: 'clickable-icon pbl-icon-btn', attr: { 'aria-label': label } });
	setIcon(btn, icon);
	setTooltip(btn, label);
	btn.addEventListener('click', onClick);
	return btn;
}
