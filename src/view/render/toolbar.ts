import { BasesQueryResult, Menu, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, BusyState, Projection } from '../host';
import { newItemType, promptCreateItem } from '../interactions/create';
import { offerableTypes, showMenuForClick } from '../interactions/menu';
import { runInit } from '../interactions/structure';
import {
	capturedFocusKey,
	collapseAll,
	collapseButton,
	collapseCtlsDisabled,
	expandAll,
	iconButton,
	KEY_ATTR,
	pickAndRefocus,
	refocusByKey,
	renderOverflow,
	renderProjectionZone,
} from './toolbarControls';
import { syncToolbarFit } from './toolbarFit';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { displayType, focusTarget, isDeliverableType } from '../../domain/itemTypes';
import { DELIVERABLE_TYPE } from '../../domain/settings';
import { configProblems } from '../../domain/settings';

/** Toolbar: creation buttons, backfill, expand/collapse, config warning, item count. */
export function renderToolbar(host: BacklogViewHost, barEl: HTMLElement): void {
	const model = host.model;
	if (!model) return;
	// `barEl.empty()` below destroys whatever element currently holds focus inside the
	// toolbar. Any control whose click re-renders the view — the density toggle, a zoom
	// button, an axis button — would otherwise drop focus to `document.body`, so a
	// keyboard or screen-reader user has to tab back through the whole toolbar to press
	// it again. This is the rebuild losing the focus, not any one control's fault, so it
	// is fixed once, here, rather than in each control.
	const refocusKey = capturedFocusKey(barEl);
	barEl.empty();

	// 1 — where am I. The switcher leads: it is the control that says what the rest of
	// the row is about.
	renderModeToggle(host, barEl);

	// 2 — what THIS projection owns, and nothing when it owns none. Draws its own
	// leading separator, or neither.
	renderProjectionZone(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-spacer' });

	// 3 — what is shown. The same controls in every projection.
	renderFocusPicker(host, barEl, model);
	// Expand and collapse drive the tree's rows and, since cards grew disclosures, the
	// cards too. They are no longer gated on the projection — but they ARE gated on the
	// screen having something to collapse: see `syncCollapseCtls`, which runs after the
	// content render because that is what fills the set it reads.
	collapseButton(host, barEl, {
		icon: 'chevrons-up-down',
		label: 'Expand all',
		cls: 'pbl-expand-ctl',
		mutate: () => expandAll(host),
	});
	collapseButton(host, barEl, {
		icon: 'chevrons-down-up',
		label: 'Collapse all',
		cls: 'pbl-collapse-all-ctl',
		mutate: () => collapseAll(host),
	});
	renderCompletedToggle(host, barEl, model);
	renderFilterBox(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-sep' });

	// 4 — what writes. The ✨ is the one command that routinely writes hundreds of
	// notes: it carries the write-control marker so it goes disabled while a batch is
	// already in flight.
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
	// The `⋯` — the fit ladder's escape hatch for whatever it has shed off the row.
	// Placement here is a layout decision only: the menu reads the bar's DOM at click
	// time, so it can sit anywhere in it and still see every button.
	renderOverflow(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-sep' });

	// 5 — status: the notes, the warning, the busy indicator, the count.
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
	// This projection's own population — `countedPopulation`, the same one
	// `syncCountLabel` and `renderCompletedToggle` read — never the Base's raw results:
	// the requirements board excludes Deliverables and the Deliverables board counts
	// only Deliverables, so a first paint off `model.results` would show a number
	// `syncCountLabel` immediately overwrites with a different one.
	const population = countedPopulation(host, model);
	const count = population.length;
	const countEl = barEl.createSpan({
		cls: 'pbl-count-label',
		text: `${count} item${count === 1 ? '' : 's'}`,
		attr: { 'aria-live': 'polite' },
	});
	setTooltip(countEl, levelBreakdown(population));

	// 6 — the primary action, anchored at the end.
	renderNewButton(host, barEl, model);

	refocusByKey(barEl, refocusKey);
}

/**
 * The primary create button and the chevron beside it. Last in the row: the zones before
 * it answer "what am I looking at" and "what is shown", and the action that adds to it is
 * anchored at the end where it does not push everything else sideways when the type name
 * it carries changes length.
 */
function renderNewButton(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	// The Deliverables board only ever shows Deliverables, so the primary button is
	// bound to that type unconditionally — never the focus-dependent `newItemType`,
	// which would offer a type this board would not even display. With one sensible
	// type there is nothing for a "New item of another type" picker to add, so it is
	// absent rather than a chevron opening a one-entry menu.
	const onDeliverables = host.projection === 'deliverables';
	const newLevel = onDeliverables ? DELIVERABLE_TYPE : primaryNewType(host, model);
	// The button and its chevron are ONE control in two pieces, so they get one
	// non-shrinking box. The toolbar still wraps today, and these are now the last two
	// elements in it: a pane wide enough for the button and not the chevron would put
	// the chevron alone on the next row, split from the action it extends. It is not
	// scaffolding for that — once the row stops wrapping the wrapper still says the
	// primary action and its type picker are one thing, which is why it holds them
	// together rather than pinning them.
	const wrap = barEl.createDiv({ cls: 'pbl-new' });
	// The name is explicit, not inherited from the text: the fit ladder hides
	// `.pbl-btn-label` on a narrow pane, and a primary button named only by the text it
	// just hid is an unnamed control. The key stays on the BUTTON — `refocusByKey` looks
	// for something to focus, and a wrapper div is not it.
	const newBtn = wrap.createEl('button', {
		cls: 'pbl-new-btn',
		attr: { [KEY_ATTR]: 'new', 'aria-label': `New ${newLevel}` },
	});
	setIcon(newBtn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	newBtn.createSpan({ cls: 'pbl-btn-label', text: `New ${newLevel}` });
	newBtn.addEventListener('click', () => promptCreateItem(host, [newLevel], null));
	if (onDeliverables) return;
	const pickBtn = iconButton(wrap, 'chevron-down', 'New item of another type');
	pickBtn.addClass('pbl-new-pick');
	pickBtn.setAttribute('aria-haspopup', 'menu');
	pickBtn.addEventListener('click', (evt) => {
		const menu = new Menu();
		// Every declared type, extras included: this menu is the one place a top-level
		// item of any type can be made, and an Issue raised against nothing in
		// particular is a real thing to want. Except `Deliverable` on the requirements
		// board, which excludes Deliverables by construction — creating one there
		// would write a note the board it was created from cannot show.
		//
		// No `pickAndRefocus` here: this entry opens the creation prompt, which takes
		// focus deliberately. The rebuild-loses-focus problem belongs to picks that
		// re-render behind the menu.
		for (const type of offerableTypes(host)) {
			menu.addItem((mi) =>
				mi.setTitle(`New ${type}`).setIcon('plus').onClick(() => promptCreateItem(host, [type], null)),
			);
		}
		showMenuForClick(menu, evt);
	});
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
 * Reserve the box the widest label of THIS batch will need — by rendering that label and
 * reading what it actually took, not by counting its characters.
 *
 * Two things have to be true for this to be a bound, and only one of them is arithmetic.
 *
 * **The longest VALUE is `total`**: it is fixed for the life of a batch while `done` only
 * climbs toward it, so `Updating {total} of {total}…` has the most characters any tick can
 * show. That much is free.
 *
 * **The longest value is not automatically the WIDEST**, and that is the trap this has
 * fallen into twice. Counting `ch` was wrong because `ch` is the advance of a "0" and
 * bounds neither the letters nor the other digits. Measuring the longest value is wrong
 * for a subtler reason: in a proportional face `Updating 88 of 111…` can draw wider than
 * `Updating 111 of 111…`, because 8 is wider than 1 — same digit count, more pixels. So
 * the measurement needs the digits to be equal-width before it means anything, which is
 * what `font-variant-numeric: tabular-nums` on `.pbl-busy-label` buys: with tabular
 * figures every digit has one advance, the widest label really is the one with the most
 * digits, and measuring it bounds every tick.
 *
 * The residual, stated rather than papered over: a theme font with no tabular figures
 * makes that property a no-op, and the reservation can then be a few pixels short of some
 * intermediate value. What that costs is a few clipped pixels at the extreme right of a
 * near-threshold row, mid-batch, until the batch ends — which is why it is accepted here
 * rather than answered by measuring all ten digits and composing a bound.
 *
 * One forced layout read, once per batch, on the transition that already re-runs the
 * ladder — not once per file, which is the cost this whole mechanism exists to avoid.
 *
 * Published as `--pbl-busy-w` rather than written as `min-width`, which is this
 * codebase's idiom for a number TypeScript owns and CSS reads (`--pbl-prop-col`,
 * `--pbl-today-left`) and what the Obsidian ruleset requires: a real property assigned
 * from script is a style a theme cannot reach.
 */
function reserveBusyLabel(labelEl: HTMLElement, total: number): void {
	const longest = total > 1 ? `Updating ${total} of ${total}…` : 'Updating…';
	labelEl.setCssProps({ '--pbl-busy-w': '0px' });
	labelEl.setText(longest);
	// `Math.ceil`, because a fractional advance rounds down into a box one pixel short.
	const px = Math.ceil(labelEl.getBoundingClientRect().width);
	labelEl.setCssProps({ '--pbl-busy-w': `${px}px` });
}

/**
 * The indicator's own half of `syncBusy`: the on/off flag, the tick's text, and the
 * width reservation that keeps the ticks between two transitions from moving the row.
 * Reports whether the indicator's VISIBILITY changed, which is the only thing the row's
 * width depends on and so the only thing worth re-measuring for.
 */
function syncBusyLabel(el: HTMLElement, busy: BusyState | null): boolean {
	// Captured before the toggle: the ladder re-runs on idle→busy and busy→idle, which
	// happen twice per batch, and NOT on the ticks between them. `scrollWidth` is a
	// forced layout read, so measuring per file would put back a cost of the same shape
	// as the per-file re-render the deferred update removed. What makes that safe is the
	// reservation taken on the SAME transition, three lines down.
	const wasOn = el.hasClass('pbl-busy-on');
	el.toggleClass('pbl-busy-on', busy !== null);
	// A single-file write is over before it could be read; naming a count only
	// when there is a count to name keeps the label honest either way.
	const label = busy && busy.total > 1 ? `Updating ${busy.done} of ${busy.total}…` : 'Updating…';
	const labelEl = el.querySelector<HTMLElement>('.pbl-busy-label');
	const changed = wasOn !== (busy !== null);
	// Reserve BEFORE writing the tick's own text: `reserveBusyLabel` renders the
	// longest form to measure it, so the real text has to be set afterwards or the
	// measurement is what the user reads.
	if (changed && busy && labelEl) reserveBusyLabel(labelEl, busy.total);
	labelEl?.setText(busy ? label : '');
	// The row gives the reservation back when the batch ends, or the next idle toolbar
	// is measured carrying a box for a label it is not showing.
	if (changed && !busy) labelEl?.setCssProps({ '--pbl-busy-w': '0px' });
	return changed;
}

/**
 * Point the toolbar at the batch currently being written, or at nothing when idle.
 * Called on every render and on every progress tick, so it only touches text and
 * flags — never structure. Controls that would be refused mid-batch go `disabled`
 * with it, so the busy state is something a user reads rather than discovers.
 */
export function syncBusy(barEl: HTMLElement, busy: BusyState | null, canUndo: boolean): void {
	const el = barEl.querySelector<HTMLElement>('.pbl-busy');
	// Only on the visibility transition — see `syncBusyLabel`, which is what answers it.
	if (el && syncBusyLabel(el, busy)) syncToolbarFit(barEl);
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
 * no-match state); keep the input and its clear affordance in sync. It does NOT
 * touch the collapse controls — `syncCollapseCtls` is their sole writer, called
 * after the content render along with `syncCountLabel`, and a filter change
 * reaches it the same way any other content re-render does.
 */
export function syncFilterUi(host: BacklogViewHost, barEl: HTMLElement): void {
	const input = barEl.querySelector<HTMLInputElement>('.pbl-filter-input');
	if (input && input.value !== host.filterText) input.value = host.filterText;
	input?.closest('.pbl-filter')?.classList.toggle('pbl-filter-active', host.filterText !== '');
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
 * scoped a third way: its population is `model.deliverableResults` — every
 * Deliverable-typed result, regardless of any active focus level, never the whole
 * base — hidden by the filter-only predicate that board itself renders with rather
 * than the "Show completed items" one, since that toggle does not apply there. Also
 * fixes the label's own tooltip, which used to be set once by `renderToolbar` at
 * full-render time and never rescoped here — so it could disagree with the text
 * sitting right next to it.
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
	const population = countedPopulation(host, model);
	// `isRowHidden` answers per projection now, the Deliverables board's own exception
	// included, so this asks the one question rather than choosing between two.
	const total = population.length;
	const shown = population.filter((item) => !host.isRowHidden(item)).length;
	if (shown === total) label.setText(`${total} item${total === 1 ? '' : 's'}`);
	else label.setText(`${shown} of ${total}`);
	setTooltip(label, levelBreakdown(population));
}

/**
 * The bulk collapse controls, decided from what the render actually drew. It has to run
 * AFTER the content: `renderToolbar` goes first and the cards are drawn afterwards, so a
 * verdict taken during the toolbar pass would read the previous frame's set —
 * `syncCountLabel` above is the same shape for the same reason. It is the only writer of
 * `btn.disabled` on `.pbl-collapse-ctl` today — nothing enforces that, a lint rule for it
 * was considered and declined — but `syncFilterUi` used to also write it, which made two
 * functions own one property agreeing only by call order; `collapseButton`'s own click
 * handler below READS `btn.disabled` to guard its mutation, which does not reopen that
 * split — a read cannot disagree with the writer about what the value is.
 *
 * A card projection with no disclosure gets them disabled rather than removed. They
 * would otherwise write collapse state that changes nothing on screen and then surprises
 * the tree later — inert to look at and not inert in effect, which is the worst pairing.
 * The real `disabled` property, never CSS: `pointer-events: none` stops a mouse and
 * nothing else.
 *
 * The condition is named in `toolbarControls.ts` because the `⋯` menu reads the same
 * rule — this function is still its only writer.
 */
export function syncCollapseCtls(host: BacklogViewHost, barEl: HTMLElement): void {
	const disabled = collapseCtlsDisabled(host);
	barEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl').forEach((btn) => {
		btn.disabled = disabled;
	});
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
	// This projection's OWN population, the same one the count label answers for: on the
	// requirements board a done Deliverable is not a hidden card, it is not a card at
	// all, so counting it offered to reveal something pressing the button cannot show.
	const hidden = countedPopulation(host, model).filter((item) => item.subtreeDone).length;
	const suffix = hidden > 0 ? ` (${hidden} hidden)` : '';
	const btn = iconButton(
		barEl,
		showing ? 'eye' : 'eye-off',
		showing ? 'Hide completed items' : `Show completed items${suffix}`,
		'completed',
	);
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
		attr: { type: 'text', placeholder: 'Filter items', 'aria-label': 'Filter items', [KEY_ATTR]: 'filter' },
	});
	input.value = host.filterText;
	// `setFilter` re-renders the tree and syncs this box's active state, which is what
	// makes clearing a THIRD input to `revealFilter` rather than a focus call of its own.
	// At a collapsing rung an input the user typed into is visible only through
	// `pbl-filter-active`; emptying it strips that class synchronously, the rung hides the
	// still-focused input, and the `input.focus()` that used to follow would focus a
	// `display: none` element — no effect, no error, focus on the body. Establishing the
	// open flag as part of clearing is also exactly what the design asks for: a cleared
	// filter stays open until it is blurred.
	const clear = () => {
		host.setFilter('');
		revealFilter(barEl);
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
		attr: { type: 'button', 'aria-label': 'Clear filter', [KEY_ATTR]: 'filter-clear' },
	});
	setIcon(clearBtn, 'x');
	setTooltip(clearBtn, 'Clear filter');
	clearBtn.addEventListener('click', clear);
	// Below the step that collapses it, the input is not rendered-and-hidden but
	// display:none, so this button is the control — and it carries the name.
	const reveal = filterEl.createEl('button', {
		cls: 'pbl-filter-reveal clickable-icon',
		attr: { type: 'button', 'aria-label': 'Filter items', [KEY_ATTR]: 'filter-reveal' },
	});
	setIcon(reveal, 'search');
	setTooltip(reveal, 'Filter items');
	reveal.addEventListener('click', () => revealFilter(barEl));
	input.addEventListener('blur', () => {
		// A filter someone is still using is never taken away: only an EMPTY input
		// collapses back. The flag is read and cleared on the toolbar, where
		// `revealFilter` put it and where it survives a rebuild.
		if (input.value !== '' || !barEl.hasClass('pbl-filter-open')) return;
		barEl.removeClass('pbl-filter-open');
		syncToolbarFit(barEl);
	});
}

