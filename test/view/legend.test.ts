// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';

useViewHarness();

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.due' };
const WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Active, Done' };

function datedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Item.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-08-05', status: 'New' } });
	return vault;
}

function legendEl(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector<HTMLElement>('.pbl-legend');
}

function swatchLabels(containerEl: HTMLElement): string[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-item')).map(
		(item) => item.querySelector('.pbl-legend-label')?.textContent ?? '',
	);
}

describe('the roadmap legend', () => {
	it('renders only on the dated axis — the same gate the zoom controls use', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW, horizonProperty: 'note.horizon' }, { collapsed: true });
		expect(legendEl(containerEl)).toBeNull(); // tree
		view.setProjection('roadmap');
		view.setAxisPick('horizons');
		expect(legendEl(containerEl)).toBeNull(); // roadmap, horizon axis
		view.setAxisPick('dates');
		expect(legendEl(containerEl)).not.toBeNull(); // roadmap, dated axis
		view.setProjection('board');
		expect(legendEl(containerEl)).toBeNull(); // board
	});

	it('shows Today and Milestone but no state swatch when no workflow property is configured', () => {
		// `stateMenuValues` still returns a done value even with `stateKey === ''` (it
		// falls back to `observedStates` plus a done default), but `domain/model.ts` sets
		// every `stateValue` to null in that configuration, so no bar can carry a state
		// colour — the legend must not key one nothing on the grid draws.
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS }, { collapsed: true });
		view.setProjection('roadmap');

		expect(legendEl(containerEl)).not.toBeNull();
		expect(swatchLabels(containerEl)).toEqual(['Today', 'Milestone']);
	});

	it('keys one swatch per vocabulary state, in the same slot classes the bars carry, then today, then the milestone', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		expect(swatchLabels(containerEl)).toEqual(['New', 'Active', 'Done', 'Today', 'Milestone']);
		const items = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-item'));
		const swatchClasses = (i: number) => [...(items[i].querySelector('.pbl-legend-swatch')?.classList ?? [])];
		expect(swatchClasses(0)).toContain('pbl-state-0');
		expect(swatchClasses(1)).toContain('pbl-state-1');
		// Slot 2 is where `Done` sits in the vocabulary, and it is NOT what its bar draws:
		// the done override wins over the slot, so the swatch keys the override. The test
		// below states that rule on its own; here it is the exception to "the same slot
		// classes the bars carry", which holds for every state whose bar does carry it.
		expect(swatchClasses(2)).toContain('pbl-legend-done');
	});

	it('is presentational: aria-hidden, and nothing inside it is a tab stop', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		const legend = legendEl(containerEl);
		expect(legend?.getAttribute('aria-hidden')).toBe('true');
		expect(legend?.querySelector('button, [tabindex]')).toBeNull();
	});

	it('keys a done state green, the colour its bars actually draw', () => {
		// The legend exists to be read against the bars, so it may not key a colour the
		// bars do not use. A done state still occupies a slot — it is in the vocabulary —
		// but `.pbl-timeline-row.pbl-done .pbl-bar` overrides that slot with green, so a
		// swatch wearing the slot class would key pink for a bar that draws green.
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-08-05', status: 'Done' } });
		const { view, containerEl } = makeView(vault, { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		const items = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-item'));
		const done = items.find((i) => i.querySelector('.pbl-legend-label')?.textContent === 'Done');
		const swatch = done?.querySelector('.pbl-legend-swatch');
		if (!swatch) throw new Error('no Done swatch in the legend');
		expect(swatch.classList.contains('pbl-legend-done')).toBe(true);
		expect(Array.from(swatch.classList).some((c) => /^pbl-state-\d+$/.test(c))).toBe(false);
		// And the bar it keys really is the done one, so the two are about the same thing.
		expect(containerEl.querySelector('.pbl-timeline-row.pbl-done .pbl-bar')).not.toBeNull();
	});

	it('stays under the toolbar and outside the timeline scroller, so it never scrolls away', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		const legend = legendEl(containerEl);
		const scroller = containerEl.querySelector('.pbl-timeline');
		expect(legend?.contains(scroller)).toBe(false);
		expect(scroller?.contains(legend ?? null)).toBe(false);
	});
});
