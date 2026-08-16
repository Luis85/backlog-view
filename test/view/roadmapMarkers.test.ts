// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { todayStamp } from '../../src/domain/noteFields';
import { FakeVault } from '../helpers/vault';
import { useViewHarness } from '../helpers/view';
import { barFor, gripNames, labelTexts, markersLane, markFor, roadmapView, rowFor, timelineRows } from '../helpers/roadmap';

/**
 * Markers on the dated axis: a milestone's own mark (reduced to a point, drawn clipped
 * rather than as a diamond once wholly outside the window) and the milestone LINE that
 * crosses the whole grid for a date one or more of them share — split out of
 * `roadmapFrame.test.ts`, which the marker and grab-cursor describe blocks pushed past the
 * test-file line budget.
 *
 * Since 2026-08-16 that mark is a diamond in ONE shared row at the head of the grid, never a
 * row apiece — the resources axis's rule ([[Milestones out of the resource rows]]) read on
 * the axis it came from. So every fact that used to be asked of a marker's row is asked of
 * its mark here, which is what `markFor` names.
 */

useViewHarness();

const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };
/** `todayCivil()` reads the same live clock, so this always names its date. */
const TODAY_ISO = todayStamp();

describe('a marker on the dated axis', () => {
	it('draws every marker in ONE row at the head of the grid, never a row apiece', () => {
		// The change of 2026-08-16: a date is a point, so a column of one-diamond rows spent a
		// row each saying what one row says and pushed the work down the pane. The work rows
		// are asserted beside it, or "no row for a marker" would also pass on a grid that drew
		// no rows at all.
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-08-10' } });
		vault.addFile('Contract ends.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-08-20' } });
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 30, due: '2026-09-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const markers = markersLane(containerEl);
		expect(markers?.querySelector('.pbl-lane-name')?.textContent).toBe('Milestones');
		expect(markers?.querySelectorAll('.pbl-bar-milestone')).toHaveLength(2);
		expect(rowFor(containerEl, 'Ship 1.0')).toBeNull();
		expect(rowFor(containerEl, 'Contract ends')).toBeNull();
		expect(rowFor(containerEl, 'A story')).not.toBeNull();
		// Drawn FIRST, ahead of the work it is read against — the whole of "at the top".
		expect(markers?.nextElementSibling).toBe(rowFor(containerEl, 'A story'));
	});

	it('mints that row only where a marker actually places, and folds it by nothing', () => {
		const vault = new FakeVault();
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-09-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		// A header standing for nothing on every base is a row that says nothing.
		expect(markersLane(containerEl)).toBeNull();

		const dated = new FakeVault();
		dated.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		const withMarker = roadmapView(dated, { ...DATES });
		// No disclosure: there is nothing under it to fold, and a bit able to take the dates the
		// whole plan is measured against off screen is what this row exists to prevent.
		expect(markersLane(withMarker.containerEl)?.querySelector('.pbl-chevron')).toBeNull();
	});

	it('draws no diamond for a milestone past the window edge, only the direction it lies past', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2200-01-01' } });
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 20, due: '2026-09-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const mark = markFor(containerEl, 'Ship 1.0');
		expect(mark.classList.contains('pbl-bar-milestone')).toBe(false);
		expect(mark.classList.contains('pbl-bar-outside')).toBe(true);
		expect(mark.classList.contains('pbl-bar-open-end')).toBe(true);
		// The exact date is never lost — it stays where the mark's accessible name puts it.
		expect(mark.getAttribute('aria-label')).toContain('2200-01-01');
	});

	it('draws no diamond for a milestone before the window edge either, marked open at the START', () => {
		// The mirror of the far-future case above: `barClasses` picks the open
		// direction from `geometry.clippedStart`, and every other outside case in
		// this suite lies past the RIGHT edge — nothing here has driven the left one.
		const vault = new FakeVault();
		vault.addFile('Kickoff.md', { frontmatter: { type: 'Milestone', order: 10, due: '1900-01-01' } });
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 20, due: '2026-09-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const mark = markFor(containerEl, 'Kickoff');
		expect(mark.classList.contains('pbl-bar-outside')).toBe(true);
		expect(mark.classList.contains('pbl-bar-open-start')).toBe(true);
		expect(mark.getAttribute('aria-label')).toContain('1900-01-01');
	});

	it('opens its note on every gesture a bar row had — click, middle click and the menu', () => {
		// The diamond inherited `wireCardActivation`'s whole job when the row went, and it
		// shipped with the primary click alone: a middle click never fires `click` at all, and
		// nothing else on this grid carries a marker's row menu — which is the only pointer
		// route to Schedule, Unschedule and Set state for a date. Found in review (2026-08-16).
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });
		const mark = markFor(containerEl, 'Ship 1.0');

		mark.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Ship 1.0.md']);

		mark.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
		expect(vault.opened).toHaveLength(2);
		expect(vault.opened[1]).toMatchObject({ path: 'Ship 1.0.md', mode: 'tab' });

		mark.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toContain('Open in new tab');
	});

	it('leaves the connector out of all three, which is what makes the mark a control’s parent', () => {
		// `fromRowControl`'s own case, asked of the gesture pair rather than of `click` alone:
		// the connector is a button INSIDE the diamond, so a press on it must start a link
		// drag and never open the note — the identical defect a bar row's grips produced.
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES, dependsOnProperty: 'note.dependsOn' });
		const connector = markFor(containerEl, 'Ship 1.0').querySelector<HTMLElement>('.pbl-bar-connector');
		if (!connector) throw new Error('no connector on the diamond');

		connector.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		connector.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
		expect(vault.opened).toEqual([]);
	});

	it('puts the milestone’s name and exact date on the mark itself', () => {
		// The row's lead named it until 2026-08-16 and there is no lead any more, so the
		// diamond is the only place a name can be: bare marks in a shared track are legible
		// because the mark says where and the full-height line's label says what.
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const mark = markFor(containerEl, 'Ship 1.0');
		expect(mark.getAttribute('aria-label')).toBe('Ship 1.0 — Milestone 2026-12-01');
		expect(mark.dataset.tooltip).toBe('Ship 1.0 — Milestone 2026-12-01');
	});
});

