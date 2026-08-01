// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { key, makeView, projectionButton, refresh, treeOf, useViewHarness } from '../helpers/view';
import { bucketNames, bucketsOf, shelfTitles } from '../helpers/roadmap';

useViewHarness();

/** Both axes configured, the way a roadmap view would be. */
const AXES = {
	horizonProperty: 'note.horizon',
	startProperty: 'note.start',
	targetProperty: 'note.due',
};

/**
 * A view flipped to the roadmap through the host, the way the toolbar does it.
 * The mode is UI state in the collapse store, never a config key.
 */
function roadmapView(vault: FakeVault, cfg: Record<string, unknown> = { ...AXES }, opts: { base?: string } = {}) {
	const harness = makeView(vault, cfg, { collapsed: true, ...opts });
	harness.view.setProjection('roadmap');
	return harness;
}

function roadmapVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
	vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 20 } });
	return vault;
}

describe('the three-position projection toggle', () => {
	function storedEntries(vault: FakeVault): Record<string, { mode?: string; axis?: string }> {
		return (vault.localStorage.get('product-backlog:collapse') ?? {}) as Record<
			string,
			{ mode?: string; axis?: string }
		>;
	}

	it('offers the roadmap beside the tree and the board, persisted per saved view', () => {
		const vault = roadmapVault();
		const first = makeView(vault, { ...AXES }, { base: 'Backlog.base', collapsed: true });

		projectionButton(first.containerEl, 'Show as roadmap').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(bucketsOf(first.containerEl).length).toBeGreaterThan(0);
		expect(projectionButton(first.containerEl, 'Show as roadmap').getAttribute('aria-pressed')).toBe('true');
		// Switching is a render decision: nothing about the mode reaches the .base.
		expect(first.config.setCalls).toEqual([]);
		first.view.onunload();
		expect(storedEntries(vault)['Backlog.base#Backlog']?.mode).toBe('roadmap');

		// A fresh view over the same saved view restores the roadmap from the store.
		document.body.empty();
		const second = makeView(vault, { ...AXES }, { base: 'Backlog.base', collapsed: true });
		expect(bucketsOf(second.containerEl).length).toBeGreaterThan(0);
	});

	it('switches on the model already in hand — same results, no re-query, no writes', () => {
		const vault = roadmapVault();
		const { view, containerEl } = makeView(vault, { ...AXES }, { collapsed: true });
		const before = view.model;

		view.setProjection('roadmap');
		expect(view.model).toBe(before);
		expect(vault.writeLog).toHaveLength(0);
		// Every result renders exactly once: one placed, one on the shelf.
		expect(bucketNames(containerEl)).toEqual(['Now', 'Next', 'Later']);
		expect(shelfTitles(containerEl)).toEqual(['Untriaged']);
	});

	it('carries the quick filter across the switch — session state in all three projections', () => {
		const vault = roadmapVault();
		const { view, containerEl } = makeView(vault, { ...AXES }, { collapsed: true });
		view.setFilter('Untriaged');

		view.setProjection('roadmap');
		expect(view.filterText).toBe('Untriaged');
		expect(shelfTitles(containerEl)).toEqual(['Untriaged']);
		// The placed result does not match, so the axis narrows with the shelf.
		expect(containerEl.querySelectorAll('.pbl-bucket-cards .pbl-card')).toHaveLength(0);
	});

	it('drops the tree-only collapse controls, keeping creation, undo and the filter', () => {
		const { containerEl } = roadmapView(roadmapVault());
		expect(containerEl.querySelector('.pbl-collapse-ctl')).toBeNull();
		expect(containerEl.querySelector('.pbl-new-btn')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-undo-btn')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-filter-input')).not.toBeNull();
	});

	it('marks the pane as a listbox while cards render, a labelled region otherwise', () => {
		const withCards = roadmapView(roadmapVault());
		expect(treeOf(withCards.containerEl).getAttribute('role')).toBe('listbox');
		expect(treeOf(withCards.containerEl).getAttribute('aria-label')).toBe('Product backlog roadmap');

		document.body.empty();
		const empty = roadmapView(new FakeVault());
		expect(treeOf(empty.containerEl).getAttribute('role')).toBe('region');
	});
});

