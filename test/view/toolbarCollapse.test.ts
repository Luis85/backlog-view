// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { fixture, makeView, titlesOf, useViewHarness } from '../helpers/view';
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { horizonVault, makeRoadmap, shelfTitles, timelineTitles } from '../helpers/roadmap';
import { expandAll } from '../../src/view/render/toolbarControls';

useViewHarness();

const DATED_AXIS = { startProperty: 'note.start', targetProperty: 'note.due', horizonProperty: '' };

function collapseCtls(containerEl: HTMLElement): HTMLButtonElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl'));
}

/** `iconButton` puts the label in `aria-label`; the button's own text is an icon. */
function collapseCtl(containerEl: HTMLElement, label: string): HTMLButtonElement | undefined {
	return collapseCtls(containerEl).find((b) => b.getAttribute('aria-label') === label);
}

function kidTitlesOf(card: HTMLElement): (string | null)[] {
	return Array.from(card.querySelectorAll('.pbl-card-kid-title')).map((el) => el.textContent);
}

/** The disclosure's own toggle, so a test can press it without going through the toolbar. */
function disclosureOf(card: HTMLElement): HTMLButtonElement | null {
	return card.querySelector<HTMLButtonElement>('.pbl-card-kids-toggle');
}

describe('the bulk collapse controls leave a card’s own disclosure alone', () => {
	// The buttons themselves are disabled on any screen where the only disclosures belong
	// to cards (see the describe block below) — a card is the only thing collapsible on a
	// board or a horizon roadmap, so there is no live click to demonstrate the exclusion
	// through. `expandAll`/`collapseAll` are exported and driven directly for exactly that
	// reason: they are the same call the toolbar button and the `⋯` entry both make once
	// `collapseCtlsDisabled` lets them through, so calling them here proves the population
	// they touch, independent of whether anything on THIS screen happens to enable them.
	it('leaves a board card’s children to its own button', () => {
		const { containerEl, view } = makeBoard(boardVault());

		expandAll(view);

		expect(kidTitlesOf(cardByTitle(containerEl, 'Epic B'))).toEqual([]);
		// Only the card's own button opens it.
		disclosureOf(cardByTitle(containerEl, 'Epic B'))?.click();
		expect(kidTitlesOf(cardByTitle(containerEl, 'Epic B'))).toEqual(['Feature B1', 'Feature B2']);
	});

	it('leaves the roadmap’s cards to their own button too', () => {
		// A horizon roadmap: its bucket cards and shelf cards both come through
		// `renderCardBody`, so they carry disclosures exactly as board cards do.
		const vault = horizonVault();
		vault.addFile('Feature N1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Now item' });
		const { containerEl, view } = makeRoadmap(vault);

		expandAll(view);

		expect(kidTitlesOf(cardByTitle(containerEl, 'Now item'))).toEqual([]);
		disclosureOf(cardByTitle(containerEl, 'Now item'))?.click();
		expect(kidTitlesOf(cardByTitle(containerEl, 'Now item'))).toEqual(['Feature N1']);
	});

	// The exclusion has to be asked of the board's own STRUCTURE, not of
	// `cardChildrenShown`: that register only knows a card drew a disclosure THIS pass, so
	// a card whose one child is hidden by "Hide completed items" draws no disclosure at all
	// and would slip past a filter keyed on it — collapse state written now, then surfacing
	// the moment the hidden child is revealed, from a call that never touched this card.
	it('leaves a card alone even while its only child is hidden and it drew no disclosure at all', () => {
		const vault = new FakeVault();
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 30, status: 'Active' } });
		vault.addFile('Feature C1.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'Done' },
			parentLink: 'Epic C',
		});
		const { containerEl, view } = makeBoard(vault, { showCompleted: false });
		expect(cardByTitle(containerEl, 'Epic C').querySelector('.pbl-card-kids-toggle')).toBeNull();
		expect(view.isCollapsed('Epic C.md')).toBe(true);

		expandAll(view);

		// Still collapsed: a card is excluded by what it IS, not by whether it happened
		// to draw a disclosure this pass — or the bit written here would surface the
		// moment "Show completed items" (or a new child) revealed one.
		expect(view.isCollapsed('Epic C.md')).toBe(true);
	});
});

