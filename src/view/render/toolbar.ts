import { BasesQueryResult, Menu, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, BusyState, Projection } from '../host';
import { newItemType, promptCreateItem } from '../interactions/create';
import { showMenuForClick } from '../interactions/menu';
import { runInit } from '../interactions/structure';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { displayType, focusTarget, isDeliverableType } from '../../domain/itemTypes';
import { activeAxis, configuredAxes, RoadmapAxis } from '../../domain/roadmap';
import { ALL_TYPES, DELIVERABLE_TYPE } from '../../domain/settings';
import { configProblems } from '../../domain/settings';
import { ScaleId } from '../../domain/timeline';

/** Toolbar: creation buttons, backfill, expand/collapse, config warning, item count. */
export function renderToolbar(host: BacklogViewHost, barEl: HTMLElement): void {
	const model = host.model;
	if (!model) return;
	barEl.empty();

	// The Deliverables board only ever shows Deliverables, so the primary button is
	// bound to that type unconditionally — never the focus-dependent `newItemType`,
	// which would offer a type this board would not even display. With one sensible
	// type there is nothing for a "New item of another type" picker to add, so it is
	// absent rather than a chevron opening a one-entry menu.
	const onDeliverables = host.projection === 'deliverables';
	const newLevel = onDeliverables ? DELIVERABLE_TYPE : newItemType(host.settings, model);
	const newBtn = barEl.createEl('button', { cls: 'pbl-new-btn' });
	setIcon(newBtn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	newBtn.createSpan({ text: `New ${newLevel}` });
	newBtn.addEventListener('click', () => promptCreateItem(host, [newLevel], null));

	if (!onDeliverables) {
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
	}
	renderFocusPicker(host, barEl, model);
	renderModeToggle(host, barEl);
	renderAxisPicker(host, barEl);
	renderTimelineControls(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-sep' });
	// The one command that routinely writes hundreds of notes: it carries the
	// write-control marker so it goes disabled while a batch is already in flight.
	const initBtn = iconButton(barEl, 'sparkles', 'Assign missing properties');
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
	// Expand and collapse drive the tree's rows; the board and the roadmap have
	// nothing collapsible yet, and a control that visibly does nothing is worse than none.
	if (host.projection === 'tree') {
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
	setTooltip(countEl, levelBreakdown(model.results));
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
 * The filter can be cleared from outside the toolbar (Escape in the tree, the
 * no-match state); keep the input and its clear affordance in sync. A filter change
 * re-renders only the content pane, so the collapse controls are updated here too:
 * they are focusable buttons, and while collapse state is overridden they have to
 * actually refuse the press, not just look dimmed.
 */
export function syncFilterUi(host: BacklogViewHost, barEl: HTMLElement): void {
	const input = barEl.querySelector<HTMLInputElement>('.pbl-filter-input');
	if (input && input.value !== host.filterText) input.value = host.filterText;
	input?.closest('.pbl-filter')?.classList.toggle('pbl-filter-active', host.filterText !== '');
	const filtering = host.isFiltering();
	barEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl').forEach((btn) => {
		btn.disabled = filtering;
	});
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
 * which `isRowHidden` covers both of, in both projections. The Deliverables board is
 * scoped a third way: its population is Deliverable-typed results only (never the
 * whole base, whatever else the query returned), hidden by the filter-only predicate
 * that board itself renders with rather than the "Show completed items" one, since
 * that toggle does not apply there. Also fixes the label's own tooltip, which used to
 * be set once by `renderToolbar` at full-render time and never rescoped here — so it
 * could disagree with the text sitting right next to it.
 *
 * The requirements board is scoped a FOURTH way, for the opposite reason the
 * Deliverables board is scoped at all: Deliverables are managed on their own board now
 * (`renderRequirementsBoard`), so counting one here would claim the board shows more
 * than it does. The tree and the roadmap keep every item — this scoping is the
 * `'board'` projection alone.
 */
export function syncCountLabel(host: BacklogViewHost, barEl: HTMLElement): void {
	const label = barEl.querySelector<HTMLElement>('.pbl-count-label');
	const model = host.model;
	if (!label || !model) return;
	const onDeliverables = host.projection === 'deliverables';
	const onRequirementsBoard = host.projection === 'board';
	const isDeliverable = (item: BacklogItem) => isDeliverableType(item.typeName);
	const population = onDeliverables
		? model.results.filter(isDeliverable)
		: onRequirementsBoard
			? model.results.filter((item) => !isDeliverable(item))
			: model.results;
	const hidden = (item: BacklogItem): boolean =>
		onDeliverables ? host.isRowHiddenByFilterOnly(item) : host.isRowHidden(item);
	const total = population.length;
	const shown = population.filter((item) => !hidden(item)).length;
	if (shown === total) label.setText(`${total} item${total === 1 ? '' : 's'}`);
	else label.setText(`${shown} of ${total}`);
	setTooltip(label, levelBreakdown(population));
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
	if (!host.settings.stateKey || host.projection === 'deliverables') return;
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
 *
 * **The Deliverables board is the one projection that never offers the menu.** It
 * shows one type by definition, so a control that PICKS a type to narrow by has
 * nothing to add. Unlike `renderCompletedToggle`'s own irrelevant control, though, the
 * button here does not go absent: with no inherited focus narrowing it further, this
 * board's population already IS "every Deliverable" — the same thing the button's
 * label would say if it opened a menu — so a real, disabled `<button>` reads
 * "Deliverables" instead of vanishing (the human's own request; a class or
 * `aria-disabled` alone would leave it focusable, which `src/view/CLAUDE.md`'s "once a
 * control is focusable, disabling it in CSS is a lie" rule forbids).
 *
 * Focus is shared UI state, though, not a per-projection setting, and an already-active
 * focus still narrows THIS board's own population **UNLESS it is `PBI`**
 * (`renderDeliverablesBoard` reads `model.results`, itself re-rooted by focus — see
 * `renderNoDeliverablesState`'s `admitsNewDeliverable`, and extension 3b of
 * `docs/requirements/A board scoped to Deliverables.md`, which states as a deliberate,
 * reviewed decision that a non-`PBI` inherited focus narrows this board exactly as it
 * narrows the tree). A fixed "Deliverables" label would misreport that narrowing, so
 * this case keeps its own, already-honest shape instead: a static label naming the
 * ACTUAL inherited focus, and the one real, meaningful action left — clearing it —
 * stays a real button. Making "Deliverables" true of every inherited focus, not only
 * the common no-focus case, would mean the Deliverables board stopped inheriting that
 * narrowing at all — reversing extension 3b's decision, which is not this button's
 * call to make.
 */
function renderFocusPicker(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	// A focus naming no configured type re-roots nothing — report all levels.
	const active = model.focused ? focusTarget(host.settings) : '';
	// Working position, not configuration: the collapse store persists it and the view
	// rebuilds itself, because no Bases refresh follows a change it was not told about.
	const setLevel = (level: string) => host.setFocusLevel(level);

	if (host.projection === 'deliverables') {
		const wrap = barEl.createDiv({ cls: 'pbl-focus' });
		if (active === '') {
			const btn = wrap.createEl('button', { cls: 'pbl-focus-btn', attr: { type: 'button' } });
			setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'filter');
			btn.createSpan({ text: 'Deliverables' });
			btn.disabled = true;
			setTooltip(btn, 'This board always shows Deliverables');
			return;
		}
		wrap.addClass('pbl-focus-active');
		wrap.createSpan({ cls: 'pbl-focus-label', text: `Focused: ${active}` });
		renderFocusClearButton(wrap, setLevel);
		return;
	}

	const wrap = barEl.createDiv({ cls: 'pbl-focus' });
	wrap.toggleClass('pbl-focus-active', active !== '');

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
		// Every declared type, read off the vocabulary rather than category by category:
		// being ACCEPTABLE as a focus (`focusTarget` already reads `ALL_TYPES`) is not the
		// same as being OFFERABLE, and a name in neither hand-written list was one a saved
		// view could hold and no user could pick.
		for (const type of ALL_TYPES) choice(type, type);
		showMenuForClick(menu, evt);
	});

	if (active === '') return;
	renderFocusClearButton(wrap, setLevel);
}

/** The one-click way back to "All types" — shared by the ordinary picker and the
 * Deliverables board's reduced, escape-hatch-only form of it. */
function renderFocusClearButton(wrap: HTMLElement, setLevel: (level: string) => void): void {
	const clear = wrap.createEl('button', {
		cls: 'pbl-focus-clear clickable-icon',
		attr: { type: 'button', 'aria-label': 'Show all types' },
	});
	setIcon(clear, 'x');
	setTooltip(clear, 'Show all types');
	clear.addEventListener('click', () => setLevel(''));
}

/**
 * The projection toggle — one view, read as a tree, a board or a roadmap. The
 * mode is working position, not configuration: base settings are saved on the
 * view, UI state in vault-scoped localStorage, so the choice persists beside the
 * collapse state — per saved view, per device — and never touches the `.base`.
 */
function renderModeToggle(host: BacklogViewHost, barEl: HTMLElement): void {
	const wrap = barEl.createDiv({ cls: 'pbl-mode-toggle', attr: { role: 'group', 'aria-label': 'Projection' } });
	const position = (mode: Projection, icon: string, label: string) => {
		const btn = iconButton(wrap, icon, label);
		btn.addClass('pbl-mode-btn');
		btn.toggleClass('is-active', host.projection === mode);
		btn.setAttribute('aria-pressed', String(host.projection === mode));
		btn.addEventListener('click', () => host.setProjection(mode));
	};
	position('tree', 'list-tree', 'Show as backlog tree');
	position('board', 'square-kanban', 'Show as kanban board');
	position('roadmap', 'map', 'Show as roadmap');
	position('deliverables', 'package', 'Show as Deliverables board');
}

/**
 * Which axis this saved view shows — offered only on the roadmap, and only while
 * both axes are configured: with one, there is no choice to make, and the axis
 * that remains always beats guidance. The pick persists the way the mode itself
 * does, and it is retained when its axis loses its configuration, so restoring
 * the cleared property restores the saved choice with it.
 */
function renderAxisPicker(host: BacklogViewHost, barEl: HTMLElement): void {
	if (host.projection !== 'roadmap' || configuredAxes(host.settings).length < 2) return;
	const active = activeAxis(host.settings, host.axisPick);
	const wrap = barEl.createDiv({ cls: 'pbl-axis-picker', attr: { role: 'group', 'aria-label': 'Roadmap axis' } });
	const position = (axis: RoadmapAxis, icon: string, label: string) => {
		const btn = iconButton(wrap, icon, label);
		btn.addClass('pbl-axis-btn');
		btn.toggleClass('is-active', active === axis);
		btn.setAttribute('aria-pressed', String(active === axis));
		btn.addEventListener('click', () => host.setAxisPick(axis));
	};
	position('horizons', 'columns-3', 'Show horizons');
	position('dates', 'calendar-range', 'Show timeline');
}

/**
 * The zoom picker and jump-to-today, on the dated axis alone — the horizon axis has no
 * density to choose and no today to return to. Segmented buttons like the axis picker,
 * because the zoom choice is one of three and a menu would hide two of them.
 */
function renderTimelineControls(host: BacklogViewHost, barEl: HTMLElement): void {
	if (host.projection !== 'roadmap' || activeAxis(host.settings, host.axisPick) !== 'dates') return;
	const wrap = barEl.createDiv({ cls: 'pbl-zoom-picker', attr: { role: 'group', 'aria-label': 'Timeline zoom' } });
	const position = (id: ScaleId, icon: string, label: string) => {
		const btn = iconButton(wrap, icon, label);
		btn.addClass('pbl-zoom-btn');
		btn.toggleClass('is-active', host.zoom === id);
		btn.setAttribute('aria-pressed', String(host.zoom === id));
		btn.addEventListener('click', () => host.setZoom(id));
	};
	position('week', 'calendar-days', 'Zoom to weeks');
	position('month', 'calendar', 'Zoom to months');
	position('quarter', 'calendar-range', 'Zoom to quarters');
	const today = iconButton(barEl, 'locate-fixed', 'Jump to today');
	today.addClass('pbl-today-btn');
	today.addEventListener('click', () => host.jumpToToday());
}

/** e.g. "2 Epic · 4 Feature · 9 PBI · 3 Bug" for the item-count tooltip, over whichever population is passed. */
function levelBreakdown(items: BacklogItem[]): string {
	const byLevel = new Map<string, number>();
	for (const item of items) {
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
