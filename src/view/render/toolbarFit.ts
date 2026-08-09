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
 * while `1 note ignored` survived, because the status block then preceded New in DOM
 * order and no rung shed a readout. Steps 4 and 5 are that finding, and step 6 is what
 * was left once New moved to the head of the row and stopped being what the clip took:
 * the readouts still go before the words, and the primary action's own label goes last of
 * all, after which only icons remain.
 *
 * Raising it is free and lowering it is not: `styles/toolbarFit.css` writes each rung as
 * "engaged, and not one of the rungs above this one", so a new rung at the bottom needs
 * no edit above it — but a number here smaller than the rungs that file defines leaves
 * the last of them unreachable, with nothing failing.
 */
const LAST_STEP = 6;

/**
 * Measure the row and write the step it needs. It reports nothing: every rung is CSS over
 * markup that is already rendered, so a caller has nothing to redo, and the one thing a
 * changed step does need — moving focus off a control the new step hides — is done here
 * rather than handed out as a boolean six call sites discarded.
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
 * **Focus something in this row that a rung has not taken away** — `target` when the
 * ladder currently leaves it focusable, the `⋯` when it does not, and the first visible
 * control when the `⋯` is hidden too.
 *
 * A rung sheds a control by taking it out of the layout, and a keyboard user may be
 * STANDING on it — narrow the pane while focus is on the density toggle, jump-to-today,
 * the ✨ or either bulk collapse control and the button under the cursor stops existing,
 * dropping focus to the document. The filter survived this only because it was given its
 * own exception, three times over; these never had one.
 *
 * Fixed here, once, rather than per control or as five more CSS exceptions — a rung
 * added later inherits it without knowing it exists. And here rather than in
 * `refocusShedControl` alone, because a rung changing is not the only way focus is asked
 * to land on a control the ladder has hidden: `refocusByKey` (`toolbarControls.ts`)
 * names a destination by key from FOUR restore paths, and a bare `focus()` on a hidden
 * or disabled element is a silent no-op that leaves focus on the document. The case that
 * exists is the `⋯` menu — while it is open focus is in Obsidian's body-mounted menu, so
 * `refocusShedControl` skips the handoff on its containment guard even though the rung
 * that just fired hid the `⋯` itself; the pick then restores focus to that hidden
 * trigger. Both halves of that intersection had been fixed separately, which is why the
 * shared destination is now one function rather than two agreeing ones.
 *
 * The rule is **focus lands on a control that is actually visible, preferring the `⋯`
 * when it is one** — one sentence covering both directions the ladder moves, rather than
 * a tightening path and a relaxing path that drift apart. The first version of this
 * handled tightening only and sent focus to the `⋯` unconditionally, which is wrong in
 * the other direction: relaxing to step 0 or 1 hides the `⋯` ITSELF (it renders from
 * step 2), so widening the pane with focus on it — or on `.pbl-filter-reveal`, which the
 * same relaxation hides — moved focus onto a hidden button and lost it exactly as before.
 *
 * The `⋯` is preferred rather than merely allowed because the overflow menu is where a
 * shed control's command went: focus follows the command it was on. When it is hidden
 * too, the fallback is the first visible control in the row, which is the switcher —
 * the control that says what the rest of the row is about, and a defensible place to
 * land.
 *
 * `disabled` is part of "visible enough to focus", learned the hard way: `.pbl-undo-btn`
 * starts disabled because there is nothing to undo, and `focus()` on a disabled button
 * is a silent no-op that drops focus to the document — the very failure this exists to
 * prevent, reintroduced by the fix.
 *
 * **Not taken: sending the reveal button's focus to the filter INPUT**, which is the same
 * control in its other form and would be the ideal destination for that one case. It does
 * not fall out of the rule — the input precedes the reveal in the box, so neither "the
 * `⋯`" nor "the first visible control" reaches it — and buying it costs a branch naming
 * one control, which is what this function exists to avoid having. That case lands on the
 * switcher with everything else.
 *
 * `target` is checked against the same `shown` list rather than focused and hoped for:
 * "is this element focusable right now" is the question the fallback exists to answer,
 * and asking it twice in two ways is how the two answers come to differ.
 *
 * `display` is asked of each element, with no list of which classes each rung sheds: the
 * stylesheet already holds that and a copy in TypeScript is the table this codebase keeps
 * having to un-write. It works because every rung targets the focusable element DIRECTLY.
 * A future rung that hid a container instead would need `checkVisibility`/`offsetParent`
 * and this comment is where that would have to change — both read as hidden for
 * everything in jsdom, which is why the cheap check is also the testable one.
 * `test/view/toolbarFit.test.ts` drives this by loading the real stylesheet into the
 * document, so what it asks is the shipped rule.
 */
export function focusInBar(barEl: HTMLElement, target: HTMLElement | null): void {
	// `[tabindex]` minus `[tabindex="-1"]`: nothing in the toolbar carries -1 today, but
	// it is this codebase's standard for a per-row control inside a single-stop pane, so
	// the first one added to this row would otherwise become a destination the ladder
	// hands focus to. What is wanted is what Tab can reach.
	const shown = [...barEl.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')].filter(
		(el) => getComputedStyle(el).display !== 'none' && !(el as HTMLButtonElement).disabled,
	);
	if (target && shown.includes(target)) {
		target.focus({ preventScroll: true });
		return;
	}
	(shown.find((el) => el.hasClass('pbl-overflow-btn')) ?? shown[0])?.focus({ preventScroll: true });
}

/**
 * The step just changed: if what held focus is inside this row, keep it somewhere the new
 * step still shows. Focus outside the bar is left alone — it is not this ladder's to move,
 * and the menu case that looks like an exception is `refocusByKey`'s, above.
 */
function refocusShedControl(barEl: HTMLElement): void {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !barEl.contains(active)) return;
	focusInBar(barEl, active);
}

export function syncToolbarFit(barEl: HTMLElement): void {
	const before = barEl.getAttribute(FIT_ATTR);
	const width = barEl.clientWidth;
	// Zero while detached or before the first layout — `syncColumnFit`'s rule, for the
	// same reason: every row overflows a pane of no width, so deciding here would put
	// every toolbar on the last rung and leave it there until something re-measured.
	if (width === 0) return;
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
}
