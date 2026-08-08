// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { STATE_COLOR_SLOTS } from '../../src/domain/settings';

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

/**
 * The rule behind every state-colour defect this branch has had, checked as a rule.
 * Four so far, each a different point in the same two-dimensional space — vocabulary by
 * configuration — and each one passed the tests that existed, because those name cases:
 * the done swatch keying its slot instead of the green its bars draw, the milestone
 * swatch keying cyan while the diamond drew its state slot, state swatches rendered with
 * no workflow configured at all, and a state outside the configured list drawing the
 * plain accent that nothing keyed.
 *
 * THE RULE, both ways round: every colour a mark on the grid can draw is keyed by
 * exactly one swatch, and no swatch keys a colour nothing can draw. A legend that fails
 * either direction is worse than none — it is a key that lies about the thing it keys.
 */
describe('the legend keys exactly the colours the grid draws', () => {
	/** What a row's classes say its bar draws, in the stylesheet's own order of precedence. */
	function barColourKey(row: HTMLElement): string {
		if (row.classList.contains('pbl-done')) return 'pbl-legend-done';
		if (row.querySelector('.pbl-bar-milestone')) return 'pbl-legend-milestone';
		const slot = Array.from(row.classList).find((c) => /^pbl-state-\d+$/.test(c));
		return slot ?? 'pbl-legend-other';
	}

	function swatchKeys(containerEl: HTMLElement): string[] {
		return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-legend-swatch')).map(
			(el) => Array.from(el.classList).find((c) => c !== 'pbl-legend-swatch') ?? '',
		);
	}

	const CASES: Array<{ name: string; options: Record<string, string>; states: Array<string | null> }> = [
		{ name: 'a declared vocabulary, nothing done', options: { stateValues: 'New, Active' }, states: ['New', 'Active'] },
		{ name: 'a declared vocabulary including a done value', options: { stateValues: 'New, Active, Done' }, states: ['New', 'Done'] },
		{ name: 'no declared list — the vocabulary is what the notes observed', options: { stateValues: '' }, states: ['Alpha', 'Beta'] },
		{
			name: 'a vocabulary longer than the palette, so slots wrap',
			options: { stateValues: 'S1, S2, S3, S4, S5, S6, S7' },
			states: ['S1', 'S6', 'S7'],
		},
		{ name: 'a state the declared vocabulary does not list', options: { stateValues: 'New, Active' }, states: ['New', 'Blocked'] },
		{ name: 'some items carrying no state at all', options: { stateValues: 'New, Active' }, states: ['New', null] },
		// The vocabulary is the CONFIGURED list, but `done` is decided by `doneValues`
		// independently of it — so an item can be done while its value is not in the menu,
		// and its bar goes green with nothing keying green.
		{ name: 'a done value the configured vocabulary omits', options: { stateValues: 'New, Active' }, states: ['New', 'Done'] },
		{ name: 'only done items, none of them listed', options: { stateValues: 'New, Active' }, states: ['Done', 'Done'] },
	];

	it.each(CASES)('$name', ({ options, states }) => {
		const vault = new FakeVault();
		states.forEach((state, i) => {
			const fm: Record<string, unknown> = { type: 'PBI', order: (i + 1) * 10, due: `2026-08-0${i + 1}` };
			if (state !== null) fm.status = state;
			vault.addFile(`Item ${i}.md`, { frontmatter: fm });
		});
		const workflow = 'stateValues' in options ? { stateProperty: 'note.status', ...options } : {};
		const { view, containerEl } = makeView(vault, { ...DATE_AXIS, ...workflow }, { collapsed: true });
		view.setProjection('roadmap');

		const keyed = new Set(swatchKeys(containerEl));
		const rows = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-timeline-row'));
		expect(rows.length).toBeGreaterThan(0);

		// Every colour drawn is keyed.
		for (const row of rows) {
			const title = row.querySelector('.pbl-card-title')?.textContent;
			expect(keyed, `${title} draws ${barColourKey(row)}, which the legend does not key`).toContain(barColourKey(row));
		}
		// Two swatches may share a colour ONLY where the vocabulary outruns the palette,
		// which `STATE_COLOR_SLOTS` documents as its accepted limit. Anywhere else a colour
		// with two names is a key that cannot be read.
		const stateSwatches = swatchKeys(containerEl).filter((k) => /^pbl-state-\d+$/.test(k));
		if (stateSwatches.length <= STATE_COLOR_SLOTS) {
			expect(swatchKeys(containerEl)).toHaveLength(keyed.size);
		}
		// The two lines are always drawn, so they are always keyed.
		expect(keyed).toContain('pbl-legend-today');
		expect(keyed).toContain('pbl-legend-milestone');
	});
});
