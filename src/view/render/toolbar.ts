import { Menu, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost, Projection } from '../host';
import { newItemType, promptCreateItem } from '../interactions/create';
import { offerableTypes, showMenuForClick } from '../interactions/menu';
import { runInit } from '../interactions/structure';
import {
	capturedFocusKey,
	CLICK_ACTION_LABEL,
	clickActionApplies,
	clickActionToggle,
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
import { focusInBar } from './toolbarFit';
import { renderBusyIndicator } from './toolbarBusy';
import { countedPopulation, levelBreakdown, renderIgnoredNote } from './toolbarStatus';
import { renderFilterBox } from './toolbarFilter';
import { BacklogModel } from '../../domain/model';
import { focusTarget } from '../../domain/itemTypes';
import { DELIVERABLE_TYPE } from '../../domain/typeVocabulary';
import { configProblems } from '../../domain/settingsConsistency';
import { manualLink, openManual } from '../../ui/manualDialog';
import { manualSections } from '../manual/sections';

/**
 * Re-exported so `backlogView.ts` and the test suite keep one import path into the
 * toolbar rather than one per subject file — this module was the toolbar's address
 * before the split into `toolbarBusy.ts` / `toolbarStatus.ts` / `toolbarFilter.ts`, and
 * still is for anything outside `render/`. Nothing here reads these; they pass straight
 * through.
 */
export { syncBusy } from './toolbarBusy';
export { detectIgnoredGrouping, syncCountLabel } from './toolbarStatus';
export { revealFilter, syncFilterUi } from './toolbarFilter';

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

	// 1 — where am I. The switcher leads: it says what the rest of the row is about, and
	// what the primary action beside it will make.
	renderModeToggle(host, barEl);

	// 2 — what you came to do. The one control here that ADDS to the backlog, kept at the
	// head of the row with the switcher: the clip at a very narrow pane runs from the
	// RIGHT, so both survive it — see `docs/requirements/A toolbar that fits one row.md`,
	// extension 4b. No divider between the two: each is its own bordered
	// `.pbl-btn-group`, so the boxes already say where one control ends and the next
	// begins, and a line between them draws a boundary that is drawn twice.
	renderNewButton(host, barEl, model);

	// 3 — what THIS projection owns, and nothing at all when it owns none. Set off from
	// the two groups above by its own spacing rather than by a divider, so an empty zone
	// leaves nothing behind to remove.
	renderProjectionZone(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-spacer' });

	// 4 — what is shown. The same controls in every projection.
	//
	// The `⋯` leads them, and that IS load-bearing now, where its old placement beside
	// undo was explicitly not: the menu reads the bar's DOM at click time so it works
	// from anywhere, but the row CLIPS from the right, and this is the one control whose
	// loss takes every shed control with it. Measured at 380px it was the first thing
	// cut when it sat last; here the clip reaches undo and the indicator first and the
	// escape hatch is the last thing standing. It costs nothing above step 2, where the
	// stylesheet has it `display: none`.
	renderOverflow(host, barEl);
	renderFocusPicker(host, barEl, model);
	// Expand and collapse drive the tree's rows and a dated-axis timeline row's chevron —
	// never a card's own children disclosure, which lives on a separate bit
	// (`CARD_SCOPE`, `collapseState.ts`) these buttons never write to at all. They are not
	// gated on the projection — but they ARE gated on the screen having something to
	// collapse: see `syncCollapseCtls`, which runs after the content render because that is
	// what fills the set it reads.
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
	renderClickActionToggle(host, barEl);
	renderFilterBox(host, barEl);

	// The general door to the manual. Zone 4 because it is the same in every projection,
	// and last in it because the fit ladder sheds it at step 2 — of everything on this row
	// it is the one control whose use is never urgent, and step 2 is the earliest rung at
	// which shedding is possible at all, since that is where the `⋯` it sheds into first
	// renders.
	const helpBtn = iconButton(barEl, 'help-circle', 'Open the manual', 'help');
	helpBtn.addClass('pbl-help-btn');
	helpBtn.addEventListener('click', () => {
		// Resolved at CLOSE time, not captured. `renderToolbar` empties the bar on any
		// full render — a Bases data refresh while the manual is open is enough — and
		// `helpBtn` is then a detached node that `focus()` silently does nothing with.
		// Same reason the overflow entry queries rather than captures; `focusInBar`
		// handles the replacement being hidden at the current rung.
		openManual(host.app, manualSections(), 'types', () =>
			focusInBar(barEl, barEl.querySelector<HTMLElement>('.pbl-help-btn')),
		);
	});

	barEl.createDiv({ cls: 'pbl-toolbar-sep' });

	// 5 — what writes, and what says a write is happening. The ✨ is the one command that
	// routinely writes hundreds of
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
	// The indicator belongs to this zone rather than to the status block it used to sit
	// in. The ✨ and undo above it go `disabled` BECAUSE a batch is running, and the one
	// thing on the row that says so was four elements and a divider away — a legible
	// pause reads as a dead toolbar when the explanation is not beside the controls it
	// explains.
	renderBusyIndicator(barEl, host);

	// Classed, unlike the other two, because the last rung sheds it: the readouts it
	// divides are all gone by then, and a divider that divides nothing is width in front
	// of New. See `styles/toolbarFit.css`.
	barEl.createDiv({ cls: 'pbl-toolbar-sep pbl-status-sep' });

	// 6 — status: the notes, the warning, the count. All three advisories are
	// CONDITIONAL, which is why the count's divider below is decided from what was drawn
	// rather than written unconditionally: on an ordinary view none of them renders, and
	// an unconditional divider would sit directly against the one above it — two rules
	// with a gap between them and nothing to divide. Same rule as
	// `renderProjectionZone`'s empty zone, asked the same way.
	const beforeAdvisories = barEl.childElementCount;
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
		// The door into `Help for setting up the view` — deliberately NOT drawn inside
		// `warn`. `styles/toolbarFit.css`'s last rung shrinks `.pbl-config-warning` and clips
		// it with `overflow: hidden` rather than hiding it outright, because it is the one
		// readout that must stay in the accessibility tree even when the row cannot show it
		// — its `aria-label` and tooltip still carry the whole sentence. That is the right
		// call for TEXT: a clipped span with a name is still reachable. It is the wrong call
		// for a CONTROL: a clipped-but-tabbable button is a focus target nobody can see.
		// Drawn as its own sibling instead: an ordinary non-shrinking toolbar child
		// (`.pbl-toolbar > *` defaults to `flex: 0 0 auto` — `toolbarFit.css`'s own opening
		// rule) — but being a sibling ALONE would have left it the last element on the row
		// (everything after it already shed by step 5), and so the first thing the last
		// rung's clip reaches: clipped alone while the DOM still claimed it was there. It
		// carries `[data-pbl-key='config-help']` for exactly that reason — `toolbarFit.css`'s
		// step 2 sheds it in the same rule as the help button, the filter and the density
		// toggle, so it is gone (hidden, not clipped) four rungs before the warning's own
		// clip ever runs. Nothing is withheld by this: `⋯ → Open the manual` survives every
		// rung and the dialog's own sidebar is one click from `setup`; only the deep link
		// itself is lost. `root: barEl` and an explicit `onClosed` through `focusInBar`,
		// like the busy indicator beside it: `barEl` itself carries no `tabindex`, so
		// `manualLink`'s own root-focus fallback cannot land on it, and a toolbar door
		// without a real destination of its own has to name one rather than lean on a
		// default that has nothing to reach.
		manualLink(barEl, host.app, manualSections(), { sectionId: 'setup', label: 'What to fix', root: barEl }, () =>
			focusInBar(barEl, barEl.querySelector<HTMLElement>('.pbl-help-btn')),
		).setAttribute(KEY_ATTR, 'config-help');
	}
	// The advisories and the count are the same size and the same faint colour, so with
	// nothing between them "1 note ignored" and "28 items" read as one sentence. They are
	// two: an aside about notes this base skipped, and the population in front of you.
	// This divider sheds with the ADVISORIES at step 4, not with the count at step 5 —
	// see `styles/toolbarFit.css` — and it is not drawn at all when there was no advisory
	// to divide from in the first place.
	//
	// WHICH rung sheds it depends on which advisory it follows, which is why it carries a
	// modifier rather than one class. Step 4 takes the two `.pbl-toolbar-note` advisories
	// but deliberately spares the config warning, so a divider that always shed at step 4
	// put the warning and the count back together at exactly the widths where the row is
	// under most pressure — the defect this divider exists to prevent, reappearing one
	// rung down. With the warning on screen the divider outlives step 4 and goes at step 5
	// with the count; with only notes behind it, it goes when they do.
	//
	// Asked of the DOM rather than of `problems.length` a few lines up: two conditions
	// that must agree are two conditions that can disagree, and the element either got
	// drawn or it did not.
	if (barEl.childElementCount > beforeAdvisories) {
		const survives = barEl.querySelector('.pbl-config-warning') !== null;
		barEl.createDiv({ cls: `pbl-toolbar-sep pbl-count-sep${survives ? '' : ' pbl-count-sep-with-notes'}` });
	}
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

	refocusByKey(barEl, refocusKey);
}

