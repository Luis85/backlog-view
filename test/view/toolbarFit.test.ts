// @vitest-environment jsdom
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
	 * Clearing is the third input to `revealFilter`, and the path that proves it: a filter
	 * typed at a wide width is visible at a collapsing rung only through
	 * `pbl-filter-active`, so emptying it removes the one class holding it open while the
	 * cursor is still in it.
	 */
	it('keeps the filter open when it is cleared at a collapsing rung', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		const bar = toolbarOf(containerEl);

		view.setFilter('Epic'); // typed while the pane was wide
		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600, '4': 540, '5': 480 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('5');

		const input = containerEl.querySelector<HTMLInputElement>('.pbl-filter-input');
		input?.focus();
		input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		// The active class is gone with the text; the open flag has to have taken over.
		expect(bar.hasClass('pbl-filter-open')).toBe(true);
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-filter-input'));
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
	 * The write-in-flight indicator appears and disappears without a render, so the row
	 * gets wider twice per batch — but a refit per progress TICK would be a forced layout
	 * read per file, which is the cost the deferred update exists to avoid. The rule is
	 * therefore "on the visibility transition, and on nothing between", and both halves
	 * are asserted here: the second half is the one that would rot silently.
	 */
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

		// The reservation is MEASURED from this batch's own longest label, not counted
		// from it: `ch` is the advance of a "0" and bounds neither the letters nor the
		// other digits in a proportional theme font. jsdom measures everything as 0, so
		// what this can assert is that a pixel reservation was taken from the element
		// rather than computed from the string — the width being *right* is a vault
		// check, and it is on the checklist in Task 6.
		const label = bar.querySelector<HTMLElement>('.pbl-busy-label');
		expect(label?.style.getPropertyValue('--pbl-busy-w')).toMatch(/^\d+px$/);

		// A tick. Even if the row claimed it had grown, nothing re-measures — which is
		// only safe BECAUSE of the reservation above.
		stubWidths(bar, 700, { '0': 900, '1': 880, '2': 860, '3': 840, '4': 820, '5': 800 });
		syncBusy(bar, { done: 2, total: 340 }, false);
		expect(bar.getAttribute('data-pbl-fit')).toBe('1');

		// Busy → idle: a transition again, so it re-measures.
		stubWidths(bar, 700, { '0': 690, '1': 600, '2': 560, '3': 520, '4': 500, '5': 480 });
		syncBusy(bar, null, false);
		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);
	});
});
