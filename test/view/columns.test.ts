// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { fixture, makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

describe('property columns', () => {
	it('renders visible properties as fixed cells with the toString fallback', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault);
		config.order = ['note.points'];
		view.onDataUpdated();

		const cell = rowByTitle(containerEl, 'Epic A').querySelector('.pbl-prop');
		expect(cell?.querySelector('.pbl-prop-value')?.textContent).toBe('5');
		// The label is not repeated per row — it is in the header and the tooltip
		expect(cell?.querySelector<HTMLElement>('.pbl-prop-value')?.dataset.tooltip).toBe('points: 5');
		// A row without a value keeps the empty cell, or the columns after it would shift
		const empty = rowByTitle(containerEl, 'Epic B').querySelector('.pbl-prop');
		expect(empty).not.toBeNull();
		expect(empty?.querySelector('.pbl-prop-value')).toBeNull();
	});

	it('names the columns once, in a header above the rows', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault, { stateProperty: 'note.status' });
		config.order = ['note.points'];
		view.onDataUpdated();

		const header = treeOf(containerEl).querySelector('.pbl-cols');
		expect(header?.getAttribute('aria-hidden')).toBe('true');
		expect(Array.from(header?.querySelectorAll('.pbl-col-label') ?? []).map((el) => el.textContent)).toEqual([
			'points',
			'status',
			'Progress',
		]);
		// Same column widths as the rows, so the labels sit above their values
		expect(header?.querySelector('.pbl-props')?.childElementCount).toBe(1);
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-count')).toBe('1');
		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-col')).toBe('132px');
	});

	it('drops the columns a pane cannot hold, measuring what they actually need', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, { propertyColumnWidth: 280, stateProperty: 'note.status' });
		config.order = ['note.points', 'note.owner'];
		const tree = treeOf(containerEl);
		const viewEl = containerEl.querySelector('.pbl-view');
		const paneWidth = (px: number) => {
			Object.defineProperty(tree, 'clientWidth', { value: px, configurable: true });
			view.onDataUpdated();
		};

		// Wider than any fixed breakpoint would be, yet two 280px columns do not fit
		paneWidth(700);
		expect(viewEl?.classList.contains('pbl-hide-props')).toBe(true);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(false);

		paneWidth(1400);
		expect(viewEl?.classList.contains('pbl-hide-props')).toBe(false);

		// Narrow enough that the rollup has to go, but the state chip still fits
		paneWidth(500);
		expect(viewEl?.classList.contains('pbl-hide-meta')).toBe(true);
		expect(viewEl?.classList.contains('pbl-hide-state')).toBe(false);

		// Narrower than the row's own lead plus the state column: nothing left to give
		paneWidth(400);
		expect(viewEl?.classList.contains('pbl-hide-state')).toBe(true);
	});

	it('counts the indent of the deepest rendered row', () => {
		// A chain deep enough that its indent alone eats a column's worth of room.
		const vault = new FakeVault();
		vault.addFile('L0.md', { frontmatter: { type: 'Epic', order: 10 } });
		for (let i = 1; i <= 8; i++) {
			vault.addFile(`L${i}.md`, { frontmatter: { type: 'Task', order: 10 }, parentLink: `L${i - 1}` });
		}
		const { containerEl, config, view } = makeView(vault, {}, { collapsed: true });
		config.order = ['note.points'];
		const tree = treeOf(containerEl);
		Object.defineProperty(tree, 'clientWidth', { value: 560, configurable: true });
		view.onDataUpdated();
		const viewEl = containerEl.querySelector('.pbl-view');

		// Collapsed, only the root renders: one 132px column fits beside it
		expect(viewEl?.classList.contains('pbl-hide-props')).toBe(false);

		// Expanding the chain puts a row eight levels in — 192px of indent — on screen
		containerEl
			.querySelector<HTMLElement>('.pbl-collapse-ctl[aria-label="Expand all"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(viewEl?.classList.contains('pbl-hide-props')).toBe(true);
	});

	it('has no header when no properties are shown', () => {
		const { containerEl } = makeView(fixture(), { stateProperty: 'note.status' });
		expect(containerEl.querySelector('.pbl-cols')).toBeNull();
	});

	it('sizes the columns from the view option', () => {
		const vault = fixture();
		const { containerEl, config, view } = makeView(vault, { propertyColumnWidth: 200 });
		config.order = ['note.points'];
		view.onDataUpdated();

		expect(treeOf(containerEl).style.getPropertyValue('--pbl-prop-col')).toBe('200px');
	});

	it('keeps the empty space around the columns part of the row click target', () => {
		const vault = fixture();
		vault.entryValues.set('Epic A.md', { 'note.points': { toString: () => '5' } });
		const { containerEl, config, view } = makeView(vault);
		config.order = ['note.points'];
		view.onDataUpdated();

		// A click on the value itself must not open the note (it may hold links)…
		const value = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-prop-value');
		value?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened).toEqual([]);

		// …but the flexible area before the columns is still the row.
		const spacer = rowByTitle(containerEl, 'Epic A').querySelector<HTMLElement>('.pbl-row-spacer');
		spacer?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened).toEqual([{ path: 'Epic A.md', mode: false }]);
	});
});

describe('badges', () => {
	it('puts the full level name in the tooltip once the cap truncates it', () => {
		const vault = new FakeVault();
		// No type property: the level is implied, and the badge explains that
		vault.addFile('Epic.md', { frontmatter: { order: 10 } });
		vault.addFile('Child.md', { frontmatter: { type: 'Programme Increment', order: 10 }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, { levels: 'Programme Increment, Epic' });

		const badge = rowByTitle(containerEl, 'Epic').querySelector<HTMLElement>('.pbl-badge');
		const text = badge?.querySelector<HTMLElement>('.pbl-badge-text');
		if (!badge || !text) throw new Error('badge not rendered');
		expect(badge.classList.contains('pbl-implied')).toBe(true);
		expect(badge.dataset.tooltip).toContain('Type property not set');

		// jsdom measures nothing, so stand in for a name wider than the 120px cap
		Object.defineProperty(text, 'scrollWidth', { value: 200, configurable: true });
		Object.defineProperty(text, 'clientWidth', { value: 100, configurable: true });
		badge.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

		// Both: the name the cap hid, and why the badge is dashed
		expect(badge.dataset.tooltip).toContain('Programme Increment');
		expect(badge.dataset.tooltip).toContain('Type property not set');
	});
});
