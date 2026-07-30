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

	const pickBtn = iconButton(barEl, 'chevron-down', 'New item of another type');
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

	barEl.createDiv({ cls: 'pbl-toolbar-sep' });
	iconButton(barEl, 'sparkles', 'Assign missing type and order properties').addEventListener('click', () => {
		void runInit(host);
	});
	collapseButton(host, barEl, 'chevrons-up-down', 'Expand all', () => {
		for (const item of model.items) host.setCollapsed(item.file.path, false);
	});
	collapseButton(host, barEl, 'chevrons-down-up', 'Collapse all', () => {
		for (const item of model.items) {
			if (item.children.length > 0) host.setCollapsed(item.file.path, true);
		}
	});

	renderFilterBox(host, barEl);
	renderFocusChip(host, barEl, model);

	barEl.createDiv({ cls: 'pbl-toolbar-spacer' });
	if (host.groupingIgnored) {
		const note = barEl.createDiv({ cls: 'pbl-grouping-note' });
		setIcon(note.createSpan({ cls: 'pbl-grouping-note-icon' }), 'info');
		note.createSpan({ text: 'Grouping ignored' });
		setTooltip(note, 'The hierarchy is the grouping — the group by setting has no effect in this view.');
	}
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		const warn = barEl.createDiv({ cls: 'pbl-config-warning', attr: { 'aria-label': problems.join(' ') } });
		setIcon(warn.createSpan({ cls: 'pbl-warning-icon' }), 'alert-triangle');
		warn.createSpan({ text: 'Check view options' });
		setTooltip(warn, problems.join(' '));
	}
	const count = model.items.length;
	const countEl = barEl.createSpan({
		cls: 'pbl-count-label',
		text: `${count} item${count === 1 ? '' : 's'}`,
		attr: { 'aria-live': 'polite' },
	});
	setTooltip(countEl, levelBreakdown(host, model));
}

/** Type-to-filter box; matches keep their ancestors and subtrees visible. */
function renderFilterBox(host: BacklogViewHost, barEl: HTMLElement): void {
	const filterEl = barEl.createDiv({ cls: 'pbl-filter' });
	setIcon(filterEl.createSpan({ cls: 'pbl-filter-icon' }), 'search');
	setTooltip(filterEl, 'Filter items — press / in the tree');
	const input = filterEl.createEl('input', {
		cls: 'pbl-filter-input',
		attr: { type: 'text', placeholder: 'Filter items', 'aria-label': 'Filter items' },
	});
	input.value = host.filterText;
	// setFilter re-renders the tree and syncs this box's active state.
	const clear = () => {
		host.setFilter('');
		input.focus();
	};
	filterEl.toggleClass('pbl-filter-active', input.value !== '');
	input.addEventListener('input', () => host.setFilter(input.value));
	input.addEventListener('keydown', (evt) => {
		if (evt.key === 'Escape' && input.value !== '') {
			evt.preventDefault();
			evt.stopPropagation();
			clear();
		}
	});
	const clearBtn = filterEl.createDiv({
		cls: 'pbl-filter-clear clickable-icon',
		attr: { 'aria-label': 'Clear filter' },
	});
	setIcon(clearBtn, 'x');
	setTooltip(clearBtn, 'Clear filter');
	clearBtn.addEventListener('click', clear);
}

/** Visible cue (with an exit) that a focus level is narrowing the tree. */
function renderFocusChip(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	if (!model.focused || !host.settings.focusLevel) return;
	const chip = barEl.createDiv({ cls: 'pbl-focus-chip' });
	setIcon(chip.createSpan({ cls: 'pbl-focus-chip-icon' }), 'filter');
	chip.createSpan({ text: `Focus: ${newItemLevel(host.settings, model)}` });
	const clear = chip.createDiv({
		cls: 'pbl-focus-clear clickable-icon',
		attr: { 'aria-label': 'Show all levels' },
	});
	setIcon(clear, 'x');
	setTooltip(clear, 'Show all levels');
	// Bases persists the change and refreshes the view with the full hierarchy.
	clear.addEventListener('click', () => host.config.set('focusLevel', ''));
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

function iconButton(parent: HTMLElement, icon: string, label: string): HTMLElement {
	const btn = parent.createDiv({ cls: 'clickable-icon pbl-icon-btn', attr: { 'aria-label': label } });
	setIcon(btn, icon);
	setTooltip(btn, label);
	return btn;
}

/** Expand/collapse toolbar buttons — inert while a filter overrides collapse state. */
function collapseButton(
	host: BacklogViewHost,
	parent: HTMLElement,
	icon: string,
	label: string,
	mutate: () => void,
): void {
	const btn = iconButton(parent, icon, label);
	btn.addClass('pbl-collapse-ctl');
	btn.addEventListener('click', () => {
		mutate();
		host.persistCollapsedState();
		host.render();
	});
}
