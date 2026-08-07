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

	it('keys one swatch per vocabulary state, in the same slot classes the bars carry, then today, then the milestone', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		expect(swatchLabels(containerEl)).toEqual(['New', 'Active', 'Done', 'Today', 'Milestone']);
		const items = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-item'));
		const swatchClasses = (i: number) => [...(items[i].querySelector('.pbl-legend-swatch')?.classList ?? [])];
		expect(swatchClasses(0)).toContain('pbl-state-0');
		expect(swatchClasses(1)).toContain('pbl-state-1');
		expect(swatchClasses(2)).toContain('pbl-state-2');
	});

	it('is presentational: aria-hidden, and nothing inside it is a tab stop', () => {
		const { view, containerEl } = makeView(datedVault(), { ...DATE_AXIS, ...WORKFLOW }, { collapsed: true });
		view.setProjection('roadmap');

		const legend = legendEl(containerEl);
		expect(legend?.getAttribute('aria-hidden')).toBe('true');
		expect(legend?.querySelector('button, [tabindex]')).toBeNull();
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