/**
 * The primary create button and the chevron beside it, leading the row.
 *
 * They are ONE control in two pieces and now say so: `.pbl-btn-group` is the switcher's
 * own segmented box, shared rather than copied, so the two groups in the row cannot come
 * to disagree about what a group looks like. Both buttons carry `clickable-icon` for the
 * same reason the switcher's do — the padding, the radius and the hover fill are the
 * app's, and a bare `<button>` here wore Obsidian's default chrome: a filled, bordered
 * box that read as a form submit rather than as one more control in a toolbar.
 *
 * The group also survives the last rung better than two neighbours would: the row clips
 * there, and a clip falls between two flex items far more readily than through the
 * middle of one.
 */
function renderNewButton(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	// The Deliverables board only ever shows Deliverables, so the primary button is
	// bound to that type unconditionally — never the focus-dependent `newItemType`,
	// which would offer a type this board would not even display. With one sensible
	// type there is nothing for a "New item of another type" picker to add, so it is
	// absent rather than a chevron opening a one-entry menu.
	const onDeliverables = host.projection === 'deliverables';
	const newLevel = onDeliverables ? DELIVERABLE_TYPE : primaryNewType(host, model);
	const wrap = barEl.createDiv({ cls: 'pbl-new pbl-btn-group' });
	// The name is explicit, not inherited from the text: the fit ladder hides
	// `.pbl-btn-label` on a narrow pane, and a primary button named only by the text it
	// just hid is an unnamed control. The key stays on the BUTTON — `refocusByKey` looks
	// for something to focus, and a wrapper div is not it.
	const newBtn = wrap.createEl('button', {
		cls: 'clickable-icon pbl-new-btn',
		attr: { [KEY_ATTR]: 'new', 'aria-label': `New ${newLevel}` },
	});
	setIcon(newBtn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	// Its own class beside the shared one: this is the label the ladder keeps longest,
	// and a rung has to be able to name it. See `styles/toolbarFit.css` steps 2 and 6.
	newBtn.createSpan({ cls: 'pbl-btn-label pbl-new-label', text: `New ${newLevel}` });
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

/**
 * The **Handling items** group's `clickAction` option, on the row beside the completed
 * toggle: the same `.base` setting, written through the same `config.set`, so the toolbar
 * and the view options are two surfaces over one value rather than two values that agree
 * until one of them is used. Nothing is decided here that `resolveItemHandling` does not
 * already decide — this only flips between the two values it declares.
 *
 * Drawn on the two ROW-shaped projections and nowhere else — `clickActionApplies` states
 * which and why. A toolbar toggle that changed nothing on the screen in front of you is
 * worse than an absent one, the same argument the completed toggle makes about the
 * Deliverables board one line above.
 *
 * The name is the SETTING and `aria-pressed` carries its value — the density toggle's
 * rule for the density toggle's reason: a name flipping to the next action would announce
 * "clicking a row opens the note, pressed" at the moment clicks were folding, which states
 * the opposite of what is true. The icon still swaps, because it is what a sighted reader
 * has and it says nothing to a screen reader.
 */
function renderClickActionToggle(host: BacklogViewHost, barEl: HTMLElement): void {
	if (!clickActionApplies(host)) return;
	const { folds, icon, flip } = clickActionToggle(host);
	const btn = iconButton(barEl, icon, CLICK_ACTION_LABEL, 'click-action');
	btn.addClass('pbl-click-action-toggle');
	btn.toggleClass('is-active', folds);
	btn.setAttribute('aria-pressed', String(folds));
	btn.addEventListener('click', flip);
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
		const btn = wrap.createEl('button', { cls: 'clickable-icon pbl-focus-btn', attr: { type: 'button' } });
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
		cls: 'clickable-icon pbl-focus-btn',
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
	const wrap = barEl.createDiv({
		cls: 'pbl-mode-toggle pbl-btn-group',
		attr: { role: 'group', 'aria-label': 'Projection' },
	});
	// `word` is the visible name and `label` stays the accessible one, which is why the
	// two are not the same string: "Tree" alone is not a purpose, and a name that read
	// only "Tree" would leave a reader to guess what pressing it does. Each `word` is a
	// substring of its `label`, so the visible text is inside the accessible name rather
	// than beside it — the thing speech control needs to match what a user can see.
	//
	// The span is `.pbl-btn-label`, the class the fit ladder's first rung already sheds,
	// so "if there is enough space" is answered by the same measurement that answers it
	// for every other labelled control. Four words is the widest thing in the row, so on
	// a narrow pane this is the first cost the ladder recovers — which is the intended
	// order, the icons and the active marker carrying the switcher on their own.
	const position = (mode: Projection, icon: string, label: string, word: string) => {
		const btn = iconButton(wrap, icon, label);
		btn.addClass('pbl-mode-btn');
		btn.createSpan({ cls: 'pbl-btn-label', text: word });
		btn.toggleClass('is-active', host.projection === mode);
		btn.setAttribute('aria-pressed', String(host.projection === mode));
		btn.addEventListener('click', () => host.setProjection(mode));
	};
	position('tree', 'list-tree', 'Show as backlog tree', 'Tree');
	position('board', 'square-kanban', 'Show as kanban board', 'Board');
	position('roadmap', 'map', 'Show as roadmap', 'Roadmap');
	position('deliverables', 'package', 'Show as Deliverables board', 'Deliverables');
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
