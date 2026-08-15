// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireResize } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';
import { makeView, noOptionalProperties, treeOf, useViewHarness } from '../helpers/view';
import { MAX_TIMELINE_LEAD_PX, MIN_TIMELINE_LEAD_PX } from '../../src/storage/collapseStore';
import { effectiveLeadWidth, leadBoundsFor, MIN_DAY_TRACK_PX } from '../../src/view/interactions/timelineLeadResize';
import { TIMELINE_LEAD_PX } from '../../src/view/render/timeline';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };

function datedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-20' } });
	return vault;
}

function grip(containerEl: HTMLElement): HTMLElement {
	const el = containerEl.querySelector<HTMLElement>('.pbl-timeline-lead-grip');
	if (!el) throw new Error('lead-column resize grip not rendered');
	return el;
}

function pointer(type: string, clientX: number): PointerEvent {
	return new PointerEvent(type, { bubbles: true, clientX, pointerId: 1, button: 0 });
}

function timeline(containerEl: HTMLElement): HTMLElement {
	const el = containerEl.querySelector<HTMLElement>('.pbl-timeline');
	if (!el) throw new Error('no timeline scroller');
	return el;
}

describe('the lead-column resize grip', () => {
	it('carries a real separator role and states its bounds', () => {
		const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
		view.setProjection('roadmap');

		const el = grip(containerEl);
		expect(el.getAttribute('role')).toBe('separator');
		expect(el.getAttribute('aria-orientation')).toBe('vertical');
		expect(el.getAttribute('tabindex')).toBe('0');
		expect(el.getAttribute('aria-valuemin')).toBe(String(MIN_TIMELINE_LEAD_PX));
		expect(el.getAttribute('aria-valuemax')).toBe(String(MAX_TIMELINE_LEAD_PX));
		expect(el.getAttribute('aria-valuenow')).toBe(String(TIMELINE_LEAD_PX));
	});

	it('is absent in tree mode, on the board and on the horizon axis, and drawn on the dated one', () => {
		// All four positions, because the grip belongs to ONE of them: the fixture
		// configures both axes so 'horizons' is a real pick rather than one `activeAxis`
		// resolves straight back to 'dates'.
		const { view, containerEl } = makeView(
			datedVault(),
			{ ...DATE_AXIS, horizonProperty: 'note.horizon', horizonValues: 'Now, Later' },
			{ collapsed: true },
		);
		const gripRendered = () => containerEl.querySelector('.pbl-timeline-lead-grip') !== null;

		expect(gripRendered()).toBe(false); // tree mode
		view.setProjection('board');
		expect(gripRendered()).toBe(false);
		view.setProjection('roadmap');
		view.setAxisPick('horizons');
		expect(gripRendered()).toBe(false); // a roadmap, but no grid to lead
		view.setAxisPick('dates');
		expect(gripRendered()).toBe(true);
	});

	describe('dragging', () => {
		it('resizes live without writing anything, and persists once on release', () => {
			const vault = datedVault();
			const { view, containerEl, config } = makeView(vault, DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			const el = grip(containerEl);
			const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
			if (!content) throw new Error('no timeline content');

			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 40));
			// Live feedback only — the pick is not persisted mid-gesture.
			expect(content.style.getPropertyValue('--pbl-tl-lead')).toBe(`${TIMELINE_LEAD_PX + 40}px`);
			expect(view.leadWidth).toBeNull();
			expect(config.setCalls).toEqual([]);
			expect(vault.writeLog).toHaveLength(0);

			el.dispatchEvent(pointer('pointerup', 40));
			expect(view.leadWidth).toBe(TIMELINE_LEAD_PX + 40);
			expect(config.setCalls).toEqual([]);
			expect(vault.writeLog).toHaveLength(0);
		});

		it('takes back a cancelled gesture rather than saving where it was interrupted', () => {
			// `pointercancel` is the browser saying the gesture is not the user's any more —
			// palm rejection, an orientation change, another gesture taking over. None of
			// those is a width anybody chose, and `touch-action: none` prevents none of
			// them: it stops the scroller stealing the pan, not the platform interrupting.
			const vault = datedVault();
			const { view, containerEl, config } = makeView(vault, DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			const el = grip(containerEl);
			const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
			if (!content) throw new Error('no timeline content');

			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 60));
			el.dispatchEvent(pointer('pointercancel', 60));

			// Nothing stored, and the live column put back where the gesture found it.
			expect(view.leadWidth).toBeNull();
			expect(content.style.getPropertyValue('--pbl-tl-lead')).toBe(`${TIMELINE_LEAD_PX}px`);
			expect(config.setCalls).toEqual([]);
			expect(vault.writeLog).toHaveLength(0);

			// And the gesture is over: a later move is not still resizing.
			el.dispatchEvent(pointer('pointermove', 200));
			expect(content.style.getPropertyValue('--pbl-tl-lead')).toBe(`${TIMELINE_LEAD_PX}px`);
		});

		it('leaves the keyboard where it was: a pointer resize takes no focus', () => {
			// `pointerdown` calls `preventDefault()`, so a mouse or a finger never focuses
			// the strip — and the commit used to refocus its replacement regardless. That
			// handed the separator a focus nobody gave it, after which the pane's own
			// `evt.target !== evt.currentTarget` guard swallowed every key: the next arrow
			// resized the column instead of moving the card selection.
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');
			const pane = treeOf(containerEl);
			pane.focus();

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 40));
			el.dispatchEvent(pointer('pointerup', 40));

			// The resize itself still lands — this withholds the focus, not the write.
			expect(view.leadWidth).toBe(TIMELINE_LEAD_PX + 40);
			expect(document.activeElement).not.toBe(grip(containerEl));
			expect(document.activeElement).toBe(pane);
		});

		it('answers to one contact: a second finger neither starts nor ends the gesture', () => {
			// A column boundary is dragged by ONE pointer. A second pointerdown used to
			// install its own handlers with its own startX, after which every move fed both
			// and either finger lifting committed — so the width saved could be the one the
			// other contact was aiming at.
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			const el = grip(containerEl);
			const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
			if (!content) throw new Error('no timeline content');

			const second = (type: string, clientX: number): PointerEvent =>
				new PointerEvent(type, { bubbles: true, clientX, pointerId: 2, button: 0 });

			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 40));
			// A second contact lands and moves: it must change nothing.
			el.dispatchEvent(second('pointerdown', 500));
			el.dispatchEvent(second('pointermove', 900));
			expect(content.style.getPropertyValue('--pbl-tl-lead')).toBe(`${TIMELINE_LEAD_PX + 40}px`);

			// And its release must not end the first finger's gesture or commit its width.
			el.dispatchEvent(second('pointerup', 900));
			expect(view.leadWidth).toBeNull();

			// The original contact is still the one driving, and still commits its own width.
			el.dispatchEvent(pointer('pointermove', 60));
			el.dispatchEvent(pointer('pointerup', 60));
			expect(view.leadWidth).toBe(TIMELINE_LEAD_PX + 60);
		});

		it('does not replace a pane-clamped pick with the clamp on a tap that resized nothing', () => {
			// The gesture's baseline is the width DRAWN, so a zero-delta release committed
			// that — and where a wide stored pick is only being clamped for display, a stray
			// tap silently replaced 480 with the clamp and the pick never came back when the
			// pane widened. This needs a MEASURED, narrow pane: unclamped the two agree and
			// the bug cannot show.
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');
			Object.defineProperty(treeOf(containerEl), 'clientWidth', { value: 350, configurable: true });
			view.setLeadWidth(MAX_TIMELINE_LEAD_PX);
			expect(grip(containerEl).getAttribute('aria-valuenow')).toBe(String(350 - MIN_DAY_TRACK_PX));

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 200));
			el.dispatchEvent(pointer('pointerup', 200));

			expect(view.leadWidth).toBe(MAX_TIMELINE_LEAD_PX);
		});

		it('keeps the pick when a real gesture at the pane ceiling changes nothing', () => {
			// The narrower version of the same rule, and the one a zero-delta guard misses:
			// the column is already at what the pane can draw, so dragging further right
			// produces a real delta whose CLAMPED target is the width already on screen.
			// Committing it writes the clamp back over the wider stored pick.
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			Object.defineProperty(treeOf(containerEl), 'clientWidth', { value: 350, configurable: true });
			view.setProjection('roadmap');
			view.setLeadWidth(MAX_TIMELINE_LEAD_PX);
			expect(grip(containerEl).getAttribute('aria-valuenow')).toBe(String(leadBoundsFor(350).max));

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 500));
			el.dispatchEvent(pointer('pointerup', 500));
			expect(view.leadWidth).toBe(MAX_TIMELINE_LEAD_PX);

			// ArrowRight at the same ceiling asks the same question and must answer it alike.
			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			expect(view.leadWidth).toBe(MAX_TIMELINE_LEAD_PX);
		});

		it('cannot drag past what the pane can draw — no width is stored that the render throws away', () => {
			// A 350px pane announces and draws a 270px ceiling. Clamping the gesture to the
			// STORABLE 480 put 400 on screen and into aria-valuenow, persisted it, and let
			// the rebuild snap back to 270 — a stored number nobody could ever see.
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			// Stubbed BEFORE the roadmap renders: the grip captures the pane's width at
			// render time, so a stub applied afterwards would leave it holding 0 — measuring
			// the test's own ordering rather than the clamp.
			Object.defineProperty(treeOf(containerEl), 'clientWidth', { value: 350, configurable: true });
			view.setProjection('roadmap');
			const paneMax = leadBoundsFor(350).max;

			const el = grip(containerEl);
			const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
			if (!content) throw new Error('no timeline content');
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 10_000));
			expect(content.style.getPropertyValue('--pbl-tl-lead')).toBe(`${paneMax}px`);
			el.dispatchEvent(pointer('pointerup', 10_000));

			expect(view.leadWidth).toBe(paneMax);
			expect(Number(grip(containerEl).getAttribute('aria-valuenow'))).toBeLessThanOrEqual(
				Number(grip(containerEl).getAttribute('aria-valuemax')),
			);
		});

		it('clamps at both ends rather than accepting whatever the pointer names', () => {
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			let el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', -10_000));
			el.dispatchEvent(pointer('pointerup', -10_000));
			expect(view.leadWidth).toBe(MIN_TIMELINE_LEAD_PX);

			el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 10_000));
			el.dispatchEvent(pointer('pointerup', 10_000));
			expect(view.leadWidth).toBe(MAX_TIMELINE_LEAD_PX);
		});

		it('stores null, not the default number, when dragged back to the default width', () => {
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 0));
			el.dispatchEvent(pointer('pointerup', 0));
			expect(view.leadWidth).toBeNull();
		});

		it('leaves the timeline scrolled exactly where it was — the lead is sticky and covers no track', () => {
			// Geometry, not measurement: the day track starts at `leadWidth` in content
			// coordinates and the sticky lead covers exactly that much of the viewport, so
			// the date at the visible leading edge is a function of `scrollLeft` alone,
			// independent of the lead's own width. A resize must therefore leave
			// `scrollLeft` untouched — panning it is the bug this test watches for.
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');
			const scroller = timeline(containerEl);
			scroller.scrollLeft = 300;

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 140));
			el.dispatchEvent(pointer('pointerup', 140));

			expect(view.leadWidth).toBe(TIMELINE_LEAD_PX + 140);
			expect(timeline(containerEl).scrollLeft).toBe(300);
		});
	});

	describe('the keyboard path', () => {
		it('steps with the arrow keys and persists each step immediately', () => {
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			const widened = view.leadWidth;
			expect(widened).not.toBeNull();
			expect(widened as number).toBeGreaterThan(TIMELINE_LEAD_PX);

			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
			expect(view.leadWidth).toBeLessThan(widened as number);
		});

		it('returns to the default on Home', () => {
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			expect(view.leadWidth).not.toBeNull();

			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
			expect(view.leadWidth).toBeNull();
		});

		it('resets on a double click, which is the only reset a pointer has', () => {
			// `pointerdown` prevents default, so a mouse never focuses the strip and Home is
			// a key the reader would first have to Tab to it to press. In
			// `interactions/resizeDrag.ts`, so it holds for the tree's column grips too.
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			expect(view.leadWidth).not.toBeNull();

			grip(containerEl).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
			expect(view.leadWidth).toBeNull();
		});

		it('clamps a step past either bound', () => {
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');
			view.setLeadWidth(MAX_TIMELINE_LEAD_PX);

			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			expect(view.leadWidth).toBe(MAX_TIMELINE_LEAD_PX);
		});

		it('never touches a note or the base', () => {
			const vault = datedVault();
			const { view, containerEl, config } = makeView(vault, DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			grip(containerEl).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			expect(config.setCalls).toEqual([]);
			expect(vault.writeLog).toHaveLength(0);
		});

		it('leaves the pane its own keys: a key the grip does not claim never moves the card selection', () => {
			// The whole accepted ARIA deviation rests on this. The grip is a focusable
			// non-`option` inside the pane's `listbox`, and what makes that cost the
			// composite nothing is `handleRoadmapKeydown`'s `evt.target !==
			// evt.currentTarget` guard. ArrowDown is the case that can see it: the grip
			// claims Left, Right and Home and lets every other key bubble to the pane,
			// so without the guard a reader resizing the column moves the selection with
			// each press. Asserted at the forbidden thing rather than at the shelf's
			// promoted controls, which only ever dispatch keys AT the pane.
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');
			expect(view.selectedPath).toBeNull();

			const el = grip(containerEl);
			el.focus();
			el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

			expect(view.selectedPath).toBeNull();
			// And the grip did not quietly resize on a key it does not own either.
			expect(view.leadWidth).toBeNull();
		});

		it('keeps keyboard focus on its own replacement across the rebuild its own keypress causes', () => {
			// The same wall the shelf header's own controls hit (`shelfControls.ts`'s
			// `refocus`): every keypress here re-renders the whole projection, destroying
			// the very grip that has focus. Losing focus after one press would force a
			// keyboard user back through Tab to press it again.
			const view = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.view.setProjection('roadmap');

			const before = grip(view.containerEl);
			before.focus();
			expect(document.activeElement).toBe(before);
			before.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

			const after = grip(view.containerEl);
			expect(after).not.toBe(before);
			expect(document.activeElement).toBe(after);
			expect(document.activeElement).not.toBe(document.body);
		});
	});

	it('comes back at the width it was left, across a reopen — and a junk stored value reads as the default', () => {
		const vault = datedVault();
		const first = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		first.view.setProjection('roadmap');
		first.view.setLeadWidth(310);
		first.view.onunload();

		const second = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		expect(second.view.leadWidth).toBe(310);
		second.view.onunload();

		const map = vault.localStorage.get('product-backlog:collapse') as Record<string, { leadWidth?: unknown }>;
		map['Plan.base#Roadmap'].leadWidth = 'wide';
		const third = makeView(vault, DATE_AXIS, { collapsed: true, base: 'Plan.base', viewName: 'Roadmap' });
		expect(third.view.leadWidth).toBeNull();
	});

	describe('the pane clamp, so a stored width cannot cover the whole pane', () => {
		it('renders the pane clamped while the stored pick keeps the number the user chose', () => {
			// Regression for the defect: a stored 480px pick in a 350px pane used to be
			// drawn at the full 480px, covering the whole grid — nothing on the pointer or
			// keyboard could reach the grip pinned off the right edge.
			const vault = datedVault();
			const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');
			Object.defineProperty(treeOf(containerEl), 'clientWidth', { value: 350, configurable: true });

			view.setLeadWidth(MAX_TIMELINE_LEAD_PX);

			const expected = 350 - MIN_DAY_TRACK_PX;
			const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
			if (!content) throw new Error('no timeline content');
			expect(content.style.getPropertyValue('--pbl-tl-lead')).toBe(`${expected}px`);
			expect(grip(containerEl).getAttribute('aria-valuenow')).toBe(String(expected));
			// The stored pick itself is untouched — it comes back in full the moment the
			// pane widens again, the same rule `density` and the axis pick already keep.
			expect(view.leadWidth).toBe(MAX_TIMELINE_LEAD_PX);
		});

		it('does not clamp an unmeasured (zero-width) pane — falls through to the stored pick', () => {
			// jsdom never lays anything out, so `clientWidth` is 0 unless a test stubs it —
			// exactly the "not measured" case a clamp must not treat as "clamp to nothing".
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');

			view.setLeadWidth(MAX_TIMELINE_LEAD_PX);

			const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
			if (!content) throw new Error('no timeline content');
			expect(content.style.getPropertyValue('--pbl-tl-lead')).toBe(`${MAX_TIMELINE_LEAD_PX}px`);
		});
	});

	describe('the pane resizing on its own, on the dated axis', () => {
		it('re-renders when a resize narrows the pane enough to change the effective width', () => {
			const vault = datedVault();
			const { view, containerEl } = makeView(vault, DATE_AXIS, { collapsed: true });
			const tree = treeOf(containerEl);
			Object.defineProperty(tree, 'clientWidth', { value: 1000, configurable: true });
			view.setProjection('roadmap');
			view.setLeadWidth(MAX_TIMELINE_LEAD_PX);
			const before = grip(containerEl);
			expect(before.getAttribute('aria-valuenow')).toBe(String(MAX_TIMELINE_LEAD_PX));

			Object.defineProperty(tree, 'clientWidth', { value: 350, configurable: true });
			fireResize(tree);

			const after = grip(containerEl);
			expect(after).not.toBe(before); // the projection actually rebuilt
			expect(after.getAttribute('aria-valuenow')).toBe(String(350 - MIN_DAY_TRACK_PX));
			// The resize clamps what is DRAWN — never the stored pick, which comes back in
			// full the moment the pane widens again.
			expect(view.leadWidth).toBe(MAX_TIMELINE_LEAD_PX);
		});

		it('does nothing when a resize leaves the effective width unchanged', () => {
			const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
			view.setProjection('roadmap');
			const tree = treeOf(containerEl);
			const before = grip(containerEl);

			// `clientWidth` is 0 in jsdom before AND after — unmeasured both times, so the
			// effective width the resize recomputes is the same fallback the render already
			// drew, and nothing about it warrants tearing the projection down.
			fireResize(tree);

			expect(grip(containerEl)).toBe(before);
		});

		it('does nothing off the roadmap projection or off the dated axis', () => {
			const vault = datedVault();
			const { view, containerEl } = makeView(
				vault,
				{ ...DATE_AXIS, horizonProperty: 'note.horizon', horizonValues: 'Now, Later' },
				{ collapsed: true },
			);
			const tree = treeOf(containerEl);
			Object.defineProperty(tree, 'clientWidth', { value: 200, configurable: true });

			// Board: `this.projection !== 'roadmap'`.
			view.setProjection('board');
			const board = treeOf(containerEl).firstElementChild;
			fireResize(tree);
			expect(treeOf(containerEl).firstElementChild).toBe(board);

			// Roadmap, horizon axis: `activeAxis(...) !== 'dates'`.
			view.setProjection('roadmap');
			view.setAxisPick('horizons');
			const frame = treeOf(containerEl).firstElementChild;
			fireResize(tree);
			expect(treeOf(containerEl).firstElementChild).toBe(frame);
		});

		it('does nothing while no axis is configured at all', () => {
			// `this.roadmap` is null here (`renderRoadmapNoAxisState`), the one other way
			// `projection === 'roadmap'` can reach the resize handler with nothing to clamp.
			const { view, containerEl } = makeView(new FakeVault(), noOptionalProperties(), { collapsed: true });
			const tree = treeOf(containerEl);
			view.setProjection('roadmap');
			const guidance = treeOf(containerEl).firstElementChild;

			expect(() => fireResize(tree)).not.toThrow();
			expect(treeOf(containerEl).firstElementChild).toBe(guidance);
		});
	});
});

