// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap } from '../helpers/roadmap';
import { useViewHarness } from '../helpers/view';
import { syncShelfControls } from '../../src/view/render/shelfControls';

useViewHarness();

function shelfControlsOf(containerEl: HTMLElement): HTMLElement | null {
	return containerEl.querySelector<HTMLElement>('.pbl-shelf-controls');
}

function toolbarOf(containerEl: HTMLElement): HTMLElement {
	const bar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
	if (!bar) throw new Error('toolbar not rendered');
	return bar;
}

describe('the shelf toolbar controls', () => {
	it('exist in the toolbar, not inside the roadmap listbox, on the very first render', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		const controls = shelfControlsOf(containerEl);
		expect(controls).not.toBeNull();
		expect(containerEl.querySelector('.pbl-toolbar')?.contains(controls)).toBe(true);
		expect(containerEl.querySelector('[role="listbox"]')?.contains(controls)).toBe(false);
	});

	it('renders nothing in the toolbar outside roadmap mode', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		view.setProjection('tree');
		expect(shelfControlsOf(containerEl)).toBeNull();
	});
});

/**
 * `syncShelfControls`'s call site (a render-loop hook, alongside `syncCountLabel`) is
 * Task 5's job, not this one — see `shelfControls.ts`'s own doc comment. These tests
 * drive the function directly against the toolbar `renderShelfControls` already built,
 * the same way a domain function is unit-tested ahead of the caller that will invoke it
 * in production: the point is coverage of the function's own branches, not the
 * render-lifecycle wiring, which is out of scope here.
 */
describe('syncing the shelf controls directly (call site arrives in a later task)', () => {
	it('fills the real shelf count and the accessible collapse-toggle name', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);

		const collapseBtn = bar.querySelector<HTMLButtonElement>('.pbl-shelf-collapse-btn');
		expect(collapseBtn?.querySelector('.pbl-shelf-count')?.textContent).toBe('1');
		expect(collapseBtn?.getAttribute('aria-expanded')).toBe('false');
		expect(collapseBtn?.getAttribute('aria-label')).toContain('Expand');

		view.setShelfCollapsed(false);
		syncShelfControls(view, bar);
		expect(collapseBtn?.getAttribute('aria-expanded')).toBe('true');
		expect(collapseBtn?.getAttribute('aria-label')).toContain('Collapse');
	});

	it('marks the cluster empty once nothing is left to show, and clears the mark once something is', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(false);

		view.setFilter('nonexistent-search-term');
		syncShelfControls(view, bar);
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(true);

		view.setFilter('');
		syncShelfControls(view, bar);
		expect(shelfControlsOf(containerEl)?.hasClass('pbl-shelf-controls-empty')).toBe(false);
	});

	it("reflects the host's current sort pick onto the select", () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		const bar = toolbarOf(containerEl);
		const sortSelect = bar.querySelector<HTMLSelectElement>('.pbl-shelf-sort');

		syncShelfControls(view, bar);
		expect(sortSelect?.value).toBe('tree');

		view.setShelfSort('modified');
		syncShelfControls(view, bar);
		expect(sortSelect?.value).toBe('modified');
	});

	it('builds one type-filter chip per group present on the shelf, checked unless the host hides that type', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);

		const chips = Array.from(bar.querySelectorAll<HTMLElement>('.pbl-shelf-type-chip'));
		expect(chips.map((c) => c.dataset.shelfType)).toEqual(['Epic', 'Task']);
		const taskCheckbox = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		expect(taskCheckbox?.checked).toBe(true);

		// Hiding a type unchecks its own chip; the chip itself must stay put, or a
		// hidden type could never be turned back on through this control.
		view.setShelfHiddenTypes(new Set(['Task']));
		syncShelfControls(view, bar);
		const stillThere = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		expect(stillThere).not.toBeNull();
		expect(stillThere?.checked).toBe(false);
	});

	it("toggling a chip's checkbox hides that type through the host setter", () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);

		const taskCheckbox = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		expect(taskCheckbox).not.toBeNull();
		taskCheckbox!.checked = false;
		taskCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));
		expect(view.shelfHiddenTypes.has('Task')).toBe(true);

		taskCheckbox!.checked = true;
		taskCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));
		expect(view.shelfHiddenTypes.has('Task')).toBe(false);
	});

	it('hands focus to whichever chip now represents the type that held it before the rebuild', () => {
		const vault = horizonVault();
		vault.addFile('A Task.md', { frontmatter: { type: 'Task', order: 40 } });
		const { containerEl, view } = makeRoadmap(vault);
		const bar = toolbarOf(containerEl);
		syncShelfControls(view, bar);

		const taskCheckbox = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		taskCheckbox?.focus();
		expect(document.activeElement).toBe(taskCheckbox);

		// A second sync rebuilds every chip from scratch; the one for "Task" is a new
		// node, and focus has to land on it rather than nowhere.
		syncShelfControls(view, bar);
		const rebuilt = bar.querySelector<HTMLInputElement>('.pbl-shelf-type-chip[data-shelf-type="Task"] input');
		expect(rebuilt).not.toBeNull();
		expect(rebuilt).not.toBe(taskCheckbox);
		expect(document.activeElement).toBe(rebuilt);
	});

	it('does nothing when the toolbar carries no shelf-controls cluster at all', () => {
		const { containerEl, view } = makeRoadmap(horizonVault());
		view.setProjection('tree');
		// Off the roadmap `renderShelfControls` built nothing; syncing must be a no-op
		// rather than throwing on a missing `.pbl-shelf-controls`.
		expect(() => syncShelfControls(view, toolbarOf(containerEl))).not.toThrow();
	});
});
