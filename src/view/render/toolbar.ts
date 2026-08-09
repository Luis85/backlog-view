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

	// 1 — what you came to do. The primary action leads the row: it is the one control
	// here that ADDS to the backlog, and reading order is where a primary action belongs.
	// It also settles what no rung could: New is no longer last, so the clip at a very
	// narrow pane takes a readout instead of the button — see
	// `docs/requirements/A toolbar that fits one row.md`, extension 4b.
	renderNewButton(host, barEl, model);
	// Two groups side by side read as one six-segment strip without this.
	barEl.createDiv({ cls: 'pbl-toolbar-sep' });

	// 2 — where am I. The switcher says what the rest of the row is about.
	renderModeToggle(host, barEl);

	// 3 — what THIS projection owns, and nothing when it owns none. Draws its own
	// leading separator, or neither.
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
	renderBusyIndicator(barEl);

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
 * The write-in-flight indicator. Always rendered and hidden by CSS rather than
 * created on demand: progress ticks once per file, and rebuilding the toolbar for
 * each of them would be its own source of jank. `syncBusy` drives it in place.
 */
function renderBusyIndicator(barEl: HTMLElement): void {
	const busy = barEl.createDiv({ cls: 'pbl-busy', attr: { role: 'status', 'aria-live': 'polite' } });
	setIcon(busy.createSpan({ cls: 'pbl-busy-spinner' }), 'loader-2');
	busy.createSpan({ cls: 'pbl-busy-label' });
	// Built once and only ever re-TEXTED, never rebuilt: `syncBusyLabel` runs per file and
	// `empty()` plus two `createSpan`s three hundred times is the per-tick DOM churn the
	// deferred update exists to avoid.
	const count = busy.createSpan({ cls: 'pbl-busy-count', attr: { 'aria-hidden': 'true' } });
	count.createSpan({ cls: 'pbl-busy-done' });
	count.createSpan({ cls: 'pbl-busy-of' });
}

/**
 * The visible progress — "12 of 340" — and the two things that make it safe to show.
 *
 * **`aria-hidden`, so the row can count without announcing.** `.pbl-busy` is
 * `role="status"`, so its content is announced whenever it changes; a per-file number in
 * it is a 340-note backfill announced 340 times, which is the defect the fixed label was
 * introduced to fix. Hiding the counter from the accessibility tree keeps the announced
 * content the static `Updating`, said once when the batch starts. The count is still
 * reachable without sight — it stays in the label's `title`, which names nothing above it
 * and so cannot make the region's own name change.
 *
 * That is a claim about how a live region treats a mutation inside an `aria-hidden`
 * descendant, and it is a SPEC claim rather than a measured one: no screen reader runs
 * here. It is on the vault list.
 *
 * **A width that cannot change mid-batch.** The done number is the only part that varies
 * and it is `min-width`-reserved to the digit count of the TOTAL, which is fixed for the
 * whole batch, with `tabular-nums` so every digit is exactly the `ch` the reservation is
 * written in. So `1 of 340` and `340 of 340` occupy the same box and the row never
 * re-flows between the two visibility transitions the ladder actually measures at. This
 * is the fifth attempt at that readout and the first that is exact rather than
 * approximate: `ch` is font-relative, so it re-resolves on a theme or font change by
 * itself, where the pixel reservation this replaces was measured once and went stale.
 */
