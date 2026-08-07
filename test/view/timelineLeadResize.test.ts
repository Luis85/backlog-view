// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { MAX_TIMELINE_LEAD_PX, MIN_TIMELINE_LEAD_PX } from '../../src/storage/collapseStore';
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

	it('is absent off the dated axis and in tree mode', () => {
		const { containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
		expect(containerEl.querySelector('.pbl-timeline-lead-grip')).toBeNull(); // tree mode
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
});
