// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { fixture, makeView, titlesOf, useViewHarness } from '../helpers/view';
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { horizonVault, makeRoadmap, shelfTitles } from '../helpers/roadmap';

useViewHarness();

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

describe('the bulk collapse controls reach cards', () => {
	it('offers Expand all and Collapse all on the board, driving the cards', () => {
		const { containerEl } = makeBoard(boardVault());
		const expand = collapseCtl(containerEl, 'Expand all');
		expect(expand?.disabled).toBe(false);

		expand?.click();

		expect(kidTitlesOf(cardByTitle(containerEl, 'Epic B'))).toEqual(['Feature B1', 'Feature B2']);
	});

	it('drives the roadmap’s cards too', () => {
		// A horizon roadmap: its bucket cards and shelf cards both come through
		// `renderCardBody`, so they carry disclosures exactly as board cards do.
		const vault = horizonVault();
		vault.addFile('Feature N1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Now item' });
		const { containerEl } = makeRoadmap(vault);
		const expand = collapseCtl(containerEl, 'Expand all');
		expect(expand?.disabled).toBe(false);

		expand?.click();

		expect(kidTitlesOf(cardByTitle(containerEl, 'Now item'))).toEqual(['Feature N1']);
	});

	// Half the original gate's reason survives: on a projection that drew no disclosure
	// these buttons change nothing on screen and still write collapse state, which then
	// surprises the tree. Disabled, not absent, and on the property rather than in CSS.
	it('disables them on a board that drew no cards at all', () => {
		// No configured workflow, so the board draws guidance rather than columns.
		const { containerEl } = makeBoard(boardVault(), { stateProperty: '', stateValues: '' });
		expect(collapseCtls(containerEl).length).toBe(2);
		expect(collapseCtls(containerEl).every((b) => b.disabled)).toBe(true);
	});

	it('disables them on a dated roadmap whose only rows are timeline rows', () => {
		const DATED_AXIS = { startProperty: 'note.start', targetProperty: 'note.due', horizonProperty: '' };
		const vault = new FakeVault();
		// BOTH dated, so both draw bars and neither is unplaceable: the shelf stays
		// empty, no card body is drawn anywhere in the projection, and there is
		// genuinely nothing to collapse. This is the case a board-only test cannot
		// reach — cards exist on screen, and none of them is a card body.
		vault.addFile('Dated epic.md', {
			frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-12-01' },
		});
		vault.addFile('Dated feature.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-09-01', due: '2026-10-01' },
			parentLink: 'Dated epic',
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