function syncBusyCount(el: HTMLElement, busy: BusyState | null): boolean {
	const done = el.querySelector<HTMLElement>('.pbl-busy-done');
	const of = el.querySelector<HTMLElement>('.pbl-busy-of');
	if (!done || !of) return false;
	// A single-file write is over before it could be read, so it gets no count at all —
	// and the label wears the ellipsis instead, which is why that string is chosen here
	// rather than being one fixed word.
	const counting = busy !== null && busy.total > 1;
	setTextIfChanged(done, counting && busy ? String(busy.done) : '');
	setTextIfChanged(of, counting && busy ? ` of ${busy.total}` : '');
	// Published as a custom property rather than set as `min-width` directly: every number
	// this codebase computes in TS reaches CSS that way (`--pbl-prop-col`, `--pbl-depth`,
	// `--pbl-today-left`), so the stylesheet holds what the reservation MEANS and this
	// holds only how wide it is.
	done.setCssProps({ '--pbl-busy-digits': counting && busy ? `${String(busy.total).length}ch` : '0' });
	// …and the ladder re-measures when the DIGIT COUNT changes, which is the one tick where
	// the reservation is certainly wrong: `digits(total)ch` cannot hold a value a digit
	// longer, whatever the font does. Twice in a 340-file batch rather than 340 times, so
	// it costs two forced layout reads and not three hundred — the per-tick measurement
	// this design exists to avoid is still avoided.
	//
	// **It does not cover width changes WITHIN a digit count, and cannot.** Where
	// `tabular-nums` applies there are none, because every digit is one `ch`. Where the
	// interface font declines it, `111` and `888` are different widths and no comparison
	// of the VALUE can see that — only measuring the element can, which is the per-tick
	// forced layout this trades away. The residue is a few pixels at the row's right end,
	// on a font without tabular figures, mid-batch, near a threshold; the row clips rather
	// than wraps, so it costs the edge of a readout and not a control. Declining a
	// rendered-width check for it is a judgement about proportion, recorded here because
	// it was raised in review and will be again.
	//
	// Recorded on the counter, which is inside the `aria-hidden` subtree, rather than on
	// `.pbl-busy` itself: an attribute write on a live region is a question this file has
	// been wrong about once already, and one it does not need to ask.
	const digits = counting && busy ? String(busy.done).length : 0;
	const moved = done.dataset.pblDigits !== String(digits);
	done.dataset.pblDigits = String(digits);
	return moved;
}

/**
 * A text write that is not a DOM mutation when the text has not changed. Both callers
 * write into a live region — `.pbl-busy` is `role="status"` and `.pbl-count-label`
 * carries an `aria-live="polite"` of its own — and **a live region announces on
 * MUTATION, not on a changed value**: `setText` assigns `textContent`, which destroys
 * the text node and builds a new one even when the string is identical. So the fixed
 * label a redesign introduced to stop a 340-file backfill announcing 340 times still
 * announced 340 times, and the count label — which is rewritten on every content render
 * — announced once per filter keystroke. The guard is what makes "the drawn text does
 * not change" a fact about the DOM rather than about the string.
 *
 * Two call sites in one file, so a two-line local rather than a shared helper module.
 */
function setTextIfChanged(el: HTMLElement, text: string): void {
	if (el.textContent !== text) el.setText(text);
}

/**
 * The indicator's own half of `syncBusy`: the on/off flag, the label, and the count.
 * Reports whether the row's WIDTH may have changed — the indicator appearing or going, or
 * the count gaining a digit — so the ladder's schedule follows from what the markup can
 * actually do rather than from a promise the markup has to be held to.
 *
 * **The visible text never changes while a batch runs.** It is `Updating…` for every
 * batch, of any size, and the count lives in the label's `title` instead. That is the
 * whole mechanism now; what it replaced was a measured pixel reservation
 * (`reserveBusyLabel`, `--pbl-busy-w`) that existed so a per-file text change could not
 * move the row. Five defects came out of that one readout in a row — a stylesheet
 * constant cannot bound `writes.length`; `N` `ch` does not bound an `N`-character string;
 * the longest value is not the widest label without tabular figures; it had no rung, so
 * it helped push the primary action off the edge; and the reservation went stale across a
 * `css-change` mid-batch, because it was taken once at the transition while ticks
 * deliberately skip refits. Every one was right, and together they said the design was
 * wrong: a measurement, a reservation, a font-feature dependency and a refit schedule,
 * all so one advisory readout would not move. A label that cannot change cannot move.
 *
 * **The count is in `title`, NOT in the text and NOT in `aria-label`, and that is the
 * non-obvious part.** `.pbl-busy` is `role="status"` with `aria-live="polite"`, so its
 * CONTENT is announced whenever it changes — which the old per-tick label meant a
 * three-hundred-file backfill was announced three hundred times. A per-tick `aria-label`
 * would be the same defect wearing a different attribute. Fixed content is announced
 * once, when the batch starts, which is the one thing worth saying — and it is fixed
 * through `setTextIfChanged`, because a `setText` of the same string is still a
 * `childList` mutation inside the region and a region announces on the mutation.
 *
 * The `title` goes on the LABEL SPAN rather than on `.pbl-busy` itself: `title` is the
 * last-resort source for an accessible NAME, so on the status element it would make the
 * region's own name change per file — the announcement problem again, one level up. A
 * descendant's `title` names nothing above it.
 *
 * A raw `title` attribute rather than this codebase's usual `setTooltip`, deliberately:
 * `setTooltip` attaches Obsidian's hover handling on every call and has set `aria-label`
 * in some versions, which is the one attribute this must not touch. The native attribute
 * is a string write, costs no layout, and shows on hover without a listener.
 */
