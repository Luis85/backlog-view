// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { syncBusy } from '../../src/view/render/toolbar';
import { syncToolbarFit } from '../../src/view/render/toolbarFit';
import { fixture, key, makeView, refresh, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * jsdom lays nothing out, so both widths are 0 and the ladder would decide nothing. The
 * stub is the instrument: `clientWidth` is the pane, and `scrollWidth` answers for the
 * step currently written — which is what makes this a test of the LOOP rather than of a
 * single comparison.
 */
const stubWidths = (bar: HTMLElement, pane: number, needs: Record<string, number>) => {
	Object.defineProperty(bar, 'clientWidth', { value: pane, configurable: true });
	Object.defineProperty(bar, 'scrollWidth', {
		get: () => needs[bar.getAttribute('data-pbl-fit') ?? '0'],
		configurable: true,
	});
};

/**
 * The same instrument with the browser's own floor on it: `scrollWidth` is never reported
 * SMALLER than the client box, whatever the content actually needs. Every other case here
 * feeds a hand-picked pair, which is what made a comparison against `clientWidth - padding`
 * invisible to the whole suite while it pinned the real toolbar at its last rung.
 *
 * The inline padding is half the instrument and not decoration. jsdom computes no
 * stylesheet, so `getComputedStyle(bar).paddingLeft` is empty for a bar the real
 * stylesheet pads — which means a subtraction that reads it is a subtraction of ZERO here,
 * and the floored stub alone would have watched the reverted code pass. Written as an
 * inline style because that is the one thing jsdom's computed style does reflect.
 */
const stubFlooredWidths = (bar: HTMLElement, pane: number, content: number) => {
	bar.style.paddingLeft = '8px';
	bar.style.paddingRight = '8px';
	Object.defineProperty(bar, 'clientWidth', { value: pane, configurable: true });
	Object.defineProperty(bar, 'scrollWidth', {
		get: () => Math.max(content, pane),
		configurable: true,
	});
};

/**
 * The SHIPPED rules, in the document, so a question about what a step hides is asked of
 * the stylesheet rather than of a copy of it. jsdom applies no stylesheet of its own but
 * it does parse one it is given — `:not()` chains included — so
 * `getComputedStyle(el).display` becomes a real answer, which is what
 * `refocusShedControl` reads.
 *
 * BOTH partials, in the order `styles/index.css` declares them, and that is not tidiness.
 * The `⋯` and the filter's reveal are `display: none` by DEFAULT — that rule is in
 * `toolbar.css` — and `toolbarFit.css` only turns them ON from step 2. Loading the fit
 * partial alone left both reading as visible at step 0, which is precisely the state the
 * relaxing-direction test is about, so the test would have asked its question of a
 * document where the answer could not be wrong.
 *
 * In `head`, once for the module: `useViewHarness` empties the BODY between tests.
 */
for (const partial of ['styles/toolbar.css', 'styles/toolbarFit.css']) {
	document.head.createEl('style', { text: readFileSync(partial, 'utf8') });
}

const toolbarOf = (containerEl: HTMLElement) => {
	const bar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
	if (!bar) throw new Error('toolbar not rendered');
	return bar;
};

describe('the toolbar fit ladder', () => {
	it('stops at the first step that fits', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });

		syncToolbarFit(bar);

		expect(bar.getAttribute('data-pbl-fit')).toBe('2');
	});

	/**
	 * The review finding that moved the last rung from 3 to 5. Reaching a rung is not the
	 * same as fitting on it: at a 500px pane the row measured 588 with step 3 written, and
	 * what fell off the clipped right edge was the New button — while `1 note ignored`,
	 * which precedes it in the row, survived. The rule the two rungs below step 3 state is
	 * that the primary action outranks every readout.
	 *
	 * What this asserts is the ladder's reach, which is the half jsdom can see. That step
	 * 4 hides the advisories and step 5 the count is `styles/toolbarFit.css`, applied by
	 * no stylesheet here — a browser check, on Task 6's list.
	 */
	it('keeps shedding past the controls, because reaching a rung is not fitting on it', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 420, { '0': 980, '1': 900, '2': 820, '3': 588, '4': 500, '5': 415 });

		syncToolbarFit(bar);

		expect(bar.getAttribute('data-pbl-fit')).toBe('5');
	});

	/**
	 * The regression this exists for, and the reason it is stubbed differently from every
	 * other case in this file. A row that fits with room to spare must settle at step 0 —
	 * but a browser floors `scrollWidth` at `clientWidth`, so it reports "exactly full"
	 * rather than "300px of slack", and any comparison that subtracts from the client box
	 * reads that as overflow at EVERY width and climbs to the last rung. That shipped:
	 * `clientWidth - padding` pinned the toolbar at `data-pbl-fit="5"` from 1200px down,
	 * shedding the count and both advisories where they fit easily (2026-08-08).
	 *
	 * Driving the ladder against a floored stub is what makes the arithmetic checkable
	 * here at all: with both numbers hand-picked, subtracting one from the other changes
	 * nothing a hand-picked pair can show. `stubFlooredWidths` also gives the bar real
	 * padding, because jsdom computes none from the stylesheet and a correction reading a
	 * padding of zero subtracts nothing. The floor and the padding are ONE instrument: the
	 * floored stub WITHOUT the padding was watched passing against the reverted code, which
	 * is how the pairing was found rather than assumed.
	 */
	it('settles at step 0 when the row fits, against a scrollWidth floored the way a browser floors it', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubFlooredWidths(bar, 1000, 700);

		syncToolbarFit(bar);

		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);
	});

	it('writes no attribute at all when everything fits', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 1200, { '0': 900, '1': 800, '2': 700, '3': 600, '4': 540, '5': 480 });

		syncToolbarFit(bar);

		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);
	});

	it('relaxes when the pane widens again', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 600, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('3');

		stubWidths(bar, 900, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		expect(syncToolbarFit(bar)).toBe(true);
		expect(bar.getAttribute('data-pbl-fit')).toBe('1');
	});

	it('holds the last verdict rather than deciding against a pane of zero width', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);

		// Detached, or before the first layout: jsdom's own answer, and a real pane's
		// while it is hidden. Deciding here would pick step 3 for every toolbar.
		Object.defineProperty(bar, 'clientWidth', { value: 0, configurable: true });
		expect(syncToolbarFit(bar)).toBe(false);
		expect(bar.getAttribute('data-pbl-fit')).toBe('2');
	});

	it('never reports a change when the step is the same', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		expect(syncToolbarFit(bar)).toBe(true);
		expect(syncToolbarFit(bar)).toBe(false);
	});

	/**
	 * The review finding this exists for: revealing the collapsed input adds ~130px to a
	 * row already measured as full, and no resize, render or data update follows the
	 * click — so without this the trailing controls clip under `overflow: hidden` until
	 * something unrelated happens to re-render.
	 */
	it('re-runs when the collapsed filter is revealed', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 720, '1': 690, '2': 600, '3': 560, '4': 540, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('1');

		// The reveal makes the row wider at every step; the ladder has to notice.
		stubWidths(bar, 700, { '0': 850, '1': 820, '2': 730, '3': 690, '4': 640, '5': 600 });
		containerEl
			.querySelector<HTMLElement>('.pbl-filter-reveal')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(bar.getAttribute('data-pbl-fit')).toBe('3');
	});

	/**
	 * `/` is the documented keyboard path to the filter, and a step that hides the input
	 * is where it would quietly stop working: `focus()` on a `display: none` element does
	 * nothing and reports nothing. Driven through the KEY rather than through
	 * `focusFilter`, so what is asserted is the path a user actually takes.
	 *
	 * Narrower than it reads, and the narrowing is the point. jsdom applies no stylesheet
	 * and focuses a `display: none` element happily, so the focus assertion here would
	 * pass with the refit AFTER the focus, or with the rung's rules absent altogether.
	 * What this file can hold is the two SIDE EFFECTS `revealFilter` is responsible for —
	 * the open flag is set, and the ladder has re-run — in the order the CSS needs them.
	 * That the input is then actually visible to a browser is a vault check.
	 */
	it('still reaches the input from the tree when the step has collapsed it', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('5');

		key(treeOf(containerEl), '/');

		expect(bar.hasClass('pbl-filter-open')).toBe(true);
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-filter-input'));
	});

	/**
	 * Clearing is the third input to `revealFilter`, and this drives the CLEAR BUTTON
	 * rather than Escape because the button is the half that still bites. Both run the
	 * same closure, but pressing the button puts focus on the button — and clearing is
	 * exactly what unrenders it, so without `revealFilter` the cursor is left on an
	 * element that is no longer shown. Escape never moves focus off the input, so nothing
	 * has to put it back.
	 *
	 * The version of this test that drove Escape went TAUTOLOGICAL when the rule moved to
	 * the focus listener, and it was found that way rather than reasoned about: gutting
	 * `clear()` to a bare `setFilter('')` left it passing on BOTH assertions, not the one
	 * predicted. `input.focus()` now sets `pbl-filter-open` by itself, and Escape leaves
	 * focus where it already was, so neither assertion depended on the closure any more.
	 */
	it('keeps the filter open and focused when the clear button empties it at a collapsing rung', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		const bar = toolbarOf(containerEl);

		view.setFilter('Epic'); // typed while the pane was wide
		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('5');

		// A real press focuses the button it presses; the click alone does not, in jsdom.
		const clearBtn = containerEl.querySelector<HTMLElement>('.pbl-filter-clear');
		clearBtn?.focus();
		clearBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The active class is gone with the text; the open flag has to have taken over,
		// and the cursor has to be back in the input rather than on a hidden button.
		expect(bar.hasClass('pbl-filter-open')).toBe(true);
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-filter-input'));
	});

	/**
	 * The fourth variant of one bug, and the reason the rule is now enforced in one place
	 * rather than at a fourth call site. Typing goes straight to `setFilter` — it does not
	 * pass through the `clear` closure Escape and the clear button share — so deleting the
	 * last character at a collapsing rung drops `pbl-filter-active` with the text, and
	 * nothing had ever set `pbl-filter-open`, so the rung hid an input the cursor was
	 * still in. No call-site fix could have reached this path.
	 *
	 * Driven through the real `input` event on an emptied value, which is what a backspace
	 * is, rather than through `setFilter`: the bug is that the listener bypasses the
	 * closure, so calling the closure would assert the opposite of the thing at issue.
	 */
	it('keeps the filter open when its last character is deleted at a collapsing rung', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		const input = containerEl.querySelector<HTMLInputElement>('.pbl-filter-input');

		// Typed while the pane was wide: focusing to type is what arms the rule.
		input?.focus();
		if (input) input.value = 'Epic';
		input?.dispatchEvent(new Event('input', { bubbles: true }));

		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('5');

		// Backspace over the last character. The text goes; the cursor does not.
		if (input) input.value = '';
		input?.dispatchEvent(new Event('input', { bubbles: true }));

		expect(bar.hasClass('pbl-filter-open')).toBe(true);
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-filter-input'));
	});

	/**
	 * The release the rule above needs, and the path that shows blur cannot be it: Escape
	 * in the TREE empties the filter with focus nowhere near the input, so nothing blurs.
	 * Without `syncFilterUi` clearing the flag, a filter opened once would stay open at
	 * every narrow width for the life of the view.
	 */
	it('lets go of a filter emptied from the tree, where nothing blurs', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		const input = containerEl.querySelector<HTMLInputElement>('.pbl-filter-input');

		input?.focus();
		if (input) input.value = 'Epic';
		input?.dispatchEvent(new Event('input', { bubbles: true }));
		expect(bar.hasClass('pbl-filter-open')).toBe(true);

		// Focus back in the tree, then Escape — the tree's own way to drop a filter.
		const tree = treeOf(containerEl);
		tree.focus();
		key(tree, 'Escape');

		expect(bar.hasClass('pbl-filter-open')).toBe(false);
	});

	/**
	 * The other end of the reveal, and the reason it is a blur rather than a timer: the
	 * row got ~130px wider to hold an input nobody is typing in, so leaving it has to give
	 * that width back — and only when it is EMPTY, or a filter someone is still using
	 * would be taken away by clicking anything else.
	 */
	it('collapses an empty revealed filter on blur, and keeps one with text in it', () => {
		const { view, containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);

		const input = containerEl.querySelector<HTMLInputElement>('.pbl-filter-input');
		key(treeOf(containerEl), '/');
		expect(bar.hasClass('pbl-filter-open')).toBe(true);

		// Typed into, then blurred: the text is the reason to stay open.
		view.setFilter('Epic');
		input?.dispatchEvent(new FocusEvent('blur'));
		expect(bar.hasClass('pbl-filter-open')).toBe(true);

		// Emptied, then blurred: nothing left to keep on the row.
		view.setFilter('');
		containerEl.querySelector<HTMLInputElement>('.pbl-filter-input')?.dispatchEvent(new FocusEvent('blur'));
		expect(bar.hasClass('pbl-filter-open')).toBe(false);
	});

	/**
	 * The rebuild path the test above cannot see. An EMPTY revealed filter is the one
	 * state nothing re-derives: `renderFilterBox` recomputes `pbl-filter-active` from the
	 * input's value on every render, so a filter with text in it survives a refresh by
	 * itself — but an empty one that `/` just opened would come back from a data update
	 * with the rung hiding it again, and `refocusByKey` would then focus a `display: none`
	 * input, which does nothing and reports nothing. The flag therefore lives on the
	 * toolbar, which `barEl.empty()` does not destroy.
	 */
	it('keeps an empty revealed filter open across a full toolbar rebuild', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);

		key(treeOf(containerEl), '/');
		expect(bar.hasClass('pbl-filter-open')).toBe(true);

		refresh(view, vault); // any data update rebuilds the toolbar

		expect(bar.hasClass('pbl-filter-open')).toBe(true);
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-filter-input'));
	});

	/**
	 * A theme or a font-size change moves rendered text without moving any box this view
	 * observes: the only `ResizeObserver` here watches the TREE, and no render follows a
	 * theme switch. Without the `css-change` subscription the row keeps a step chosen for
	 * the old metrics until the pane happens to be resized — which may be never.
	 *
	 * Driven through the workspace event rather than through a method, because the
	 * subscription is the thing that was missing. Observing `toolbarEl` instead would
	 * catch only a font change that alters the row's HEIGHT, and this is the width-only
	 * case at the same height, so it would look like a fix and miss the bug.
	 */
	it('re-runs when the app says its CSS changed', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 690, '1': 600, '2': 560, '3': 520, '4': 500, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);

		// A bigger interface font: the same boxes, wider text in them.
		stubWidths(bar, 700, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		vault.changeCss();

		expect(bar.getAttribute('data-pbl-fit')).toBe('2');
	});

	/**
	 * A rung takes a control out of the layout, and the user may be standing on it. Before
	 * this, narrowing the pane with focus on the ✨ dropped focus to the document and a
	 * keyboard user had to start the row again — the filter escaped it only because it was
	 * given three exceptions of its own across three rounds.
	 *
	 * Driven against the real stylesheet (see the `<style>` at the top of this file), so
	 * "hidden" means what `styles/toolbarFit.css` says rather than what a list here says.
	 */
	it('moves focus to the ⋯ when the rung sheds the control that had it', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		const backfill = containerEl.querySelector<HTMLElement>('.pbl-write-ctl');
		backfill?.focus();
		expect(document.activeElement).toBe(backfill);

		// Past the rung that sheds `.pbl-write-ctl`.
		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);

		expect(bar.getAttribute('data-pbl-fit')).toBe('5');
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-overflow-btn'));
	});

	/**
	 * The other arm, and the focus picker is the case worth using for it: step 1 hides the
	 * WORDS inside that button while the button itself survives every rung. A check that
	 * looked at what had changed inside a control, rather than at the control, would move
	 * focus here — and moving focus off a control that is still on the row is the same
	 * defect as losing it from one that is not.
	 */
	/**
	 * The other direction, and the one the first version of this got wrong. Relaxing to
	 * step 0 hides the `⋯` itself — it renders from step 2 — so a handler that always sent
	 * focus to the overflow button sent it to a hidden one and lost focus exactly as it
	 * had before the fix, just on the way back out.
	 *
	 * What is asserted is the RULE rather than a named destination: whatever holds focus
	 * afterwards is inside the bar and is not hidden. Naming the switcher's first button
	 * here would pin the fallback's choice, which is a judgement, not a guarantee.
	 */
	it('does not park focus on the ⋯ when widening is what hid it', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 600, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('3');

		const overflow = containerEl.querySelector<HTMLElement>('.pbl-overflow-btn');
		overflow?.focus();
		expect(document.activeElement).toBe(overflow);

		// The pane widens past every rung; the `⋯` goes back to being hidden.
		stubWidths(bar, 1200, { '0': 900, '1': 800, '2': 700, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);

		const landed = document.activeElement as HTMLElement;
		expect(bar.contains(landed)).toBe(true);
		expect(getComputedStyle(landed).display).not.toBe('none');
		expect(landed).not.toBe(overflow);
	});

	it('leaves focus alone when the control that has it survives the rung', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		const focusBtn = containerEl.querySelector<HTMLElement>('.pbl-focus-btn');
		focusBtn?.focus();
		expect(document.activeElement).toBe(focusBtn);

		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);

		expect(document.activeElement).toBe(focusBtn);
	});

	it('never reaches for focus that was outside this toolbar', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		const outside = treeOf(containerEl);
		outside.focus();

		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);

		expect(document.activeElement).toBe(outside);
	});

	/**
	 * The busy indicator is the one readout with no rung: at the last rung it stays and
	 * SHRINKS instead, because it is the only thing on the row saying a batch is running
	 * while half the controls beside it are disabled because of that batch.
	 *
	 * What that fix rests on, and all this file can hold of it: `.pbl-busy` is a DIRECT
	 * child of the toolbar. Both rules that reach it are flex rules on the toolbar's own
	 * children — the `flex: 0 0 auto` that keeps every control from being squeezed, and
	 * the last rung's `flex: 0 1 auto` that excepts this one — and a wrapper put around it
	 * would detach both silently, leaving the indicator unshrinkable again with nothing
	 * failing. The shrink ITSELF is a browser fact: jsdom applies no stylesheet and lays
	 * nothing out, so whether the row truncates rather than clipping New at 420px is on
	 * the vault list, not here.
	 */
	it('keeps the busy indicator a direct child of the row, which is what the flex rules reach', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);

		expect(bar.querySelector('.pbl-busy')?.parentElement).toBe(bar);
	});

	/**
	 * The write-in-flight indicator appears and disappears without a render, so the row
	 * gets wider twice per batch — but a refit per progress TICK would be a forced layout
	 * read per file, which is the cost the deferred update exists to avoid. The rule is
	 * therefore "on the visibility transition, and on nothing between", and both halves
	 * are asserted here: the second half is the one that would rot silently.
	 */
	/**
	 * What makes skipping the ticks safe, and it is now a property of the markup rather
	 * than of a reservation held over it: the DRAWN text is `Updating…` for every batch of
	 * every size, so no tick can change the row's width. The count is in the label's
	 * `title`, which costs no layout.
	 *
	 * Also the accessibility half, which is why the count is not in the text and not in
	 * `aria-label`: `.pbl-busy` is `role="status"` with `aria-live="polite"`, so its
	 * CONTENT is announced on every change. Per-tick text meant a 340-file backfill
	 * announced 340 times. Fixed content is announced once. That the announcement is
	 * actually made once is a screen-reader fact; what this holds is the thing underneath
	 * it — the content does not change.
	 */
	it('never changes the drawn text between ticks, and moves the count into the title', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		const label = () => bar.querySelector<HTMLElement>('.pbl-busy-label');

		syncBusy(bar, { done: 1, total: 340 }, false);
		expect(label()?.textContent).toBe('Updating…');
		expect(label()?.getAttribute('title')).toBe('Updating 1 of 340…');

		syncBusy(bar, { done: 47, total: 340 }, false);
		expect(label()?.textContent).toBe('Updating…');
		expect(label()?.getAttribute('title')).toBe('Updating 47 of 340…');

		// A single-file write is over before it could be read, so it carries no count at
		// all — the rule the visible label used to keep, now kept by the only place a
		// count appears.
		syncBusy(bar, null, false);
		syncBusy(bar, { done: 1, total: 1 }, false);
		expect(label()?.textContent).toBe('Updating…');
		expect(label()?.hasAttribute('title')).toBe(false);
	});

	it('re-runs when the busy indicator appears, and not on the ticks between', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 690, '1': 600, '2': 560, '3': 520, '4': 500, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);

		// Idle → busy: the indicator takes room the row was not measured with.
		stubWidths(bar, 700, { '0': 780, '1': 690, '2': 600, '3': 560, '4': 540, '5': 480 });
		syncBusy(bar, { done: 1, total: 340 }, false);
		expect(bar.getAttribute('data-pbl-fit')).toBe('1');

		// A tick. Even if the row claimed it had grown, nothing re-measures — which is
		// safe because the width genuinely cannot change between transitions: the visible
		// text is fixed, which is what the test below this one holds.
		stubWidths(bar, 700, { '0': 900, '1': 880, '2': 860, '3': 840, '4': 820, '5': 800 });
		syncBusy(bar, { done: 2, total: 340 }, false);
		expect(bar.getAttribute('data-pbl-fit')).toBe('1');

		// Busy → idle: a transition again, so it re-measures.
		stubWidths(bar, 700, { '0': 690, '1': 600, '2': 560, '3': 520, '4': 500, '5': 480 });
		syncBusy(bar, null, false);
		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);
	});
});
