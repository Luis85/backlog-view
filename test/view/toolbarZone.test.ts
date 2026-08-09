// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { fixture, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The projection's own slice of the toolbar. Its own file rather than `toolbar.test.ts`'s
 * tail for the reason that file already states about the Deliverables board: one subject,
 * and the shared file is at its line budget.
 */
describe('the projection zone', () => {
	const zone = (containerEl: HTMLElement) => containerEl.querySelector('.pbl-zone-projection');
	const seps = (containerEl: HTMLElement) =>
		containerEl.querySelectorAll('.pbl-toolbar .pbl-toolbar-sep').length;

	const bothAxes = {
		horizonProperty: 'note.horizon',
		startProperty: 'note.start',
		targetProperty: 'note.due',
	};

	it('holds the roadmap axis and zoom, and nothing at all on the other projections', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, bothAxes);

		view.setProjection('roadmap');
		view.setAxisPick('dates');
		const drawn = zone(containerEl);
		expect(drawn).not.toBeNull();
		expect(drawn?.querySelector('[data-pbl-key="axis"]')).not.toBeNull();
		expect(drawn?.querySelector('[data-pbl-key="zoom"]')).not.toBeNull();
		expect(drawn?.querySelector('.pbl-density-toggle')).not.toBeNull();
		expect(drawn?.querySelector('.pbl-today-btn')).not.toBeNull();

		for (const projection of ['tree', 'board', 'deliverables'] as const) {
			view.setProjection(projection);
			expect(zone(containerEl), `${projection} drew a projection zone`).toBeNull();
		}
	});

	it('takes its separator with it, so an empty zone leaves no gap', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, bothAxes);

		view.setProjection('roadmap');
		view.setAxisPick('dates');
		const withZone = seps(containerEl);
		view.setProjection('tree');
		expect(seps(containerEl)).toBe(withZone - 1);
	});

	it('names the axis and the zoom in words, and each menu checks the current value', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, bothAxes);
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		const axisBtn = containerEl.querySelector<HTMLElement>('[data-pbl-key="axis"]');
		expect(axisBtn?.textContent).toContain('Timeline');
		axisBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const axisItems = Menu.lastShown?.items ?? [];
		expect(axisItems.map((i) => i.titleText)).toEqual(['Horizons', 'Timeline']);
		expect(axisItems.find((i) => i.titleText === 'Timeline')?.checked).toBe(true);

		const zoomBtn = containerEl.querySelector<HTMLElement>('[data-pbl-key="zoom"]');
		expect(zoomBtn?.textContent).toContain('Months');
		zoomBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const zoomItems = Menu.lastShown?.items ?? [];
		expect(zoomItems.map((i) => i.titleText)).toEqual(['Weeks', 'Months', 'Quarters']);
		expect(zoomItems.find((i) => i.titleText === 'Months')?.checked).toBe(true);
	});

	// The defect the harness mock found: `calendar-range` named BOTH the axis's
	// Timeline and the zoom's Quarters, six positions apart in one row. Asked of the
	// icons the two menus actually set, so it holds for whatever the next pick is.
	it('never gives two entries in the zone the same glyph', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, bothAxes);
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		const icons: string[] = [];
		for (const key of ['axis', 'zoom']) {
			containerEl
				.querySelector<HTMLElement>(`[data-pbl-key="${key}"]`)
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			icons.push(...(Menu.lastShown?.items ?? []).map((i) => i.iconName));
		}
		expect(new Set(icons).size, `duplicate glyph among ${icons.join(', ')}`).toBe(icons.length);
	});

	it('offers no axis picker when only one axis is configured', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, { horizonProperty: 'note.horizon' });
		view.setProjection('roadmap');
		expect(containerEl.querySelector('[data-pbl-key="axis"]')).toBeNull();
	});
});