describe('effectiveLeadWidth', () => {
	it('draws the stored width unclamped when the pane has room for it', () => {
		expect(effectiveLeadWidth(300, 1000)).toBe(300);
	});

	it('clamps down to what the pane can give, reserving room for the day track', () => {
		expect(effectiveLeadWidth(MAX_TIMELINE_LEAD_PX, 300)).toBe(300 - MIN_DAY_TRACK_PX);
	});

	it('falls through to the stored width at an unmeasured pane — 0 or negative never clamps to the minimum', () => {
		expect(effectiveLeadWidth(MAX_TIMELINE_LEAD_PX, 0)).toBe(MAX_TIMELINE_LEAD_PX);
		expect(effectiveLeadWidth(MAX_TIMELINE_LEAD_PX, -50)).toBe(MAX_TIMELINE_LEAD_PX);
	});

	it('leaves the column something to be, in a pane too narrow to subtract a day track from', () => {
		// The plain subtraction went to zero here — no titles at all, which is a worse
		// answer than a cramped column. Half the pane is the floor instead.
		expect(effectiveLeadWidth(MAX_TIMELINE_LEAD_PX, 40)).toBe(20);
		expect(effectiveLeadWidth(MAX_TIMELINE_LEAD_PX, 100)).toBe(50);
	});
});

