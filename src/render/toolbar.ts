import { Menu, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { newItemLevel, promptCreateItem } from '../interactions/create';
import { runInit } from '../interactions/structure';
import { BacklogModel, displayType } from '../model';
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

	renderFilterBox(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-spacer' });
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		const warn = barEl.createDiv({ cls: 'pbl-config-warning', attr: { 'aria-label': problems.join(' ') } });
		setIcon(warn.createSpan({ cls: 'pbl-warning-icon' }), 'alert-triangle');
		warn.createSpan({ text: 'Check view options' });
		setTooltip(warn, problems.join(' '));
	}
	const count = model.items.length;
	const countEl = barEl.createSpan({ cls: 'pbl-count-label', text: `${count} item${count === 1 ? '' : 's'}` });
	setTooltip(countEl, levelBreakdown(host, model));
}

/** Type-to-filter box; matches keep their ancestors and subtrees visible. */
function renderFilterBox(host: BacklogViewHost, barEl: HTMLElement): void {
	const filterEl = barEl.createDiv({ cls: 'pbl-filter' });
	setIcon(filterEl.createSpan({ cls: 'pbl-filter-icon' }), 'search');
	const input = filterEl.createEl('input', {
		cls: 'pbl-filter-input',
		attr: { type: 'text', placeholder: 'Filter items', 'aria-label': 'Filter items' },
	});
	input.value = host.filterText;
	input.addEventListener('input', () => host.setFilter(input.value));
	input.addEventListener('keydown', (evt) => {
		if (evt.key === 'Escape' && input.value !== '') {
			evt.preventDefault();
			evt.stopPropagation();
			input.value = '';
			host.setFilter('');
		}
	});
}

/** e.g. "2 Epic · 4 Feature · 9 PBI" for the item-count tooltip. */
function levelBreakdown(host: BacklogViewHost, model: BacklogModel): string {
	const byLevel = new Map<string, number>();
	for (const item of model.items) {
		const label = displayType(item, host.settings) || 'Untyped';
		byLevel.set(label, (byLevel.get(label) ?? 0) + 1);
	}
	return [...byLevel].map(([label, n]) => `${n} ${label}`).join(' · ');
}

function iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLElement {
	const btn = parent.createDiv({ cls: 'clickable-icon pbl-icon-btn', attr: { 'aria-label': label } });
	setIcon(btn, icon);
	setTooltip(btn, label);
	btn.addEventListener('click', onClick);
	return btn;
}