describe('per-state bar colour', () => {
	it('slots a row by its state\'s index in the same vocabulary the board and Set state use', () => {
		const vault = new FakeVault();
		vault.addFile('First.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-08-05', status: 'New' } });
		vault.addFile('Second.md', { frontmatter: { type: 'PBI', order: 20, due: '2026-08-06', status: 'Active' } });
		const { containerEl } = roadmapView(vault, { ...DATES, stateProperty: 'note.status', stateValues: 'New, Active, Done' });

		expect(rowFor(containerEl, 'First')?.classList.contains('pbl-state-0')).toBe(true);
		expect(rowFor(containerEl, 'Second')?.classList.contains('pbl-state-1')).toBe(true);
	});

	it('leaves an unstated item with no slot class', () => {
		const vault = new FakeVault();
		vault.addFile('No state.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-08-05' } });
		const { containerEl } = roadmapView(vault, { ...DATES, stateProperty: 'note.status', stateValues: 'New, Active, Done' });

		const classes = [...(rowFor(containerEl, 'No state')?.classList ?? [])];
		expect(classes.some((c) => c.startsWith('pbl-state-'))).toBe(false);
	});

	it('leaves a value outside the vocabulary with no slot class', () => {
		const vault = new FakeVault();
		vault.addFile('Odd.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-08-05', status: 'Blocked' } });
		const { containerEl } = roadmapView(vault, { ...DATES, stateProperty: 'note.status', stateValues: 'New, Active, Done' });

		const classes = [...(rowFor(containerEl, 'Odd')?.classList ?? [])];
		expect(classes.some((c) => c.startsWith('pbl-state-'))).toBe(false);
	});

	it('carries both its slot and pbl-done on a done state, leaving the CSS to pick the winner', () => {
		const vault = new FakeVault();
		vault.addFile('Shipped.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-08-05', status: 'Done' } });
		const { containerEl } = roadmapView(vault, { ...DATES, stateProperty: 'note.status', stateValues: 'New, Active, Done' });

		const row = rowFor(containerEl, 'Shipped');
		expect(row?.classList.contains('pbl-done')).toBe(true);
		expect(row?.classList.contains('pbl-state-2')).toBe(true);
	});
});

describe('the grab-cursor class', () => {
	it('marks pbl-bar-holdable exactly where barHolds offers the body hold, asked of every bar rather than one', () => {
		const vault = new FakeVault();
		// Stated (both ends its own) holds; the half-inferred parent below — one end
		// borrowed from its child — withholds the body even though its stated end
		// still offers its own grip.
		vault.addFile('Stated.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-20' } });
		vault.addFile('Parent.md', { frontmatter: { type: 'Epic', order: 20, start: '2026-08-01' } });
		vault.addFile('Child.md', { frontmatter: { type: 'Feature', order: 10, due: '2026-09-30' }, parentLink: 'Parent' });
		const { containerEl } = roadmapView(vault, { ...DATES });

		// Asked of the RULE, not a hardcoded true/false per fixture: the class must
		// agree with `barHolds`' own answer for every bar this vault draws.
		const titles = timelineRows(containerEl).map((row) => row.querySelector('.pbl-card-title')?.textContent ?? '');
		const expected = titles.map((title) => gripNames(containerEl, title).includes('body'));
		const actual = titles.map((title) => barFor(containerEl, title).hasClass('pbl-bar-holdable'));
		expect(actual).toEqual(expected);
		// And the rule distinguishes something here — not a class glued to every `.pbl-bar`.
		expect(new Set(actual)).toEqual(new Set([true, false]));
	});
});

