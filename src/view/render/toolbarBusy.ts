import { setIcon } from 'obsidian';
import { BacklogViewHost, BusyState } from '../host';
import { manualLink } from '../../ui/manualDialog';
import { manualSections } from '../manual/sections';
import { KEY_ATTR, setTextIfChanged } from './toolbarControls';
import { focusInBar, syncToolbarFit } from './toolbarFit';

/**
 * The write-in-flight indicator. Always rendered and hidden by CSS rather than
 * created on demand: progress ticks once per file, and rebuilding the toolbar for
 * each of them would be its own source of jank. `syncBusy` drives it in place.
 */
export function renderBusyIndicator(barEl: HTMLElement, host: BacklogViewHost): void {
	const busy = barEl.createDiv({ cls: 'pbl-busy', attr: { role: 'status', 'aria-live': 'polite' } });
	setIcon(busy.createSpan({ cls: 'pbl-busy-spinner' }), 'loader-2');
	busy.createSpan({ cls: 'pbl-busy-label' });
	// Built once and only ever re-TEXTED, never rebuilt: `syncBusyLabel` runs per file and
	// `empty()` plus two `createSpan`s three hundred times is the per-tick DOM churn the
	// deferred update exists to avoid.
	const count = busy.createSpan({ cls: 'pbl-busy-count', attr: { 'aria-hidden': 'true' } });
	count.createSpan({ cls: 'pbl-busy-done' });
	count.createSpan({ cls: 'pbl-busy-of' });
	// The door into `Help for safe writes and undo`. This caller overrides `manualLink`'s
	// default refocus rather than relying on it: `.pbl-busy` is hidden by CSS the moment
	// the batch that opened it ends, so by closing time the default's own resolve would
	// find a link that is connected but invisible — exactly the case that default exists
	// to refuse. Landing on the `?` button through `focusInBar` is what the toolbar's own
	// help button already does, resolved at close time for the same reason.
	// Keyed like every other focusable toolbar control, even though it never survives its
	// own rebuild via that mechanism — `syncBusy` only ever re-texts this indicator, never
	// rebuilds it, so the key exists to satisfy the invariant `test/view/toolbarFocus.test.ts`
	// checks over the whole row rather than to do restoring work of its own.
	// `root: barEl` here is never actually read — the explicit `onClosed` below always
	// wins over the default resolve it would drive — but the field is required so every
	// caller states one rather than a caller-that-overrides being the one place the
	// question goes unanswered.
	manualLink(busy, host.app, manualSections(), { sectionId: 'writes', label: 'What is happening', root: barEl }, () =>
		focusInBar(barEl, barEl.querySelector<HTMLElement>('.pbl-help-btn')),
	).setAttribute(KEY_ATTR, 'busy-help');
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
 *
 * **This is also where a focus stranded by the indicator hiding is caught.** `.pbl-busy`
 * carries the busy-help link — the first focusable element it has ever held — and
 * `syncBusyLabel` drops `pbl-busy-on` the moment a batch ends, which makes the container
 * `display: none` in `styles/busy.css`. A browser blurs a focused descendant to `<body>`
 * the instant its container is hidden that way; `manualLink`'s own tier-2 root-focus
 * fallback cannot catch it because that only runs while the DIALOG closes, and this
 * transition can land well after the dialog is long shut (open the manual from "What is
 * happening", close it, and only then does the batch that was already finishing end).
 * Caught here because this is where the transition is owned: `hadFocus` is read before
 * `syncBusyLabel` flips the class, so it asks the DOM the true "was focus in here"
 * question rather than inferring it from `busy`, and the refocus fires only on the
 * shown-to-hidden edge, onto the same `.pbl-help-btn` destination `focusInBar` already
 * uses for both toolbar doors.
 */
export function syncBusy(barEl: HTMLElement, busy: BusyState | null, canUndo: boolean): void {
	const el = barEl.querySelector<HTMLElement>('.pbl-busy');
	if (el) {
		const hadFocus = el.contains(document.activeElement);
		// Only on the visibility transition — see `syncBusyLabel`, which is what answers it.
		if (syncBusyLabel(el, busy)) syncToolbarFit(barEl);
		if (hadFocus && busy === null) focusInBar(barEl, barEl.querySelector<HTMLElement>('.pbl-help-btn'));
	}
	barEl.querySelectorAll<HTMLButtonElement>('.pbl-write-ctl').forEach((btn) => {
		btn.disabled = busy !== null;
	});
	// Undo pauses with every other write control, but comes back only when the
	// slot holds something — which the batch that just finished usually ensures.
	const undoBtn = barEl.querySelector<HTMLButtonElement>('.pbl-undo-btn');
	if (undoBtn) undoBtn.disabled = busy !== null || !canUndo;
}
