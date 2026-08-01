import { BasesQueryResult, Menu, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, BusyState } from '../host';
import { newItemType, promptCreateItem } from '../interactions/create';
import { showMenuForClick } from '../interactions/menu';
import { runInit } from '../interactions/structure';
import { BacklogModel } from '../../domain/model';
import { displayType, focusTarget } from '../../domain/itemTypes';
import { ALL_TYPES, EXTRA_TYPES, LEVELS } from '../../domain/settings';
import { configProblems } from '../../domain/settings';

/** Toolbar: creation buttons, backfill, expand/collapse, config warning, item count. */
export function renderToolbar(host: BacklogViewHost, barEl: HTMLElement): void {
	const model = host.model;
	if (!model) return;
	barEl.empty();

	const newLevel = newItemType(host.settings, model);
	const newBtn = barEl.createEl('button', { cls: 'pbl-new-btn' });
	setIcon(newBtn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	newBtn.createSpan({ text: `New ${newLevel}` });
	newBtn.addEventListener('click', () => promptCreateItem(host, [newLevel], null));

	const pickBtn = iconButton(barEl, 'chevron-down', 'New item of another type');
	pickBtn.addClass('pbl-new-pick');
	pickBtn.addEventListener('click', (evt) => {
		const menu = new Menu();
		// Every declared type, extras included: this menu is the one place a top-level
		// item of any type can be made, and an Issue raised against nothing in
		// particular is a real thing to want.
		for (const type of ALL_TYPES) {
			menu.addItem((mi) =>
				mi.setTitle(`New ${type}`).setIcon('plus').onClick(() => promptCreateItem(host, [type], null)),
			);
		}
		showMenuForClick(menu, evt);
	});
	renderFocusPicker(host, barEl, model);
	renderModeToggle(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-sep' });
	// The one command that routinely writes hundreds of notes: it carries the
	// write-control marker so it goes disabled while a batch is already in flight.
	const initBtn = iconButton(barEl, 'sparkles', 'Assign missing type and order properties');
	initBtn.addClass('pbl-write-ctl');
	initBtn.addEventListener('click', () => {
		void runInit(host);
	});
	// Not a plain write control: it re-enables to the undo slot's state, not to
	// "idle" — before the first effective batch there is nothing to go back to.
	const undoBtn = iconButton(barEl, 'undo-2', 'Undo last backlog change');
	undoBtn.addClass('pbl-undo-btn');
	undoBtn.disabled = !host.canUndo();
	undoBtn.addEventListener('click', () => {
		void host.undoLast();
	});
	// Expand and collapse drive the tree's rows; the board has nothing collapsible
	// yet, and a control that visibly does nothing is worse than none.
	if (!host.settings.boardMode) {
		collapseButton(host, barEl, 'chevrons-up-down', 'Expand all', () => {
			for (const item of model.items) host.setCollapsed(item.file.path, false);
		});
		collapseButton(host, barEl, 'chevrons-down-up', 'Collapse all', () => {
			for (const item of model.items) {
				if (item.children.length > 0) host.setCollapsed(item.file.path, true);
			}
		});
	}
	renderCompletedToggle(host, barEl, model);

	renderFilterBox(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-spacer' });
	if (host.groupingIgnored) {
		const note = barEl.createDiv({ cls: 'pbl-toolbar-note pbl-grouping-note' });
		setIcon(note.createSpan({ cls: 'pbl-toolbar-note-icon' }), 'info');
		note.createSpan({ text: 'Grouping ignored' });
		setTooltip(
			note,
			"The hierarchy is the tree's grouping and the workflow is the board's — the group by setting has no effect in this view.",
		);
	}
	renderIgnoredNote(barEl, model);
	const problems = configProblems(host.settings);
	if (problems.length > 0) {
		const warn = barEl.createDiv({ cls: 'pbl-config-warning', attr: { 'aria-label': problems.join(' ') } });
		setIcon(warn.createSpan({ cls: 'pbl-warning-icon' }), 'alert-triangle');
		warn.createSpan({ text: 'Check view options' });
		setTooltip(warn, problems.join(' '));
	}
	renderBusyIndicator(barEl);
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
 * The write-in-flight indicator. Always rendered and hidden by CSS rather than
 * created on demand: progress ticks once per file, and rebuilding the toolbar for
 * each of them would be its own source of jank. `syncBusy` drives it in place.
 */
function renderBusyIndicator(barEl: HTMLElement): void {
	const busy = barEl.createDiv({ cls: 'pbl-busy', attr: { role: 'status', 'aria-live': 'polite' } });
	setIcon(busy.createSpan({ cls: 'pbl-busy-spinner' }), 'loader-2');
	busy.createSpan({ cls: 'pbl-busy-label' });
}

/**
 * Point the toolbar at the batch currently being written, or at nothing when idle.
 * Called on every render and on every progress tick, so it only touches text and
 * flags — never structure. Controls that would be refused mid-batch go `disabled`
 * with it, so the busy state is something a user reads rather than discovers.
 */
export function syncBusy(barEl: HTMLElement, busy: BusyState | null, canUndo: boolean): void {
	const el = barEl.querySelector<HTMLElement>('.pbl-busy');
	if (el) {
		el.toggleClass('pbl-busy-on', busy !== null);
		// A single-file write is over before it could be read; naming a count only
		// when there is a count to name keeps the label honest either way.
		const label = busy && busy.total > 1 ? `Updating ${busy.done} of ${busy.total}…` : 'Updating…';
		el.querySelector<HTMLElement>('.pbl-busy-label')?.setText(busy ? label : '');
	}
	barEl.querySelectorAll<HTMLButtonElement>('.pbl-write-ctl').forEach((btn) => {
		btn.disabled = busy !== null;
	});
	// Undo pauses with every other write control, but comes back only when the
	// slot holds something — which the batch that just finished usually ensures.
	const undoBtn = barEl.querySelector<HTMLButtonElement>('.pbl-undo-btn');
	if (undoBtn) undoBtn.disabled = busy !== null || !canUndo;
}

/**
 * The hierarchy is the tree's grouping and the workflow is the board's; a group-by
 * configured on the Base has no effect, and the toolbar note above says so. This
 * detects that there is one to say it about.
 */
export function detectIgnoredGrouping(data: BasesQueryResult | null | undefined): boolean {
	try {
		const groups = data?.groupedData;
		if (!groups || groups.length === 0) return false;
		return groups.length > 1 || groups[0].hasKey();
	} catch {
		return false;
	}
}

/**
 * The toolbar survives content-only renders (the filter keeps its input focus), so
 * the count is synced imperatively per pass. The Base's own results: ancestors
 * loaded for context are not items of this base and must not inflate the number.
 * Collapsed rows still count as shown — only filtering and hiding narrow it,
 * which `isRowHidden` covers both of, in both projections.
 */
export function syncCountLabel(host: BacklogViewHost, barEl: HTMLElement): void {
	const label = barEl.querySelector<HTMLElement>('.pbl-count-label');
	const model = host.model;
	if (!label || !model) return;
	const total = model.results.length;
	const shown = model.results.filter((item) => !host.isRowHidden(item)).length;
	if (shown === total) label.setText(`${total} item${total === 1 ? '' : 's'}`);
	else label.setText(`${shown} of ${total}`);
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
	const clearBtn = filterEl.createEl('button', {
		cls: 'pbl-filter-clear clickable-icon',
		attr: { type: 'button', 'aria-label': 'Clear filter' },
	});
	setIcon(clearBtn, 'x');
	setTooltip(clearBtn, 'Clear filter');
	clearBtn.addEventListener('click', clear);
}

/**
 * Focus picker — beside the New button, because what the view is focused on is also
 * what that button creates. Doubles as the cue that something is narrowing the tree:
 * it shows the active type, accented, with a one-click way back to everything.
 *
 * It offers levels AND extra types, so the wording says "type" throughout: "all levels"
 * would be a promise this menu no longer keeps.
 */
function renderFocusPicker(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	// A focus naming no configured type re-roots nothing — report all levels.
	const active = model.focused ? focusTarget(host.settings) : '';
	const wrap = barEl.createDiv({ cls: 'pbl-focus' });
	wrap.toggleClass('pbl-focus-active', active !== '');
	// Bases persists the change and refreshes the view.
	const setLevel = (level: string) => host.config.set('focusLevel', level);

	const btn = wrap.createEl('button', { cls: 'pbl-focus-btn' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'filter');
	btn.createSpan({ text: active || 'All types' });
	setTooltip(btn, 'Focus — show one type as the top of the tree');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		const choice = (level: string, title: string) =>
			menu.addItem((mi) =>
				mi
					.setTitle(title)
					.setChecked(active === level)
					.onClick(() => setLevel(level)),
			);
		choice('', 'All types');
		for (const level of LEVELS) choice(level, level);
		// Extra types are focusable too: they rank with a level, so a view of just the
		// bugs is the same kind of view as one of just the PBIs.
		for (const extra of EXTRA_TYPES) choice(extra, extra);
		showMenuForClick(menu, evt);
	});

	if (active === '') return;
	const clear = wrap.createEl('button', {
		cls: 'pbl-focus-clear clickable-icon',
		attr: { type: 'button', 'aria-label': 'Show all types' },
	});
	setIcon(clear, 'x');
	setTooltip(clear, 'Show all types');
	clear.addEventListener('click', () => setLevel(''));
}

/**
 * The projection toggle — one view, read as a tree or as a board. The mode is a
 * persisted view option exactly as the focus level is: set here, stored in the
 * `.base` per saved view, absent from the options menu because it lives where its
 * effect is. Bases persists the change and refreshes the view.
 */
function renderModeToggle(host: BacklogViewHost, barEl: HTMLElement): void {
	const board = host.settings.boardMode;
	const btn = iconButton(
		barEl,
		board ? 'list-tree' : 'square-kanban',
		board ? 'Show as backlog tree' : 'Show as kanban board',
	);
	btn.addClass('pbl-mode-toggle');
	btn.toggleClass('is-active', board);
	btn.addEventListener('click', () => host.config.set('viewMode', board ? 'backlog' : 'board'));
}

/** e.g. "2 Epic · 4 Feature · 9 PBI · 3 Bug" for the item-count tooltip. */
function levelBreakdown(host: BacklogViewHost, model: BacklogModel): string {
	const byLevel = new Map<string, number>();
	for (const item of model.results) {
		const label = displayType(item) || 'Untyped';
		byLevel.set(label, (byLevel.get(label) ?? 0) + 1);
	}
	return [...byLevel].map(([label, n]) => `${n} ${label}`).join(' · ');
}

/**
 * A toolbar icon control. A real `<button>`, not a div: the toolbar sits outside
 * the tree's single-tab-stop model, and these are the only way to reach the type
 * picker, the backfill and the collapse commands without a mouse.
 */
function iconButton(parent: HTMLElement, icon: string, label: string): HTMLButtonElement {
	const btn = parent.createEl('button', {
		cls: 'clickable-icon pbl-icon-btn',
		attr: { type: 'button', 'aria-label': label },
	});
	setIcon(btn, icon);
	setTooltip(btn, label);
	return btn;
}

/**
 * Expand/collapse toolbar buttons. Collapse state is overridden while a filter is
 * active, so they are genuinely `disabled` then rather than only dimmed: a control
 * a keyboard user can reach has to refuse the press, not just look like it would.
 * The view re-syncs the flag on every filter change (`syncFilterUi`).
 */
function collapseButton(
	host: BacklogViewHost,
	parent: HTMLElement,
	icon: string,
	label: string,
	mutate: () => void,
): void {
	const btn = iconButton(parent, icon, label);
	btn.addClass('pbl-collapse-ctl');
	btn.disabled = host.isFiltering();
	btn.addEventListener('click', () => {
		mutate();
		host.render();
	});
}
