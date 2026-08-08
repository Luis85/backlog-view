// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { useViewHarness } from '../helpers/view';
import { Menu } from '../helpers/obsidian-mock';
import { rowFor, roadmapView, timelineTitles } from '../helpers/roadmap';

useViewHarness();

const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };

/**
 * An epic over a feature over a PBI, every one of them dated — so all three draw bars
 * and the grid has two levels of disclosure to answer for.
 */
function nestedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' } });
	vault.addFile('Feature.md', {
		frontmatter: { type: 'Feature', order: 10, start: '2026-08-05', due: '2026-09-01' },
		parentLink: 'Epic',
	});
	vault.addFile('PBI.md', {
		frontmatter: { type: 'PBI', order: 10, start: '2026-08-06', due: '2026-08-20' },
		parentLink: 'Feature',
	});
	return vault;
}

/** The row's own disclosure, or null where it drew the leaf placeholder instead. */
function chevronOf(containerEl: HTMLElement, title: string): HTMLElement | null {
	const chevron = rowFor(containerEl, title)?.querySelector<HTMLElement>('.pbl-chevron');
	return chevron && !chevron.hasClass('pbl-leaf') ? chevron : null;
}

function click(el: HTMLElement): void {
	el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function menuTitles(): string[] {
	return Menu.lastShown?.items.map((i) => i.titleText) ?? [];
}

describe('collapsing a bar’s subtree', () => {
	it('opens shut for a parent nobody has ruled on, the tree’s own rule', () => {
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });

		expect(timelineTitles(containerEl)).toEqual(['Epic']);
		expect(rowFor(containerEl, 'Epic')?.getAttribute('aria-expanded')).toBe('false');
	});

	it('shows one level per click, and takes it back', () => {
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });

		click(chevronOf(containerEl, 'Epic')!);
		// One level: the PBI is behind the feature's own disclosure, not the epic's.
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);
		expect(rowFor(containerEl, 'Epic')?.getAttribute('aria-expanded')).toBe('true');

		click(chevronOf(containerEl, 'Feature')!);
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature', 'PBI']);

		click(chevronOf(containerEl, 'Epic')!);
		// The feature's own state is untouched — it is shut because an ancestor is,
		// which is a different thing from being collapsed itself.
		expect(timelineTitles(containerEl)).toEqual(['Epic']);
	});

	it('draws no disclosure on a row with nothing below it on the grid', () => {
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });
		click(chevronOf(containerEl, 'Epic')!);
		click(chevronOf(containerEl, 'Feature')!);

		expect(chevronOf(containerEl, 'PBI')).toBeNull();
		// The placeholder still renders, so every badge starts at the same x.
		expect(rowFor(containerEl, 'PBI')?.querySelector('.pbl-chevron.pbl-leaf')).not.toBeNull();
		expect(rowFor(containerEl, 'PBI')?.hasAttribute('aria-expanded')).toBe(false);
	});

	it('toggles without opening the note the row would open', () => {
		const vault = nestedVault();
		const { containerEl } = roadmapView(vault, { ...DATES });

		click(chevronOf(containerEl, 'Epic')!);

		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);
		expect(vault.opened).toEqual([]);
	});

	it('opens nothing when it is middle-clicked either', () => {
		// A middle click never fires `click`, so the guard on that one never runs for it
		// and the row's own `auxclick` would open the note in a new tab from a control
		// that means something else entirely.
		const vault = nestedVault();
		const { containerEl } = roadmapView(vault, { ...DATES });

		chevronOf(containerEl, 'Epic')!.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

		expect(vault.opened).toEqual([]);
	});

	it('is inert while the quick filter runs — it overrides collapse state', () => {
		// `isCollapsed` reports false while a filter narrows the tree, so an unguarded
		// click would write "collapsed" against a row that reads as open, look inert,
		// and then shut the row the moment the filter cleared. Opened FIRST, so the
		// state the write would change is not the state it started in — the check is
		// otherwise vacuous, since both answers leave a shut row shut.
		const { containerEl, view } = roadmapView(nestedVault(), { ...DATES });
		click(chevronOf(containerEl, 'Epic')!);
		view.setFilter('Epic');

		click(chevronOf(containerEl, 'Epic')!);

		view.setFilter('');
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);
	});

	it('offers the same disclosure in the row menu, which is its keyboard path', () => {
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });
		rowFor(containerEl, 'Epic')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		expect(menuTitles()).toContain('Show children');
		Menu.lastShown?.item('Show children')?.clickHandler?.();

		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);
		rowFor(containerEl, 'Epic')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(menuTitles()).toContain('Hide children');
	});

	it('offers nothing to toggle on a row that drew no disclosure', () => {
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });
		click(chevronOf(containerEl, 'Epic')!);
		click(chevronOf(containerEl, 'Feature')!);
		rowFor(containerEl, 'PBI')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		expect(menuTitles().some((t) => t === 'Show children' || t === 'Hide children')).toBe(false);
	});

	it('withholds the menu toggle while the quick filter runs, as the chevron is withheld', () => {
		const { containerEl, view } = roadmapView(nestedVault(), { ...DATES });
		view.setFilter('Epic');
		rowFor(containerEl, 'Epic')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

		expect(menuTitles().some((t) => t === 'Show children' || t === 'Hide children')).toBe(false);
	});

	it('takes a hidden row’s marks with it, not only its bar', () => {
		// A milestone under a collapsed row draws no full-height line either: the line
		// belongs to a row, so a row that is not drawn draws nothing. Nothing stands in
		// for it — a marker's date is never evidence, so it cannot roll up into the bar
		// above it the way ordinary work does.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-08-31' } });
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 10, due: '2026-09-30' },
			parentLink: 'Epic',
		});
		const { containerEl } = roadmapView(vault, { ...DATES });
		click(chevronOf(containerEl, 'Epic')!);
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Ship']);
		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(1);

		click(chevronOf(containerEl, 'Epic')!);

		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(0);
	});
});