describe('the bulk collapse controls disable where nothing but a card would answer', () => {
	// Half the original gate's reason survives: on a projection that drew no disclosure
	// these buttons change nothing on screen and still write collapse state, which then
	// surprises the tree. Disabled, not absent, and on the property rather than in CSS.
	it('disables them on a board that drew no cards at all', () => {
		// No configured workflow, so the board draws guidance rather than columns.
		const { containerEl } = makeBoard(boardVault(), { stateProperty: '', stateValues: '' });
		expect(collapseCtls(containerEl).length).toBe(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
	});

	// The same disabled outcome for a different reason: Epic B DOES have a disclosure —
	// its own card's — but a card's disclosure is never the toolbar's to press, so there
	// is nothing left for it to reach. Enabled here would be a live no-op.
	it('disables them on a board whose only disclosures belong to cards', () => {
		const { containerEl } = makeBoard(boardVault());
		expect(collapseCtls(containerEl).length).toBe(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
	});

	it('disables them on a horizon roadmap whose only disclosures belong to cards', () => {
		const vault = horizonVault();
		vault.addFile('Feature N1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Now item' });
		const { containerEl } = makeRoadmap(vault);
		expect(collapseCtls(containerEl).length).toBe(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
	});

	it('disables them on the Deliverables board whose only disclosures belong to cards', () => {
		const vault = new FakeVault();
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10, status: 'New' } });
		vault.addFile('T.md', { frontmatter: { type: 'Task', order: 10, status: 'New' }, parentLink: 'D' });
		const { containerEl, view } = makeView(vault, { stateProperty: 'note.status', stateValues: 'New, Done' });
		view.setProjection('deliverables');
		expect(collapseCtls(containerEl).length).toBe(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
	});

	it('disables them on a dated roadmap where no bar hangs under another', () => {
		const vault = new FakeVault();
		// Two dated ROOTS: both draw bars and neither is unplaceable, so the shelf stays
		// empty, no card body is drawn anywhere in the projection, and no timeline row
		// draws a chevron either — there is genuinely nothing to collapse. This is the
		// case a board-only test cannot reach: cards exist on screen, and none of them
		// discloses anything.
		vault.addFile('Dated epic.md', {
			frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' },
		});
		vault.addFile('Other epic.md', {
			frontmatter: { type: 'Epic', order: 20, start: '2026-09-01', due: '2026-10-01' },
		});
		const { containerEl } = makeRoadmap(vault, DATED_AXIS);

		// Confirm the fixture really is timeline-only before trusting the verdict.
		expect(shelfTitles(containerEl)).toEqual([]);
		// Presence FIRST, and not as ceremony: `[].every(...)` is true, so a bare
		// `every` check would pass against an implementation that omitted the controls
		// altogether — the one outcome the spec rules out, since disabled-and-present is
		// what keeps them from vanishing as the projection changes.
		expect(collapseCtls(containerEl).length).toBe(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
	});

	it('enables them for a timeline row that has a bar under it, and drives that row without touching a shelf card beside it', () => {
		const vault = new FakeVault();
		vault.addFile('Dated epic.md', {
			frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' },
		});
		vault.addFile('Dated feature.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-09-01', due: '2026-10-01' },
			parentLink: 'Dated epic',
		});
		// An undated Epic with its own child: lands on the shelf as a real card, sharing
		// the screen with the timeline — the mixed case where the exclusion has to hold
		// even while the buttons are genuinely live.
		vault.addFile('Shelf item.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Shelf child.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Shelf item' });
		const { containerEl } = makeRoadmap(vault, DATED_AXIS);

		// A parent nobody has ruled on opens shut, here as in the tree: the child is
		// behind the epic's disclosure and the controls are live because it drew one.
		expect(timelineTitles(containerEl)).toEqual(['Dated epic']);
		expect(kidTitlesOf(cardByTitle(containerEl, 'Shelf item'))).toEqual([]);
		const expand = collapseCtl(containerEl, 'Expand all');
		expect(expand?.disabled).toBe(false);

		expand?.click();

		expect(timelineTitles(containerEl)).toEqual(['Dated epic', 'Dated feature']);
		// The shelf card's own children are untouched by the same click.
		expect(kidTitlesOf(cardByTitle(containerEl, 'Shelf item'))).toEqual([]);
		disclosureOf(cardByTitle(containerEl, 'Shelf item'))?.click();
		expect(kidTitlesOf(cardByTitle(containerEl, 'Shelf item'))).toEqual(['Shelf child']);
	});
});

describe('the collapse controls stay honest under a filter', () => {
	it('really disables the collapse controls while a filter overrides them', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		expect(collapseCtls(containerEl)).toHaveLength(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(false);

		// Dimming them with CSS was enough while they were unreachable divs; a
		// focusable button has to refuse the press itself.
		view.setFilter('Feature');
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);

		view.setFilter('');
		expect(collapseCtls(containerEl).some((b) => b.disabled)).toBe(false);
	});

	// `disabled` only stops a click dispatched at the button itself; one on a child still
	// bubbles to the listener. The real icon is a child `<svg>`, but the mock only stamps
	// `data-icon` on the button (`test/CLAUDE.md`), so a stand-in child reproduces the shape.
	it('collapses nothing when a click lands on a descendant of a disabled collapse control', () => {
		const { view, containerEl } = makeView(fixture());

		view.setFilter('Feature');
		collapseCtl(containerEl, 'Collapse all')?.createSpan().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		view.setFilter(''); // clearing is what would surface a stray write

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
	});
});
