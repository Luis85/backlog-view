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
	renderFocusPicker(host, barEl, model);

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
	renderCompletedToggle(host, barEl, model);

	renderFilterBox(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-spacer' });
	if (host.groupingIgnored) {
		const note = barEl.createDiv({ cls: 'pbl-toolbar-note pbl-grouping-note' });
		setIcon(note.createSpan({ cls: 'pbl-toolbar-note-icon' }), 'info');
		note.createSpan({ text: 'Grouping ignored' });
		setTooltip(note, 'The hierarchy is the grouping — the group by setting has no effect in this view.');
	}
	renderIgnoredNote(barEl, model);
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		const warn = barEl.createDiv({ cls: 'pbl-config-warning', attr: { 'aria-label': problems.join(' ') } });
		setIcon(warn.createSpan({ cls: 'pbl-warning-icon' }), 'alert-triangle');
		warn.createSpan({ text: 'Check view options' });
		setTooltip(warn, problems.join(' '));
	}
	// The Base's own results — context ancestors are not items of this base.
	const count = model.results.length;
	const countEl = barEl.createSpan({
		cls: 'pbl-count-label',
		text: `${count} item${count === 1 ? '' : 's'}`,
		attr: { 'aria-live': 'polite' },
	});
	setTooltip(countEl, levelBreakdown(host, model));
}

/**
 * Notes the base returned that aren't backlog items are silently skipped — say so,
 * so a missing note is never a mystery, and point at the option that brings them back.
 */
function renderIgnoredNote(barEl: HTMLElement, model: BacklogModel): void {
	if (model.ignoredCount === 0) return;
	const n = model.ignoredCount;
	const note = barEl.createDiv({ cls: 'pbl-toolbar-note pbl-ignored-note' });
	setIcon(note.createSpan({ cls: 'pbl-toolbar-note-icon' }), 'filter-x');
	note.createSpan({ text: `${n} note${n === 1 ? '' : 's'} ignored` });
	setTooltip(
		note,
		`${n} note${n === 1 ? ' in this base is' : 's in this base are'} not backlog items — no supported type and no parent. Turn off "Ignore notes outside the hierarchy" in the view options to show them.`,
	);
}

/**
 * Eye toggle for the "Show completed items" option — hides fully-done subtrees.
 * Only offered when a state property is configured; Bases persists the option
 * and refreshes the view.
 */
function renderCompletedToggle(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	if (!host.settings.stateKey) return;
	const showing = host.settings.showCompleted;
	const hidden = model.results.filter((item) => item.subtreeDone).length;
	const suffix = hidden > 0 ? ` (${hidden} hidden)` : '';
	const btn = iconButton(barEl, showing ? 'eye' : 'eye-off', showing ? 'Hide completed items' : `Show completed items${suffix}`);
	btn.addClass('pbl-completed-toggle');
	btn.toggleClass('is-active', !showing);
	btn.addEventListener('click', () => host.config.set('showCompleted', !showing));
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

/**
 * Focus level picker — beside the New button, because the focus level is also what
 * that button creates. Doubles as the cue that a level is narrowing the tree: it
 * shows the active level, accented, with a one-click way back to all levels.
 */
function renderFocusPicker(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	// A focus level naming no configured level re-roots nothing — report all levels.
	const active = model.focused ? newItemLevel(host.settings, model) : '';
	const wrap = barEl.createDiv({ cls: 'pbl-focus' });
	wrap.toggleClass('pbl-focus-active', active !== '');
	// Bases persists the change and refreshes the view.
	const setLevel = (level: string) => host.config.set('focusLevel', level);

	const btn = wrap.createEl('button', { cls: 'pbl-focus-btn' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'filter');
	btn.createSpan({ text: active || 'All levels' });
	setTooltip(btn, 'Focus level — show one level as the top of the tree');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		const choice = (level: string, title: string) =>
			menu.addItem((mi) =>
				mi
					.setTitle(title)
					.setChecked(active === level)
					.onClick(() => setLevel(level)),
			);
		choice('', 'All levels');
		for (const level of host.settings.levels) choice(level, level);
		menu.showAtMouseEvent(evt);
	});

	if (active === '') return;
	const clear = wrap.createDiv({
		cls: 'pbl-focus-clear clickable-icon',
		attr: { 'aria-label': 'Show all levels' },
	});
	setIcon(clear, 'x');
	setTooltip(clear, 'Show all levels');
	clear.addEventListener('click', () => setLevel(''));
}

/** e.g. "2 Epic · 4 Feature · 9 PBI" for the item-count tooltip. */
function levelBreakdown(host: BacklogViewHost, model: BacklogModel): string {
	const byLevel = new Map<string, number>();
	for (const item of model.results) {
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