describe('the axis is declared, never guessed', () => {
	it('shows guidance naming both ways to get an axis, never a blank pane', () => {
		const { containerEl } = roadmapView(roadmapVault(), {});

		expect(bucketsOf(containerEl)).toHaveLength(0);
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No axis to show');
		const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(hint).toContain('Horizon property');
		expect(hint).toContain('Start date property');
	});

	it('names the missing half when the horizon values were cleared', () => {
		const { containerEl } = roadmapView(roadmapVault(), { horizonProperty: 'note.horizon', horizonValues: '' });

		const hint = containerEl.querySelector('.pbl-empty-hint')?.textContent ?? '';
		expect(hint).toContain('"Horizons (in order)" is empty');
	});

	it('renders the horizons until the user picks, and honors the pick per saved view', () => {
		const vault = roadmapVault();
		const { view, containerEl } = roadmapView(vault, { ...AXES }, { base: 'Backlog.base' });

		// Both axes configured: the picker appears, horizons render by default.
		expect(bucketsOf(containerEl).length).toBeGreaterThan(0);
		const toTimeline = containerEl.querySelector<HTMLButtonElement>('.pbl-axis-btn[aria-label="Show timeline"]');
		expect(toTimeline).not.toBeNull();

		toTimeline?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(bucketsOf(containerEl)).toHaveLength(0);
		expect(containerEl.querySelector('.pbl-timeline')).not.toBeNull();
		view.onunload();
		const stored = (vault.localStorage.get('product-backlog:collapse') ?? {}) as Record<string, { axis?: string }>;
		expect(stored['Backlog.base#Backlog']?.axis).toBe('dates');
	});

	it('falls back to the axis that remains when the picked one is unconfigured — pick retained', () => {
		const vault = roadmapVault();
		vault.localStorage.set('product-backlog:collapse', {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], mode: 'roadmap', axis: 'dates' },
		});
		// The date properties are gone; the horizon axis remains.
		const harness = makeView(
			vault,
			{ horizonProperty: 'note.horizon' },
			{ base: 'Backlog.base', collapsed: true },
		);

		expect(bucketsOf(harness.containerEl).length).toBeGreaterThan(0);
		// With one axis there is no choice to offer.
		expect(harness.containerEl.querySelector('.pbl-axis-picker')).toBeNull();
		// The stored pick is user data: falling back must not rewrite it.
		harness.view.onunload();
		const stored = (vault.localStorage.get('product-backlog:collapse') ?? {}) as Record<string, { axis?: string }>;
		expect(stored['Backlog.base#Backlog']?.axis).toBe('dates');
	});

	it('offers no axis picker outside roadmap mode', () => {
		const { containerEl } = makeView(roadmapVault(), { ...AXES }, { collapsed: true });
		expect(containerEl.querySelector('.pbl-axis-picker')).toBeNull();
	});
});

describe('roadmap keyboard support', () => {
	it('walks the cards with arrows, opens with Enter, and reaches the edges', () => {
		const vault = roadmapVault();
		const { containerEl } = roadmapView(vault);
		const tree = treeOf(containerEl);

		// Reading order: the placed card, then the shelf.
		key(tree, 'ArrowDown');
		expect(containerEl.querySelector('.pbl-selected .pbl-card-title')?.textContent).toBe('Placed');
		key(tree, 'ArrowDown');
		expect(containerEl.querySelector('.pbl-selected .pbl-card-title')?.textContent).toBe('Untriaged');
		key(tree, 'ArrowUp');
		expect(containerEl.querySelector('.pbl-selected .pbl-card-title')?.textContent).toBe('Placed');
		key(tree, 'End');
		expect(containerEl.querySelector('.pbl-selected .pbl-card-title')?.textContent).toBe('Untriaged');
		key(tree, 'Home');
		key(tree, 'Enter');
		expect(vault.opened.map((o) => o.path)).toEqual(['Placed.md']);
	});

	it('keeps the chords: Escape clears the selection, / reaches the filter', () => {
		const { containerEl } = roadmapView(roadmapVault());
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown');
		expect(containerEl.querySelector('.pbl-selected')).not.toBeNull();
		key(tree, 'Escape');
		expect(containerEl.querySelector('.pbl-selected')).toBeNull();

		key(tree, '/');
		expect(document.activeElement?.classList.contains('pbl-filter-input')).toBe(true);
	});
});

describe('entering the dated timeline', () => {
	const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };

	function datedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Dated.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-08-10' } });
		return vault;
	}

	function scroller(containerEl: HTMLElement): HTMLElement {
		const el = containerEl.querySelector<HTMLElement>('.pbl-tree');
		if (!el) throw new Error('the scroller is missing');
		return el;
	}

	it('centers on today whatever offset the scroller inherited from another projection', () => {
		const vault = datedVault();
		const { view, containerEl } = makeView(vault, { ...DATES }, { collapsed: true });
		// A board or tree scrolled sideways leaves its offset on the shared scroller;
		// position must not stand in for lifecycle.
		scroller(containerEl).scrollLeft = 240;

		view.setProjection('roadmap');
		expect(containerEl.querySelector('.pbl-timeline')).not.toBeNull();
		expect(scroller(containerEl).scrollLeft).toBe(view.roadmap?.todayLeft);
	});

	it('keeps a timeline panned to its far-past edge there across a data update', () => {
		const vault = datedVault();
		const { view, containerEl } = roadmapView(vault, { ...DATES });
		expect(scroller(containerEl).scrollLeft).toBe(view.roadmap?.todayLeft);

		scroller(containerEl).scrollLeft = 0;
		refresh(view, vault);
		expect(scroller(containerEl).scrollLeft).toBe(0);
	});

	it('resets the offset when leaving the timeline, so the horizons open at their lead', () => {
		const vault = datedVault();
		const { containerEl } = roadmapView(vault, { ...AXES });
		const pick = (label: string) =>
			containerEl
				.querySelector<HTMLButtonElement>(`.pbl-axis-btn[aria-label="${label}"]`)
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		pick('Show timeline');
		expect(scroller(containerEl).scrollLeft).toBeGreaterThan(0);

		pick('Show horizons');
		// A months-wide pan means nothing to the buckets: the leading horizon shows.
		expect(bucketsOf(containerEl).length).toBeGreaterThan(0);
		expect(scroller(containerEl).scrollLeft).toBe(0);
	});
});
