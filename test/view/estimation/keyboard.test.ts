// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { click, makeEstimationView, selectItem } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';
import { flush, key } from '../../helpers/view';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', { frontmatter: { 'strategic-alignment': 5, compliance: 1, confidence: 4 } });
	vault.addFile('Second.md', { frontmatter: { compliance: 2 } });
	return vault;
}

describe('the estimation view from the keyboard', () => {
	it('gives each points group one tab stop rather than one per point', () => {
		// 8 dimensions at 1-5 plus three 1-5 scales is 55 point buttons on the shipped
		// default: 55 tab stops between the table and the note below it.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		for (const group of Array.from(containerEl.querySelectorAll('.pbl-est-points'))) {
			expect(group.getAttribute('role')).toBe('radiogroup');
			const stops = Array.from(group.querySelectorAll('button.pbl-est-point')).filter((b) => b.getAttribute('tabindex') === '0');
			expect(stops, 'exactly one tab stop per group').toHaveLength(1);
		}
	});

	it('puts the group tab stop on the held value, and on the first point when nothing is held', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const held = containerEl.querySelector('[data-dim="strategic-alignment"][data-value="5"]')!;
		expect(held.getAttribute('tabindex')).toBe('0');
		expect(held.getAttribute('aria-checked')).toBe('true');
		expect(held.getAttribute('aria-pressed')).toBeNull();
		const unheldFirst = containerEl.querySelector('[data-dim="reach"][data-value="1"]')!;
		expect(unheldFirst.getAttribute('tabindex')).toBe('0');
		expect(unheldFirst.getAttribute('aria-checked')).toBe('false');
	});

	it('moves and picks with the arrows, and holds at both ends', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const group = containerEl.querySelector('[data-dim="compliance"]')!.closest('.pbl-est-points') as HTMLElement;
		// Held is 1, the first point: ArrowLeft must not wrap to the last.
		key(group, 'ArrowLeft');
		expect(containerEl.querySelector('[data-dim="compliance"][data-value="1"]')!.getAttribute('tabindex')).toBe('0');
	});

	it('arrows inward from a held value: moves the tab stop and writes the value it moved to', async () => {
		// The primary radiogroup behaviour the two edge tests above never exercise: an arrow
		// that CAN move must move the stop and commit the value it moved to, through the
		// same click path a pointer pick uses.
		const vault = fixture();
		const { containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Full.md');
		const group = containerEl.querySelector('[data-dim="strategic-alignment"]')!.closest('.pbl-est-points') as HTMLElement;
		key(group, 'ArrowLeft'); // held is 5, the max; this moves inward to 4
		await flush();
		expect(containerEl.querySelector('[data-dim="strategic-alignment"][data-value="4"]')!.getAttribute('tabindex')).toBe('0');
		expect(vault.fm('Full.md')['strategic-alignment']).toBe(4);
	});

	it('an edge arrow on an UNANSWERED row writes nothing and spends no undo slot', async () => {
		// The bug this guards: `stopValue` puts the roving stop on `min` when nothing is
		// held, so an edge ArrowLeft's clamped target is that same min button — not a HELD
		// button — and used to reach `next.click()` anyway, planning a real write where
		// nothing visibly moved.
		const vault = fixture();
		const { view, containerEl } = makeEstimationView(vault, configuredValues());
		selectItem(containerEl, 'Full.md');
		const group = containerEl.querySelector('[data-dim="reach"]')!.closest('.pbl-est-points') as HTMLElement; // unanswered on Full.md
		key(group, 'ArrowLeft');
		await flush();
		expect(containerEl.querySelector('[data-dim="reach"][data-value="1"]')!.getAttribute('tabindex')).toBe('0');
		expect(vault.fm('Full.md').reach).toBeUndefined();
		expect(view.gate.canUndo()).toBe(false);
	});

	it('reaches the panel from a table row with ArrowRight, and still opens the note with Enter', () => {
		// `Enter` is `docs/requirements/Ranking the items by value.md` extension 4a and is
		// unchanged — this adds a key rather than reassigning one. The brief's own test ended
		// on `expect(view.app.workspace).toBeDefined()`, which checks almost nothing; the fake
		// vault records every `openFile` call (`vault.opened`), so this asserts Enter actually
		// reached it rather than merely that the object exists.
		//
		// No `ArrowDown` first: since Task 9 the first row (Full.md) is already selected on a
		// fresh render, so ArrowRight reaches its panel directly rather than stepping onto it.
		const vault = fixture();
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const list = containerEl.querySelector('.pbl-est-rows') as HTMLElement;
		key(list, 'ArrowRight');
		expect(containerEl.querySelector('.pbl-est-panel')!.contains(document.activeElement)).toBe(true);
		key(list, 'Enter');
		expect(vault.opened).toEqual([{ path: 'Full.md', mode: 'split' }]);
	});

	it('lands ArrowRight on the row’s actual tab stop, never the first button in document order', () => {
		// `strategic-alignment` is the first-rendered dimension row, and Full.md holds it at
		// 5 — not `spec.min`. A `querySelector('a, b')` selector LIST (rather than two
		// separate lookups with a real fallback) returns the first match in document order
		// across either branch: since every radio is also a plain `button`, that always
		// resolves to data-value="1" here regardless of tabindex. This pins the real tab
		// stop, data-value="5".
		//
		// No `ArrowDown` first: Full.md is already selected on a fresh render (Task 9).
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const list = containerEl.querySelector('.pbl-est-rows') as HTMLElement;
		key(list, 'ArrowRight');
		expect(document.activeElement).toBe(containerEl.querySelector('[data-dim="strategic-alignment"][data-value="5"]'));
	});

	it('puts the tab stop on the first point when the stored value is out of range or fractional', () => {
		// The guard `stopValue` exists for exactly these two shapes: a value the scale cannot
		// name leaves no button `active`, so without the guard the group would have NO tab
		// stop at all and become unreachable from the keyboard — silently, since nothing here
		// throws.
		const vault = new FakeVault();
		vault.addFile('OutOfRange.md', { frontmatter: { 'strategic-alignment': 7 } }); // range is 1-5
		vault.addFile('Fractional.md', { frontmatter: { 'strategic-alignment': 2.5 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());

		selectItem(containerEl, 'OutOfRange.md');
		const outOfRangeStops = Array.from(containerEl.querySelectorAll('[data-dim="strategic-alignment"]')).filter(
			(b) => b.getAttribute('tabindex') === '0',
		);
		expect(outOfRangeStops, 'reachable even though the stored value is out of range').toHaveLength(1);
		expect(outOfRangeStops[0].getAttribute('data-value')).toBe('1');

		selectItem(containerEl, 'Fractional.md');
		const fractionalStops = Array.from(containerEl.querySelectorAll('[data-dim="strategic-alignment"]')).filter(
			(b) => b.getAttribute('tabindex') === '0',
		);
		expect(fractionalStops, 'reachable even though the stored value is fractional').toHaveLength(1);
		expect(fractionalStops[0].getAttribute('data-value')).toBe('1');
	});

	it('holds at the last point too: ArrowRight must not run past the max', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		// Held is 5, the last point of a 1-5 scale.
		const group = containerEl.querySelector('[data-dim="strategic-alignment"]')!.closest('.pbl-est-points') as HTMLElement;
		key(group, 'ArrowRight');
		expect(containerEl.querySelector('[data-dim="strategic-alignment"][data-value="5"]')!.getAttribute('tabindex')).toBe('0');
	});

	it('does nothing when ArrowRight is pressed with no row selected (no panel to reach)', () => {
		// `view.panelEl` is null with nothing selected, so the optional-chained lookup short-
		// circuits to `undefined` and the `if (first)` guard's false branch is what runs —
		// no throw, no focus change, and the key is not swallowed (not prevented).
		const { containerEl } = makeEstimationView(new FakeVault(), configuredValues());
		const list = containerEl.querySelector('.pbl-est-rows') as HTMLElement;
		expect(containerEl.querySelector('.pbl-est-panel')).toBeNull();
		const before = document.activeElement;
		const evt = key(list, 'ArrowRight');
		expect(document.activeElement).toBe(before);
		expect(evt.defaultPrevented).toBe(false);
	});

	it('a keydown outside any radiogroup does nothing', () => {
		// The panel's own delegated keydown only acts when `evt.target` sits inside a
		// `.pbl-est-points` element; the panel root itself is a real target that is not.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const panel = containerEl.querySelector('.pbl-est-panel') as HTMLElement;
		const evt = key(panel, 'ArrowRight');
		expect(evt.defaultPrevented).toBe(false);
	});

	it('a non-arrow key inside a radiogroup does nothing', () => {
		// Only ArrowLeft/ArrowRight compute a nonzero delta; anything else — Tab, a letter,
		// Space on the button itself — must fall through rather than moving or picking.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const group = containerEl.querySelector('[data-dim="compliance"]')!.closest('.pbl-est-points') as HTMLElement;
		const evt = key(group, 'a');
		expect(evt.defaultPrevented).toBe(false);
		expect(containerEl.querySelector('[data-dim="compliance"][data-value="1"]')!.getAttribute('tabindex')).toBe('0');
	});

	it('keeps focus on a sort header across the rebuild its own click causes', () => {
		// `view.refresh()` destroys the button that was just activated. Without a refocus,
		// focus fell to `<body>` and a SECOND Enter reached nothing — so the direction could
		// be set once by keyboard and never flipped. Every other rebuild-causing control in
		// this plugin refocuses (`refocusPick`, `pickAndRefocus`).
		const { containerEl } = makeEstimationView(fixture(), configuredValues());

		const header = () => containerEl.querySelector('.pbl-est-sort[data-col="total"]') as HTMLButtonElement;
		header().focus();
		click(header());

		// The button is a NEW element after the rebuild, so this asks the document what holds
		// focus rather than trusting the old reference.
		expect(document.activeElement).toBe(header());
		const first = header().getAttribute('aria-sort');

		// The second activation goes to whatever HOLDS focus, not to a re-queried selector — so
		// it reaches a header only if the first click left focus on one. jsdom does not turn
		// Enter on a button into a click (and this view's keydown handler is delegated to the
		// list's own tab stop, so a bubbled Enter from a button is inert), which is why this is
		// the honest spelling of "press it again".
		click(document.activeElement as HTMLElement);
		expect(header().getAttribute('aria-sort')).not.toBe(first);
	});
	/**
	 * Every spelling a browser treats as focusable without a tabindex, plus `[tabindex]`
	 * itself. Enumerated rather than probed, because jsdom computes no focusability at all:
	 * this is a check on the MARKUP the table draws, and the list is what makes it one.
	 */
	const FOCUSABLE = 'a[href], area[href], button, input, select, textarea, iframe, audio[controls], video[controls], summary, [tabindex], [contenteditable]';

	it('draws nothing focusable inside the rows, which is what the keydown guard is defence against', () => {
		// `wireEvents`' guard returns on any keydown whose target is not `.pbl-est-rows`
		// itself, and its comment claims nothing under the rows can be that target today.
		// Asserted AT THE FORBIDDEN THING rather than by driving a path: the first focusable
		// cell somebody adds is precisely the one no existing test drives, and it is also
		// exactly when the guard stops being redundant. Both states, because the empty one
		// draws a different element under the same wrapper.
		for (const vault of [fixture(), new FakeVault()]) {
			const { containerEl } = makeEstimationView(vault, configuredValues());
			const rows = containerEl.querySelector('.pbl-est-rows')!;
			expect(
				Array.from(rows.querySelectorAll(FOCUSABLE)).map((el) => el.outerHTML),
				'a focusable descendant of .pbl-est-rows makes the keydown guard load-bearing — drive it',
			).toEqual([]);
		}
	});
});