describe('milestone lines', () => {
	it('draws one line per readable milestone inside the window, each with a mark of its own', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		vault.addFile('A story.md', {
			frontmatter: { type: 'PBI', order: 20, start: '2026-09-01', due: '2026-10-01' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(1);
		// Every line has a MARK: no milestone is visible only as a line. The row it used to
		// have is gone; the diamond in the shared row is what carries the claim now.
		expect(markFor(containerEl, 'Ship 1.0')).not.toBeNull();
		expect(labelTexts(containerEl)).toEqual(['Ship 1.0']);
	});

	it('carries the full name in the label’s tooltip — the truncated label can be hovered', () => {
		// The label is CSS-truncated (`max-width: 140px`) and the full name is promised
		// "one hover away", which only means something if the label can actually receive
		// a hover — `pointer-events: none` would make it a dead spot no pointer ever
		// reaches. jsdom does not run layout or hit-testing, so this checks the one thing
		// it can: the tooltip data the hover is meant to surface is really there.
		const vault = new FakeVault();
		vault.addFile('Ship a very long milestone title that will not fit.md', {
			frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		const label = containerEl.querySelector<HTMLElement>('.pbl-milestone-label');
		expect(label?.dataset.tooltip).toBe('Ship a very long milestone title that will not fit');
	});

	it('hangs the label in the coarse tier, where a label per month is what it can cover', () => {
		// The label is an opaque 140px box reading rightward from its own date, so it covers
		// whatever labels its tier carries to the right of it. In the CELL tier that is one
		// per week and the casualty was certain — seen in a vault as `28 Sep` reading `28 S`
		// under `Ship the roadmap epic`. In the coarse tier it is one per month, so the same
		// box usually covers nothing, and the date it used to eat is still spelt out below it.
		//
		// Asserted as the TIER the label is in rather than as anything about widths, which is
		// all jsdom can see: it lays nothing out, so which pixels are covered is a live-vault
		// question either way. What this refuses is the mount point moving back.
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const label = containerEl.querySelector<HTMLElement>('.pbl-milestone-label');
		expect(label?.parentElement?.classList.contains('pbl-timeline-super')).toBe(true);
		// Not vacuous: the tier it is NOT in is on screen and carries the day cells.
		const cells = containerEl.querySelectorAll('.pbl-timeline-track:not(.pbl-timeline-super) > .pbl-timeline-cell');
		expect(cells.length).toBeGreaterThan(0);
	});

	it('draws one line naming both when two milestones share a date', () => {
		// Two lines a pixel apart read as one and quietly misreport the count.
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		vault.addFile('Contract ends.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-12-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(1);
		expect(labelTexts(containerEl)).toEqual(['Ship 1.0 · Contract ends']);
	});

	it('draws no line for a milestone outside the window, and none for a context row', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2200-01-01' } });
		vault.addFile('Excluded.md', { frontmatter: { type: 'Milestone', order: 20, due: '2026-12-01' } });
		vault.addFile('Result.md', {
			frontmatter: { type: 'Epic', order: 30, due: '2026-09-01' },
			parentLink: 'Excluded',
		});
		const { view, containerEl } = roadmapView(vault, { ...DATES });

		// A line across every result is derived FROM the results, and a context row is
		// never a source of one: exclude 'Excluded' from the base's own results — its
		// explicit parent link on Result pulls it back in as context, not a result.
		(view as unknown as { data: unknown }).data = {
			data: vault.entries().filter((e) => e.file.path !== 'Excluded.md'),
		};
		view.onDataUpdated();

		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(0);
	});

	it('draws a milestone dated today beside the today line, with today keeping its pixel', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: TODAY_ISO } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const px = (sel: string, prop: string) =>
			Number.parseFloat(containerEl.querySelector<HTMLElement>(sel)?.style.getPropertyValue(prop) ?? '');
		expect(px('.pbl-milestone-line', '--pbl-milestone-left')).toBe(px('.pbl-today', '--pbl-today-left') + 2);
		expect(containerEl.querySelectorAll('.pbl-today')).toHaveLength(1);
	});

	it('hides a line exactly when its row hides', () => {
		// The visibility rule travels with the item, not with the projection.
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', {
			frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01', status: 'Done' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES, stateProperty: 'note.status', showCompleted: false });

		expect(containerEl.querySelectorAll('.pbl-milestone-line')).toHaveLength(0);
		// And the mark goes with it — the shared row is minted by a PLACED marker, so with the
		// only one hidden there is no row at all rather than an empty header.
		expect(markersLane(containerEl)).toBeNull();
	});

	it('makes neither the line nor its label a second selection stop', () => {
		const vault = new FakeVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', order: 10, due: '2026-12-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		const line = containerEl.querySelector<HTMLElement>('.pbl-milestone-line');
		expect(line?.getAttribute('aria-hidden')).toBe('true');
		expect(line?.hasAttribute('tabindex')).toBe(false);
		expect(containerEl.querySelector('.pbl-milestone-label')?.closest('[role="option"]')).toBeNull();
	});
});
