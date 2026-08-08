// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, treeOf, useViewHarness } from '../helpers/view';
import { MAX_TIMELINE_LEAD_PX, MIN_TIMELINE_LEAD_PX } from '../../src/storage/collapseStore';
import { leadBoundsFor } from '../../src/view/interactions/timelineLeadResize';

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

/**
 * The net the one-per-defect tests in `timelineLeadResize.test.ts` are not. Four of this grip's defects were each
 * a single unsampled point in (pane width x gesture): an ARIA range that inverted below
 * 240px, a column that went to zero below 80px, a drag that reached past what the pane
 * could draw, and a gesture at the ceiling that overwrote a wider stored pick. Every one
 * passed the tests that existed, because those name cases rather than the rule.
 *
 * So these state the rules and sweep the space. They are deliberately about invariants
 * that hold for gestures nobody has written yet — the repo's own "check the category at
 * the forbidden thing, not by listing the places".
 */
describe('what has to hold at every pane width, for every gesture', () => {
	// Around and below the two thresholds that made trouble: MIN_TIMELINE_LEAD_PX +
	// MIN_DAY_TRACK_PX (240), and MIN_DAY_TRACK_PX (80) alone.
	const PANES = [60, 100, 200, 239, 240, 300, 350, 1000];

	function openAt(pane: number, stored: number | null) {
		const { view, containerEl } = makeView(datedVault(), DATE_AXIS, { collapsed: true });
		// Before the render: the grip reads the pane once, when it is built.
		Object.defineProperty(treeOf(containerEl), 'clientWidth', { value: pane, configurable: true });
		view.setProjection('roadmap');
		if (stored !== null) view.setLeadWidth(stored);
		return { view, containerEl };
	}

	const drawn = (containerEl: HTMLElement): number =>
		parseFloat(
			containerEl.querySelector<HTMLElement>('.pbl-timeline-content')?.style.getPropertyValue('--pbl-tl-lead') ?? '',
		);

	it.each(PANES)('announces a range that contains what it draws, at %ipx', (pane) => {
		const { containerEl } = openAt(pane, MAX_TIMELINE_LEAD_PX);
		const el = grip(containerEl);
		const min = Number(el.getAttribute('aria-valuemin'));
		const max = Number(el.getAttribute('aria-valuemax'));
		const now = Number(el.getAttribute('aria-valuenow'));
		expect(min).toBeLessThanOrEqual(max);
		expect(now).toBeGreaterThanOrEqual(min);
		expect(now).toBeLessThanOrEqual(max);
		// And the column is something rather than nothing, whatever the pane.
		expect(drawn(containerEl)).toBe(now);
		expect(now).toBeGreaterThan(0);
	});

	it.each(PANES)('never stores a width the pane cannot draw, at %ipx', (pane) => {
		for (const push of [10_000, -10_000]) {
			const { view, containerEl } = openAt(pane, null);
			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', push));
			el.dispatchEvent(pointer('pointerup', push));
			const stored = view.leadWidth;
			if (stored === null) continue; // back at the default, which stores nothing
			const { min, max } = leadBoundsFor(pane);
			expect(stored, `pane ${pane}, push ${push}`).toBeGreaterThanOrEqual(min);
			expect(stored, `pane ${pane}, push ${push}`).toBeLessThanOrEqual(max);
		}
	});

	it.each(PANES)('never stores a width the STORE would reject on the way back in, at %ipx', (pane) => {
		// Raised by review as a round trip that loses the user's pick: below
		// MIN_TIMELINE_LEAD_PX + MIN_DAY_TRACK_PX the pane's own minimum drops under the
		// storable one, so a gesture there looked able to commit a width `readLeadWidth`
		// rejects on the next load. It cannot, and the reason is a property of
		// `leadBoundsFor` rather than of any gesture: wherever the pane forces `min` below
		// the storable floor it forces `max` to the same number, so the drawn width is
		// already pinned and every clamped gesture lands back on it — which
		// `commitIfChanged` declines to write. Stated as the property, so it holds for
		// gestures nobody has written yet rather than for the two driven below.
		const { min, max } = leadBoundsFor(pane);
		if (min < MIN_TIMELINE_LEAD_PX) expect(min, `pane ${pane}`).toBe(max);

		for (const push of [10_000, -10_000]) {
			const { view, containerEl } = openAt(pane, null);
			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', push));
			el.dispatchEvent(pointer('pointerup', push));
			const stored = view.leadWidth;
			if (stored === null) continue;
			// The same range `readLeadWidth` admits — anything outside it reads back as
			// absent, silently resetting the column the user just sized.
			expect(stored, `pane ${pane}, push ${push}`).toBeGreaterThanOrEqual(MIN_TIMELINE_LEAD_PX);
			expect(stored, `pane ${pane}, push ${push}`).toBeLessThanOrEqual(MAX_TIMELINE_LEAD_PX);
		}
	});

	it.each(PANES)('keeps a pane-clamped pick through any gesture that draws no change, at %ipx', (pane) => {
		// A tap, a drag ending where it began, and a push further into a ceiling already
		// reached: three shapes of "nothing moved", which must all leave the stored pick
		// alone. Losing it means a width chosen in a wider pane never comes back.
		const gestures: Array<(el: HTMLElement) => void> = [
			(el) => {
				el.dispatchEvent(pointer('pointerdown', 120));
				el.dispatchEvent(pointer('pointerup', 120));
			},
			(el) => {
				el.dispatchEvent(pointer('pointerdown', 0));
				el.dispatchEvent(pointer('pointermove', 70));
				el.dispatchEvent(pointer('pointerup', 0));
			},
			(el) => {
				el.dispatchEvent(pointer('pointerdown', 0));
				el.dispatchEvent(pointer('pointermove', 10_000));
				el.dispatchEvent(pointer('pointerup', 10_000));
			},
			(el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
		];
		for (const [i, gesture] of gestures.entries()) {
			const { view, containerEl } = openAt(pane, MAX_TIMELINE_LEAD_PX);
			// Only meaningful where the pane is actually clamping the pick.
			if (drawn(containerEl) === MAX_TIMELINE_LEAD_PX) continue;
			gesture(grip(containerEl));
			expect(view.leadWidth, `pane ${pane}, gesture ${i}`).toBe(MAX_TIMELINE_LEAD_PX);
		}
	});
});
