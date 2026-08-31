// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { clickExpandAll, Harness, makeView, useViewHarness } from '../helpers/view';
import { barFor, laneNames, lanesOf, markFor, rowFor } from '../helpers/roadmap';
import { gridDrag } from '../helpers/dnd';
import { countingVault } from '../helpers/resources';
import { Menu } from '../helpers/obsidian-mock';

useViewHarness();

/**
 * The milestones' own row: one shared header track of diamonds, and every fact a bar ROW
 * would have carried asked of the mark instead — [[Milestones out of the resource rows]].
 *
 * Split from `resourceLanes.test.ts` on 2026-08-15, when the budget forced a line and this
 * was the subject already standing apart in it: that file is about a row per RESOURCE, and
 * this row stands for nobody. Both drive the axis through a near-twin of
 * `test/helpers/roadmap.ts`'s own `laneRoadmap`, which that helper's doc already records.
 */
const RESOURCES = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	assigneeProperty: 'note.assignee',
};

/** A roadmap on the resources axis with the rows expanded, this file's every fixture. */
function laneRoadmap(vault: FakeVault, config: Record<string, unknown> = {}): Harness {
	const harness = makeView(vault, { ...RESOURCES, ...config }, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	harness.view.setShelfCollapsed(false);
	// AFTER the axis is picked: a bar's fold is its own scope, and an expand-all run while
	// the tree is on screen settles the tree's bits and not this grid's.
	clickExpandAll(harness.containerEl);
	return harness;
}

describe('the milestones row', () => {
	function markerVault(): FakeVault {
		const vault = countingVault([]);
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 20, assignee: 'Alice', due: '2026-08-07' },
		});
		vault.addFile('Launch.md', { frontmatter: { type: 'Milestone', order: 30, due: '2026-08-20' } });
		return vault;
	}

	it('draws every marker as a diamond in one header track, and no row of its own', () => {
		const harness = laneRoadmap(markerVault());
		const markers = lanesOf(harness.containerEl)[0];

		expect(laneNames(harness.containerEl)[0]).toBe('Milestones');
		expect(markers.querySelectorAll('.pbl-bar-milestone')).toHaveLength(2);
		// Not a row apiece, and not a row in anybody's band either.
		expect(rowFor(harness.containerEl, 'Ship')).toBeNull();
		expect(rowFor(harness.containerEl, 'Launch')).toBeNull();
	});

	it('draws no disclosure, so nothing can fold the dates the plan is measured against', () => {
		const harness = laneRoadmap(markerVault());
		const [markers, alice] = lanesOf(harness.containerEl);

		expect(markers.querySelector('.pbl-chevron')).toBeNull();
		// The control is a band's, not a header's: Alice's still has one.
		expect(alice.querySelector('.pbl-chevron')).not.toBeNull();
	});

	it('names each diamond in CONTENT, since a plain div may carry no accessible name', () => {
		// `.pbl-bar` is a div, so its implicit role is `generic` and ARIA prohibits a name on
		// it — an `aria-label` there may be announced by nobody, which for a mark with no row
		// of its own means the name is lost rather than moved. `stateNote` states that rule
		// for this element and this row broke it until 2026-08-16 (found in review).
		const harness = laneRoadmap(markerVault());
		const diamonds = lanesOf(harness.containerEl)[0].querySelectorAll<HTMLElement>('.pbl-bar-milestone');

		const said = diamonds[0].querySelector('.pbl-sr-only')?.textContent ?? '';
		expect(said).toContain('Ship');
		expect(said).toContain('2026-08-07');
		expect(diamonds[0].hasAttribute('aria-label')).toBe(false);
	});

	it('withholds the absence control — the row stands for nobody', () => {
		const harness = laneRoadmap(markerVault());
		const [markers, alice] = lanesOf(harness.containerEl);

		expect(markers.querySelector('.pbl-lane-absence-add')).toBeNull();
		expect(alice.querySelector('.pbl-lane-absence-add')).not.toBeNull();
	});

	/** Each drawn diamond's sub-lane index, by the title its accessible name leads with. */
	function sublanesOf(containerEl: HTMLElement): Map<string, string> {
		const marks = lanesOf(containerEl)[0].querySelectorAll<HTMLElement>('.pbl-bar-milestone');
		return new Map(
			Array.from(marks, (el) => [
				(el.querySelector('.pbl-sr-only')?.textContent ?? '').split(' — ')[0],
				el.style.getPropertyValue('--pbl-sublane'),
			]),
		);
	}

	it('stacks two markers that land on the same day, so neither can hide the other', () => {
		// One row for all of them means `barGeometry` gives two markers on one date the
		// same `left` in the same track, and a diamond is 12px of opaque mark — so the
		// later one covered the earlier outright, taking its tooltip, its click and its
		// drag with it. A row apiece could never produce that, which is why it arrived
		// with the shared row.
		const vault = countingVault([]);
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-08-07' } });
		vault.addFile('Demo.md', { frontmatter: { type: 'Milestone', order: 30, due: '2026-08-07' } });
		vault.addFile('Launch.md', { frontmatter: { type: 'Milestone', order: 40, due: '2026-08-20' } });
		const harness = laneRoadmap(vault);

		const sublanes = sublanesOf(harness.containerEl);
		expect(sublanes.get('Ship')).toBe('0');
		expect(sublanes.get('Demo')).toBe('1');
		// A day of its own takes the first sub-lane back: the stack is per POSITION, not a
		// running index, or one collision would step every later mark down the row.
		expect(sublanes.get('Launch')).toBe('0');
		// What the header grows by — the same property an absence packs with.
		expect(lanesOf(harness.containerEl)[0].style.getPropertyValue('--pbl-lane-sublanes')).toBe('2');
	});

	it('keys the accent a marker beyond the window draws, not the cyan it does not', () => {
		// `barClasses` gives a wholly-outside mark no `pbl-bar-milestone` — it draws the
		// plain accent under `.pbl-bar-outside` — so `Other` is the swatch owed and this
		// reported neither. Exactly the defect the dated axis's own report was fixed for
		// once already, arriving on the axis whose report was written fresh beside it.
		const vault = new FakeVault();
		// Nothing else here may draw the accent, or the swatch would appear whatever the
		// diamond reports — so the one work bar carries a state, which paints a slot rather
		// than the plain accent. It is also what stretches the plan past
		// `MAX_TIMELINE_DAYS`, the only thing that can still put a mark outside the window.
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', status: 'Active', start: '2020-01-01', due: '2032-01-01' },
		});
		vault.addFile('Far.md', { frontmatter: { type: 'Milestone', order: 20, due: '2033-01-04' } });
		const harness = laneRoadmap(vault, { stateProperty: 'note.status', stateValues: 'New, Active' });
		const mark = harness.containerEl.querySelector<HTMLElement>('.pbl-lane-markers .pbl-bar');

		// The premise, stated rather than assumed: this mark really is drawing the accent.
		expect(mark?.className).toContain('pbl-bar-outside');
		expect(mark?.className).not.toContain('pbl-bar-milestone');
		expect(harness.containerEl.querySelector('.pbl-legend-other')).not.toBeNull();
		expect(harness.containerEl.querySelector('.pbl-legend-milestone')).toBeNull();
	});

	it('anchors a dependency arrow on each stacked diamond, not on the row they share', () => {
		// jsdom measures nothing, so the diamonds are given the box the stylesheet's own
		// rule gives them (`.pbl-lane-markers .pbl-bar`, `top: calc(15px + sub * 17px)`);
		// what is asserted is which ELEMENT the arrow layer reads a Y off, never the
		// arithmetic. Both edges run to ONE dependent and start on the same day, so the X
		// is identical by construction and only the Y can tell them apart — read off the
		// shared header, as it was until the diamonds could stack, the two paths came out
		// byte for byte the same and pointed between the marks rather than at either.
		// Whether the picture then reads is a live-vault check this cannot make.
		const real = Element.prototype.getBoundingClientRect;
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element): DOMRect {
			if (!(this instanceof HTMLElement) || !this.matches('.pbl-lane-markers .pbl-bar')) return real.call(this);
			const top = 15 + Number(this.style.getPropertyValue('--pbl-sublane') || '0') * 17;
			return { top, bottom: top + 12, height: 12, left: 0, right: 12, width: 12, x: 0, y: top, toJSON: () => ({}) };
		});
		const vault = countingVault([]);
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-08-07' } });
		vault.addFile('Demo.md', { frontmatter: { type: 'Milestone', order: 30, due: '2026-08-07' } });
		vault.fm('Work.md')['dependsOn'] = ['[[Ship]]', '[[Demo]]'];
		// Named explicitly: `dependenciesAvailable` is true on the ADOPTABLE key, so the
		// connectors draw either way, but the MODEL reads prerequisites off the bound one
		// and there is no edge to anchor without it.
		const harness = laneRoadmap(vault, { dependsOnProperty: 'note.dependsOn' });

		const paths = Array.from(harness.containerEl.querySelectorAll<SVGElement>('.pbl-dep-edge'), (el) =>
			el.getAttribute('d'),
		);
		expect(paths).toHaveLength(2);
		expect(new Set(paths).size).toBe(2);
	});

	it('draws a dependency handle on each diamond, the one route to making anything wait on a date', () => {
		// `addDependencyItems` refuses both menu entries for a marker — a point in time
		// waits for nothing — so the connector is not one input of three here, it is the
		// only one. Without it this axis could not express what the dated axis can.
		const harness = laneRoadmap(markerVault());
		const diamonds = lanesOf(harness.containerEl)[0].querySelectorAll<HTMLElement>('.pbl-bar-milestone');

		expect(diamonds).toHaveLength(2);
		for (const diamond of diamonds) expect(diamond.querySelector('.pbl-bar-connector')).not.toBeNull();
	});

	it('does not open the note when that handle is clicked without a drag', () => {
		// The diamond's own click handler is what opens the note here, and the connector is
		// a child of it — the identical defect `fromRowControl` was written for on a bar
		// row, arriving again on the one mark that wires its click by hand.
		const vault = markerVault();
		const harness = laneRoadmap(vault);
		const diamond = lanesOf(harness.containerEl)[0].querySelector<HTMLElement>('.pbl-bar-milestone');
		const dot = diamond?.querySelector<HTMLElement>('.pbl-bar-connector');

		dot?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(vault.opened).toEqual([]);

		// The control beside the defect: the mark itself still opens, so the guard is a
		// filter on the handle and not a click the row stopped answering.
		diamond?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(vault.opened.map((one) => one.path)).toEqual(['Ship.md']);
	});

	it('stays open when a real resource of the same name is folded', () => {
		// A resource genuinely called `Milestones` draws a second row of that caption
		// (extension 1a) and its fold is keyed by its own PATH now (`laneIdentity`), never
		// by the caption both rows happen to share. So folding the PERSON must not answer
		// for the synthetic row as well: it once took `pbl-lane-collapsed` and drew
		// folded-work rails under diamonds that never left the screen — and with no
		// disclosure of its own, nothing there could undo it.
		const vault = new FakeVault();
		vault.addFile('Milestones.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-08-07' } });
		vault.addFile('Theirs.md', {
			frontmatter: { type: 'Epic', order: 30, assignee: 'Milestones', start: '2026-08-02', due: '2026-08-09' },
		});
		const harness = laneRoadmap(vault);
		// The premise, stated rather than assumed: two rows carry that caption, and the
		// chevron belongs to the second one — the roster's, which has work to fold.
		expect(laneNames(harness.containerEl)).toEqual(['Milestones', 'Milestones']);
		lanesOf(harness.containerEl)[1].querySelector('.pbl-chevron')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const [markers, roster] = lanesOf(harness.containerEl);
		expect(markers.classList.contains('pbl-lane-collapsed')).toBe(false);
		expect(markers.querySelectorAll('.pbl-lane-rail')).toHaveLength(0);
		expect(markers.querySelectorAll('.pbl-bar-milestone')).toHaveLength(1);
		// The control beside it: the row the reader actually folded really did fold.
		expect(roster.classList.contains('pbl-lane-collapsed')).toBe(true);
		expect(roster.querySelectorAll('.pbl-lane-rail')).toHaveLength(1);
	});

	it('names the missing roster rather than staying quiet, when a milestone is the only thing drawn', () => {
		// The diamonds are deliberately absent from `drawnCards` — a mark in a shared
		// header is no `option` and nothing could point the roving selection at it
		// (extension 3c) — and the advisory's population used to be read off that same
		// list, so a plan whose only visible note was a milestone announced itself as empty
		// beside the milestone it was drawing. That population defect is fixed; what
		// replaces its silence is not none — a base with a dated milestone and NO
		// `Resource` note at all is exactly [[Rows from the Resource notes]]'s empty case
		// (Task 5, 2026-08-28), and the advisory says so rather than looking like a working
		// axis with nobody on the roster.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-08-07' } });
		const harness = laneRoadmap(vault);

		// The premise, stated rather than assumed: the mark really is on screen, and it
		// really is the only thing with no row of its own to be counted by.
		expect(lanesOf(harness.containerEl)[0].querySelectorAll('.pbl-bar-milestone')).toHaveLength(1);
		expect(harness.containerEl.querySelectorAll('.pbl-timeline-row')).toHaveLength(0);
		expect(harness.containerEl.querySelector('.pbl-empty-title')?.textContent).toBe('No resources in this base');
	});

	it('registers each diamond, so its parent bar is not offered the child it is looking at', () => {
		// The mark is the whole of what a marker draws here — no card body, no row of its
		// own — and `ctx.placed` is where a surface says it drew something. `cardedPaths`
		// reads that register and `menuChildren` subtracts it, so a diamond drawn and not
		// registered reads as a child with nowhere to be reached from, and the bar above it
		// offers `Open child "Ship"` for the mark in the row over its head. Shipped once:
		// [[Milestones in one row on the dated axis]] 3d.
		const vault = countingVault([]);
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 20, due: '2026-08-07' },
			parentLink: 'Work',
		});
		// The second child is what OPENS the section at all: `datedEntries` and each band
		// alike hand `timelineRowEls` the work bars with the markers split out, so a chevron
		// is never decided by a marker and a parent whose only child is one draws none.
		vault.addFile('Follow.md', {
			frontmatter: { type: 'Feature', order: 30, assignee: 'Alice', start: '2026-08-02', due: '2026-08-09' },
			parentLink: 'Work',
		});
		const harness = laneRoadmap(vault);

		// The premise, stated rather than assumed: the diamond really is on screen, and it
		// really is a child the section below would have listed.
		expect(markFor(harness.containerEl, 'Ship')).not.toBeNull();
		rowFor(harness.containerEl, 'Work')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		const titles = Menu.lastShown?.items.map((one) => one.titleText) ?? [];
		expect(titles).toContain('Hide children');

		expect(titles.filter((one) => one.startsWith('Open child'))).toEqual([]);
	});

	it('marks a milestone the held drag may not land on, and clears it when the drag ends', () => {
		// Work already waits for Ship, so dropping Work onto Ship would close a loop. The
		// sweep marks ROWS, and a marker on this axis has none — the mark is the only
		// element that is one milestone's, so it is what carries the path and the class.
		// Unmarked, every date read as a legal target and the drop was refused after
		// release: [[Draw a dependency between bars]] 2a's own refusal.
		const vault = countingVault([]);
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-08-07' } });
		vault.fm('Work.md')['dependsOn'] = ['[[Ship]]'];
		const harness = laneRoadmap(vault);
		const diamond = lanesOf(harness.containerEl)[0].querySelector<HTMLElement>('.pbl-bar-milestone');
		const source = barFor(harness.containerEl, 'Work').querySelector<HTMLElement>('.pbl-bar-connector');
		if (!diamond || !source) throw new Error('no diamond, or no connector to drag from');

		const gesture = gridDrag.start(source);
		expect(diamond.classList.contains('pbl-link-illegal')).toBe(true);

		gesture.cancel();
		expect(diamond.classList.contains('pbl-link-illegal')).toBe(false);
	});
});