/**
 * Open the collapsed filter and focus it. ONE function because there are three inputs:
 * the reveal button's own click, the clear path (Escape and the clear button), and
 * `focusFilter()` — which is what `/` in the tree and the no-match empty state both call.
 * Below the step that collapses it, that method's `.pbl-filter-input` is `display: none`,
 * and `focus()` on a display:none element does nothing at all, silently — so the
 * documented keyboard path to the filter would die at exactly the pane widths where the
 * filter is hardest to reach.
 *
 * The refit is before the focus, and it is here rather than in the click handler for the
 * same reason the function is shared: the input takes ~130px back on a row already
 * measured as full, and no render follows either caller.
 */
export function revealFilter(barEl: HTMLElement): void {
	// On the TOOLBAR, not on the `.pbl-filter` box — the same element `data-pbl-fit`
	// lives on, for the same reason. `renderToolbar` calls `barEl.empty()`, so a class
	// on the box is destroyed by any full render while the fit attribute beside it
	// survives: an empty filter revealed by `/` would come back from a data refresh
	// with the rung still hiding it, and `refocusByKey` would then "restore" focus to a
	// `display: none` input, which silently focuses nothing. The non-empty case is
	// already safe without this — `renderFilterBox` re-derives `pbl-filter-active` from
	// the input's value on every render — so this is the empty-but-revealed state
	// alone, and it is exactly the one nothing else re-derives.
	barEl.addClass('pbl-filter-open');
	syncToolbarFit(barEl);
	// `preventScroll`, because the refit above is not a promise that the input ended up
	// on screen — a pane narrow enough still clips past the last rung, and the default
	// focus behaviour scrolls every scrollable ancestor to reveal the target. The bar
	// itself is `overflow: clip` and cannot scroll, so this is about what is above it.
	barEl.querySelector<HTMLInputElement>('.pbl-filter-input')?.focus({ preventScroll: true });
}

