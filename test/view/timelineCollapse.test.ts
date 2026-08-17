// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { useViewHarness } from '../helpers/view';
import { Menu } from '../helpers/obsidian-mock';
import { markFor, rowFor, roadmapView, timelineTitles } from '../helpers/roadmap';
import { rowByTitle, titlesOf } from '../helpers/view';

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
		expect(chevronOf(containerEl, 'Epic')?.getAttribute('aria-expanded')).toBe('false');
	});

	it('says expanded on the CONTROL, never on a row whose role cannot carry it', () => {
		// `createCard` gives every card row `role="option"`, and `aria-expanded` is not a
		// supported state of that role — put there it may be announced by nobody. So the
		// chevron is a real button carrying the state and a name, `tabindex="-1"` like
		// every other per-row control, which is the same answer the card's own disclosure
		// gives on the same role.
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });
		const row = rowFor(containerEl, 'Epic')!;
		const chevron = chevronOf(containerEl, 'Epic')!;

		expect(row.getAttribute('role')).toBe('option');
		expect(row.hasAttribute('aria-expanded')).toBe(false);
		expect(chevron.tagName).toBe('BUTTON');
		expect(chevron.getAttribute('tabindex')).toBe('-1');
		expect(chevron.getAttribute('aria-label')).toBe('Show children');

		click(chevron);

		expect(chevronOf(containerEl, 'Epic')?.getAttribute('aria-label')).toBe('Hide children');
	});

	it('shows one level per click, and takes it back', () => {
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });

		click(chevronOf(containerEl, 'Epic')!);
		// One level: the PBI is behind the feature's own disclosure, not the epic's.
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);
		expect(chevronOf(containerEl, 'Epic')?.getAttribute('aria-expanded')).toBe('true');

		click(chevronOf(containerEl, 'Feature')!);
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature', 'PBI']);

		click(chevronOf(containerEl, 'Epic')!);
		// The feature's own state is untouched — it is shut because an ancestor is,
		// which is a different thing from being collapsed itself.
		expect(timelineTitles(containerEl)).toEqual(['Epic']);
	});

	it('folds the grid without folding the tree, in both directions', () => {
		// Two questions about one item — what the plan shows and where the reader is in
		// the backlog — so two bits. Driven both ways round, because one scope writing
		// into the other's key is a bug that only shows from the side that was written.
		const { containerEl, view } = roadmapView(nestedVault(), { ...DATES });
		click(chevronOf(containerEl, 'Epic')!);
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);

		view.setProjection('tree');
		// Untouched by the fold above: still shut, as a parent nobody has ruled on.
		expect(titlesOf(containerEl)).toEqual(['Epic']);
		click(rowByTitle(containerEl, 'Epic').querySelector<HTMLElement>('.pbl-chevron')!);
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature']);

		view.setProjection('roadmap');
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);
		click(chevronOf(containerEl, 'Epic')!);
		expect(timelineTitles(containerEl)).toEqual(['Epic']);

		view.setProjection('tree');
		expect(titlesOf(containerEl)).toEqual(['Epic', 'Feature']);
	});

	it('carries a pre-split entry into the new scope rather than shutting the plan', () => {
		// What an installed version stored: one bit per note, which is the bit BOTH
		// projections were reading. Splitting them must copy it across — otherwise the
		// first open after the upgrade finds the axis's scope unsettled and applies the
		// default to all of it, shutting every row the reader had left open.
		const vault = nestedVault();
		vault.localStorage.set('product-backlog:view-state', {
			'Backlog.base#Backlog': {
				base: 'Backlog.base',
				folds: { collapsed: [], expanded: ['Epic.md'], lanes: [] },
				prefs: {},
			},
		});

		const { containerEl } = roadmapView(vault, { ...DATES }, { base: 'Backlog.base' });

		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);
	});

	it('draws no disclosure on a row with nothing below it on the grid', () => {
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });
		click(chevronOf(containerEl, 'Epic')!);
		click(chevronOf(containerEl, 'Feature')!);

		expect(chevronOf(containerEl, 'PBI')).toBeNull();
		// The placeholder still renders, so every badge starts at the same x — and it is a
		// spacer rather than a control: a button opening onto nothing is a lie a screen
		// reader would read out.
		const leaf = rowFor(containerEl, 'PBI')?.querySelector('.pbl-chevron.pbl-leaf');
		expect(leaf).not.toBeNull();
		expect(leaf?.tagName).toBe('DIV');
	});

	it('toggles without opening the note the row would open', () => {
		const vault = nestedVault();
		const { containerEl } = roadmapView(vault, { ...DATES });

		click(chevronOf(containerEl, 'Epic')!);

		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Feature']);
		expect(vault.opened).toEqual([]);
	});

	it('hands focus to the PANE when the fold destroys the button that held it', () => {
		// The rebuild throws away the pressed control, and a browser drops focus to the
		// body — where the pane's arrows and menu keys do nothing. The pane and never the
		// replacement chevron: `handleRoadmapKeydown` returns on any event whose target is
		// not the pane itself, so focusing a control inside the composite would look right
		// and kill the arrows.
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });
		const chevron = chevronOf(containerEl, 'Epic')!;
		chevron.focus();

		click(chevron);

		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-tree'));
	});

	it('leaves focus alone when the disclosure did not hold it', () => {
		// A mouse click does not focus a button in every browser, and focus already
		// somewhere else — a toolbar control, say — must not be dragged into the pane by a
		// click that never took it.
		const { containerEl } = roadmapView(nestedVault(), { ...DATES });
		containerEl.querySelector<HTMLElement>('.pbl-new-btn')!.focus();

		click(chevronOf(containerEl, 'Epic')!);

		// By WHAT holds focus, not by node identity: the toolbar is rebuilt too and
		// restores focus to the pressed control's replacement (`refocusByKey`), so the
		// button in hand is detached by now. What this refuses is focus being dragged into
		// the pane by a click that never took it.
		expect(document.activeElement?.classList.contains('pbl-new-btn')).toBe(true);
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

	it('leaves a MARKER under a collapsed row on screen, line and all', () => {
		// A deliberate REVERSAL, 2026-08-16. This asserted the opposite while a marker had a
		// row of its own under its parent — folding the parent took the diamond and its
		// full-height line with it. A marker now draws in the milestones' shared row at the
		// head of the grid, which is not under anybody: no fold anywhere can take a date the
		// whole plan is measured against off screen, which is the row's whole purpose.
		//
		// What the fold still takes is ordinary WORK below the same parent, asserted beside
		// it so this is not "the chevron stopped working".
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-08-31' } });
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 10, due: '2026-09-30' },
			parentLink: 'Epic',
		});
		vault.addFile('Work.md', {
			frontmatter: { type: 'PBI', order: 20, start: '2026-08-02', due: '2026-08-10' },
			parentLink: 'Epic',
		});
		const { containerEl } = roadmapView(vault, { ...DATES });
		click(chevronOf(containerEl, 'Epic')!);
		expect(timelineTitles(containerEl)).toEqual(['Epic', 'Work']);
		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(1);

		click(chevronOf(containerEl, 'Epic')!);

		expect(timelineTitles(containerEl)).toEqual(['Epic']);
		expect(markFor(containerEl, 'Ship')).not.toBeNull();
		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(1);
	});
});
