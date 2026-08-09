/**
 * The toolbar's fit ladder: how much of the row this pane can hold, and what to drop
 * when it cannot hold all of it. The verdict and its application are in one file for the
 * reason `columnFit` and `syncColumnFit` are (`render/columns.ts`) — a threshold computed
 * in one place and applied in another is one edit from the two disagreeing.
 *
 * Where it parts company with `columnFit` is the instrument. `columnFit` SUMS its terms,
 * which it can do because a column's width is configured. A toolbar control's width is
 * its rendered label: the primary button names a type read from the vault, and every
 * string here is due to be translated. Nothing owns those widths, so this MEASURES —
 * and a measured ladder is also the one that stays right when a theme changes a font.
 *
 * jsdom lays nothing out, so both widths read 0 there; `test/view/toolbarFit.test.ts`
 * stubs them, exactly as the column-fit tests stub the pane.
 */

/** Where the verdict is written. Absent at step 0, which is "all of it fits". */
const FIT_ATTR = 'data-pbl-fit';

/**
 * The last rung. Below it the row genuinely clips: what is left at step 5 is the
 * switcher, the projection's own pickers, the focus, the eye, the filter icon, the `⋯`
 * and New, and none of those has a cheaper form.
 *
 * It was 3 until a browser measurement showed step 3 did not mean "fits" — at 500px the
 * row still needed 588 of a 500px pane, and what fell off the right edge was `.pbl-new`
 * while `1 note ignored` survived, because the status block precedes New in DOM order
 * and no rung shed a readout. Steps 4 and 5 are that finding: **the primary action
 * outranks every readout**, so the advisories go and then the count goes, in that order,
 * before the button that creates work does.
 */
const LAST_STEP = 5;

/**
 * Measure the row and write the step it needs. Returns true when the step CHANGED, so a
 * caller that has something to redo can tell — nothing does today, because every rung is
 * CSS over markup that is already rendered.
 *
 * Always re-measured from step 0, never from the step in place: a widened pane has to be
 * able to relax the ladder, and starting from the current rung could only ever tighten it.
 *
 * ## The one comparison, and the correction that was tried and refused
 *
 * `scrollWidth > clientWidth` is asymmetric, and the asymmetry is real: `clientWidth` is
 * the padding box, so it INCLUDES the bar's own left and right padding, while a flex
 * container's scrollable overflow does not reliably include the trailing one. The ladder
 * can therefore shed about one padding later than it strictly should — a few pixels of
 * late shedding right at a threshold.
 *
 * Subtracting the padding is the obvious correction and it is WRONG, which is why this
 * paragraph exists instead of the fix. `scrollWidth` is **floored at `clientWidth`**: a
 * browser never reports a scroll width smaller than the client box, so a row with 100px
 * to spare in a 1000px pane still reports `scrollWidth === clientWidth === 1000`. Compare
 * that against `1000 - 16` and the condition is true for every row at every width, the
 * loop climbs to `LAST_STEP` unconditionally, and the ladder pins at its last rung —
 * measured exactly that way at 1200px, where the count and both advisories were shed with
 * room to spare (2026-08-08). A few pixels of late shedding is strictly better than
 * shedding everything always.
 *
 * The jsdom suite could not see it: `stubWidths` defines both widths as synthetic numbers,
 * so any arithmetic between them is invisible there. `test/view/toolbarFit.test.ts` now
 * carries one case whose stub FLOORS `scrollWidth` at the stubbed `clientWidth` the way a
 * browser does, which is what makes subtracting from the client box fail a test rather
 * than a vault.
 */
/**
 * A rung sheds a control by taking it out of the layout, and a keyboard user may be
 * STANDING on it — narrow the pane while focus is on the density toggle, jump-to-today,
 * the ✨ or either bulk collapse control and the button under the cursor stops existing,
 * dropping focus to the document. The filter survived this only because it was given its
 * own exception, three times over; these never had one.
 *
 * Fixed here, once, where the step changes, rather than per control or as five more CSS
 * exceptions — a rung added later inherits it without knowing it exists.
 *
 * The destination is the `⋯`, and it is the right one rather than a convenient one: the
 * overflow menu is exactly where a shed control's command went, so focus follows the
 * command it was on. It is rendered from step 2, which is where shedding of anything
 * FOCUSABLE begins — step 1 hides only `.pbl-btn-label` spans, which take no focus — so
 * it is always there when this fires.
 *
 * `display` is asked of the element itself, with no list of which classes each rung
 * sheds: the stylesheet already holds that and a copy in TypeScript is the table this
 * codebase keeps having to un-write. It works because every rung targets the focusable
 * element DIRECTLY. A future rung that hid a container instead would need
 * `checkVisibility`/`offsetParent` and this comment is where that would have to change —
 * both read as hidden for everything in jsdom, which is why the cheap check is also the
 * testable one. `test/view/toolbarFit.test.ts` drives this by loading the real
 * `styles/toolbarFit.css` into the document, so what it asks is the shipped rule.
 */
function refocusShedControl(barEl: HTMLElement): void {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !barEl.contains(active)) return;
	if (getComputedStyle(active).display !== 'none') return;
	barEl.querySelector<HTMLElement>('.pbl-overflow-btn')?.focus({ preventScroll: true });
}

export function syncToolbarFit(barEl: HTMLElement): boolean {
	const before = barEl.getAttribute(FIT_ATTR);
	const width = barEl.clientWidth;
	// Zero while detached or before the first layout — `syncColumnFit`'s rule, for the
	// same reason: every row overflows a pane of no width, so deciding here would put
	// every toolbar on the last rung and leave it there until something re-measured.
	if (width === 0) return false;
	barEl.removeAttribute(FIT_ATTR);
	let step = 0;
	while (step < LAST_STEP && barEl.scrollWidth > width) {
		step += 1;
		barEl.setAttribute(FIT_ATTR, String(step));
	}
	const changed = barEl.getAttribute(FIT_ATTR) !== before;
	// Only on a change: nothing newly disappeared when the step stayed put, and a
	// no-op that walks to `document.activeElement` on every resize tick is a cost for
	// nothing.
	if (changed) refocusShedControl(barEl);
	return changed;
}