/**
 * Focus picker — beside the New button, because what the view is focused on is also
 * what that button creates. Doubles as the cue that something is narrowing the tree:
 * it shows the active type, accented, with a one-click way back to everything.
 *
 * It offers levels AND extra types, so the wording says "type" throughout: "all levels"
 * would be a promise this menu no longer keeps.
 *
 * **The Deliverables board is the one projection the focus level never affects, full
 * stop** (the human's own request: a focus set on another projection must never make a
 * Deliverable invisible here just because the wrong level was left active). So this is
 * the one projection whose control is unconditionally the fixed, disabled
 * "Deliverables" button, whatever `model.focused` says — never the menu (nothing to
 * narrow by, since every card is already a Deliverable) and never the "Focused: <level>"
 * label, since no level narrows this board's population
 * (`BacklogModel.deliverableResults`, `renderDeliverablesBoard`) for the clear button
 * beside it to have anything to undo. A class or `aria-disabled` alone would leave it
 * focusable, which `src/view/CLAUDE.md`'s "once a control is focusable, disabling it in
 * CSS is a lie" rule forbids.
 */
function renderFocusPicker(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	// Working position, not configuration: the collapse store persists it and the view
	// rebuilds itself, because no Bases refresh follows a change it was not told about.
	// Through `pickAndRefocus` because that rebuild happens while focus is in the menu,
	// where `capturedFocusKey` cannot see it.
	const setLevel = (level: string) => pickAndRefocus(barEl, 'focus', () => host.setFocusLevel(level));

	if (host.projection === 'deliverables') {
		const wrap = barEl.createDiv({ cls: 'pbl-focus' });
		const btn = wrap.createEl('button', { cls: 'pbl-focus-btn', attr: { type: 'button' } });
		setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'filter');
		btn.setAttribute('aria-label', 'Deliverables');
		btn.createSpan({ cls: 'pbl-btn-label', text: 'Deliverables' });
		btn.disabled = true;
		setTooltip(btn, 'This board always shows every Deliverable — the focus level has no effect here');
		return;
	}

	// A focus naming no configured type re-roots nothing — report all levels.
	const active = model.focused ? focusTarget(host.settings) : '';
	const wrap = barEl.createDiv({ cls: 'pbl-focus' });
	wrap.toggleClass('pbl-focus-active', active !== '');

	// Named explicitly, like the New button: the fit ladder hides `.pbl-btn-label`, and
	// the text is all that named this control before.
	const btn = wrap.createEl('button', {
		cls: 'pbl-focus-btn',
		attr: { [KEY_ATTR]: 'focus', 'aria-label': `Focus: ${active || 'all types'}`, 'aria-haspopup': 'menu' },
	});
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'filter');
	btn.createSpan({ cls: 'pbl-btn-label', text: active || 'All types' });
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
		// Through `offerableTypes` like every other type list: focusing `Deliverable` on
		// the requirements board narrows it to roots that board excludes, leaving it empty.
		// An INHERITED one still reads in the button, with the clear beside it — this only
		// stops the state being reached from the projection it breaks.
		for (const type of offerableTypes(host)) choice(type, type);
		showMenuForClick(menu, evt);
	});

	if (active === '') return;
	// The one-click way back to "All types". The Deliverables board returns above
	// without one: nothing narrows that board, so there is nothing to clear.
	const clear = wrap.createEl('button', {
		cls: 'pbl-focus-clear clickable-icon',
		attr: { type: 'button', 'aria-label': 'Show all types', [KEY_ATTR]: 'focus-clear' },
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
 * What this projection is counting — its own population, which is not the same question
 * for all four. The Deliverables board draws `model.deliverableResults`; the
 * requirements board draws every result EXCEPT a Deliverable, which it excludes by
 * construction; the tree and the roadmap draw all of them.
 *
 * One function because two toolbar readouts sit beside each other and have to agree:
 * the count label and the completed toggle's "(N hidden)". They did not — the label was
 * scoped and the toggle was not, so the requirements board could report one item while
 * offering to reveal another that pressing the button would never show.
 */
function countedPopulation(host: BacklogViewHost, model: BacklogModel): BacklogItem[] {
	if (host.projection === 'deliverables') return model.deliverableResults;
	if (host.projection === 'board') return model.results.filter((item) => !isDeliverableType(item.typeName));
	return model.results;
}

/**
 * The type the PRIMARY New button makes — `newItemType`'s focus-following answer,
 * filtered through the very list the chevron beside it offers.
 *
 * Both creators have to draw from one list or the narrower one is decoration. Found
 * by review: `newItemType` returns the focus TARGET, and a `Deliverable` focus left
 * active from another projection made the requirements board's primary button read
 * "New Deliverable" — writing a note that board excludes — while the chevron beside
 * it had already withheld exactly that type. Falls back to the first type this
 * projection does offer, which is the ladder's top in every case today.
 */
function primaryNewType(host: BacklogViewHost, model: BacklogModel): string {
	const offered = offerableTypes(host);
	const focused = newItemType(host.settings, model);
	return offered.includes(focused) ? focused : offered[0];
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