describe('leadBoundsFor', () => {
	it('states the storable bounds where the pane can honour them, and at an unmeasured pane', () => {
		expect(leadBoundsFor(1400)).toEqual({ min: MIN_TIMELINE_LEAD_PX, max: MAX_TIMELINE_LEAD_PX });
		expect(leadBoundsFor(0)).toEqual({ min: MIN_TIMELINE_LEAD_PX, max: MAX_TIMELINE_LEAD_PX });
	});

	it('never reports a backwards range, however narrow the pane', () => {
		// The separator announces this range. Below MIN_TIMELINE_LEAD_PX + MIN_DAY_TRACK_PX
		// the pane cannot give the storable minimum, so a fixed valuemin would sit ABOVE
		// valuemax — an invalid range handed to assistive tech in exactly the narrow case
		// the clamp exists to support.
		for (const pane of [40, 100, 200, 239, 240, 300, 420, 1400]) {
			const { min, max } = leadBoundsFor(pane);
			expect(min, `pane ${pane}`).toBeLessThanOrEqual(max);
			expect(min, `pane ${pane}`).toBeGreaterThan(0);
			// And what is drawn always sits inside what is announced.
			const drawn = effectiveLeadWidth(MAX_TIMELINE_LEAD_PX, pane);
			expect(drawn, `pane ${pane}`).toBeGreaterThanOrEqual(min);
			expect(drawn, `pane ${pane}`).toBeLessThanOrEqual(max);
		}
	});
});