function syncBusyLabel(el: HTMLElement, busy: BusyState | null): boolean {
	// Captured before the toggle: the ladder re-runs on idle→busy and busy→idle, plus the
	// one or two ticks where the count gains a digit, and NOT on the rest. `scrollWidth`
	// is a forced layout read, so measuring per file would put back a cost of the same
	// shape as the per-file re-render the deferred update removed.
	const wasOn = el.hasClass('pbl-busy-on');
	el.toggleClass('pbl-busy-on', busy !== null);
	const labelEl = el.querySelector<HTMLElement>('.pbl-busy-label');
	// Two possible strings, and which one is chosen depends only on the batch's SIZE, so
	// it is settled at the transition and constant across every tick between. The counted
	// form drops the ellipsis because the count follows it and reads as the continuation.
	const counting = busy !== null && busy.total > 1;
	if (labelEl) setTextIfChanged(labelEl, busy ? (counting ? 'Updating' : 'Updating…') : '');
	if (busy && counting) labelEl?.setAttribute('title', `Updating ${busy.done} of ${busy.total}…`);
	else labelEl?.removeAttribute('title');
	// EITHER thing can change the row's width, so either is worth a re-measure: the
	// indicator appearing or going, and the count gaining or losing a digit.
	const grew = syncBusyCount(el, busy);
	return wasOn !== (busy !== null) || grew;
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
	// The release the focus listener in `renderFilterBox` needs. Blur alone cannot be it:
	// blur keeps a non-empty filter open on purpose, so a filter emptied LATER from
	// somewhere else — Escape in the tree does exactly that, with focus in the tree —
	// would leave the flag set on a filter that is neither used nor focused, and the row
	// would carry an empty input at every narrow width until someone clicked into it.
	// Here rather than beside the flag's two writers because this is the function whose
	// whole job is re-deriving this box from `host.filterText`, and it already owns the
	// other class that answers the same question. Callers that clear and then re-open —
	// `clear()`, the no-match empty state — run `revealFilter` AFTER `setFilter`, so they
	// set the flag back on the far side of this.
	if (host.filterText === '' && document.activeElement !== input) barEl.removeClass('pbl-filter-open');
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
	setTextIfChanged(label, shown === total ? `${total} item${total === 1 ? '' : 's'}` : `${shown} of ${total}`);
	// The tooltip is guarded the same way and for a sharper reason than the text: this
	// element is `aria-live`, and `setTooltip` attaches Obsidian's hover handling on every
	// call and has set `aria-label` in some versions — see `syncBusyLabel`, which avoids
	// it entirely for exactly that. The last breakdown is kept in `dataset` because
	// nothing can read a tooltip back off an element, and a `data-` attribute is not a
	// mutation any live region reports.
	const breakdown = levelBreakdown(population);
	if (label.dataset.pblBreakdown === breakdown) return;
	label.dataset.pblBreakdown = breakdown;
	setTooltip(label, breakdown);
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
	// THE rule, enforced once: a filter that has focus is never collapsed. Four bugs of
	// one shape were fixed at four call sites before this listener existed — `/`, the
	// clear button, Escape, and finally typing the last character back out, which reaches
	// `setFilter` directly and so could never be fixed by anything `clear()` did. Setting
	// the flag where focus ARRIVES means every path inherits it without knowing about it,
	// including the next one nobody has thought of. No refit is needed here: the flag only
	// changes what is drawn below the rung that collapses this input, and `revealFilter`
	// is what reaches focus from there — it has already refitted before focusing.
	input.addEventListener('focus', () => barEl.addClass('pbl-filter-open'));
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
