// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { useViewHarness } from '../helpers/view';
import { laneRoadmap, roadmapView } from '../helpers/roadmap';

/**
 * A release on the dated axis ([[A release on the dated axis]]): a line down the whole grid
 * at the date the RELEASE note itself states, in the same overlay the milestone lines are
 * drawn in and in a colour and a dash of its own.
 *
 * Its own file rather than a block in `roadmapMarkers.test.ts`, which is already at the
 * suite's line budget — and the subject is a different one anyway: a milestone's line is
 * derived from the BARS this grid drew, and a release has neither a bar nor a row.
 *
 * `releaseDateProperty` is deliberately unset in most cases below: the option ships a real
 * default (`note.target-date`), so the fixtures state the vault a reader actually has
 * rather than a configuration this suite talks itself into.
 */

useViewHarness();

const DATES = { startProperty: 'note.start', targetProperty: 'note.due' };

/** A vault with one dated release and one dated PBI, which is the ordinary picture. */
function releaseVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('1.1.0.md', {
		frontmatter: { type: 'Release', version: '1.1.0', 'target-date': '2026-09-15', status: 'Planned' },
	});
	vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-09-01', due: '2026-10-01' } });
	return vault;
}

const lines = (containerEl: HTMLElement) => containerEl.querySelectorAll('.pbl-release-line');
const labels = (containerEl: HTMLElement) =>
	Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-release-label')).map((el) => el.textContent ?? '');

describe('a release on the dated axis', () => {
	it('draws one line at the release note’s own date, named as a release', () => {
		const { containerEl } = roadmapView(releaseVault(), { ...DATES });

		expect(lines(containerEl)).toHaveLength(1);
		// The label NAMES the type, which is the one channel a colour cannot reach: two
		// full-height lines on one grid are told apart by hue and dash for a reader who can
		// see both, and by this sentence for everyone else.
		expect(labels(containerEl)).toEqual(['Release: 1.1.0']);
		const label = containerEl.querySelector<HTMLElement>('.pbl-release-label');
		expect(label?.dataset.tooltip).toBe('Release: 1.1.0');
	});

	it('draws it on the RESOURCES axis too, from the same list', () => {
		// The acceptance criterion that keeps this one mechanism rather than two: the overlay
		// crosses the rows, so a band-shaped axis draws the same mark in the same place.
		const vault = releaseVault();
		vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
		const { containerEl } = laneRoadmap(vault);

		expect(lines(containerEl)).toHaveLength(1);
		expect(labels(containerEl)).toEqual(['Release: 1.1.0']);
	});

	it('draws nothing on the horizon axis, where a bucket is not a date', () => {
		const vault = releaseVault();
		vault.addFile('Now item.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Now' } });
		const { containerEl, view } = roadmapView(vault, { horizonProperty: 'note.horizon' });
		view.setAxisPick('horizons');

		expect(containerEl.querySelectorAll('.pbl-bucket').length).toBeGreaterThan(0);
		expect(lines(containerEl)).toHaveLength(0);
	});

	it('draws no line for a release with no date, and none for one nobody can read', () => {
		const vault = new FakeVault();
		vault.addFile('Undated.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
		vault.addFile('Unreadable.md', { frontmatter: { type: 'Release', 'target-date': 'soon' } });
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-10-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(lines(containerEl)).toHaveLength(0);
		// Not vacuous: the grid drew, and a dated release in the same vault would have marked it.
		expect(containerEl.querySelector('.pbl-timeline')).not.toBeNull();
	});

	it('draws one line naming both when two releases share a date', () => {
		// Two lines a pixel apart read as one and quietly misreport the count — the milestone
		// overlay's own rule, kept for the same reason and in the same stable model order.
		const vault = releaseVault();
		vault.addFile('1.1.1.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-15' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(lines(containerEl)).toHaveLength(1);
		expect(labels(containerEl)).toEqual(['Release: 1.1.0 and 1.1.1']);
	});

	it('widens the window to hold a release dated past every bar', () => {
		// Extension 3b. A release is not a bar, so nothing else widens the window for one, and
		// a mark the window never held is clamped to the edge and painted on a day it does not
		// cover — the defect `An absence drew at the edge of a window it never widened` records
		// for the other source. Asserted as the line EXISTING, which is what `barGeometry`'s
		// `outside` would withhold.
		const vault = new FakeVault();
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-09-01' } });
		vault.addFile('Next year.md', { frontmatter: { type: 'Release', 'target-date': '2027-06-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(lines(containerEl)).toHaveLength(1);
	});

	it('draws no line for a release outside a CLAMPED window, and keys nothing for it', () => {
		// The window widens for a mark (3b) until `MAX_TIMELINE_DAYS` stops it — past that the
		// grid is clamped around today and a far release genuinely has no place on it.
		// `barGeometry` says `outside` and the overlay draws nothing rather than pinning the
		// line to the edge, which would claim a date the release does not have. The LEGEND is
		// the other half of the same criterion: `DrawnColors.release` is what actually drew,
		// never a predicate over `model.releases`, which still holds this one.
		const vault = new FakeVault();
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-09-01' } });
		vault.addFile('Someday.md', { frontmatter: { type: 'Release', 'target-date': '2126-06-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(lines(containerEl)).toHaveLength(0);
		expect(containerEl.querySelector('.pbl-legend-release')).toBeNull();
		// Not vacuous: the grid drew, and the story's own bar is on it.
		expect(containerEl.querySelectorAll('.pbl-bar').length).toBeGreaterThan(0);
	});

	it('draws nothing once the release-date option is cleared', () => {
		// Cleared is a decision and is the only way to "unconfigured" now that the option
		// ships a real default (extension 2c, as amended) — `clearablePropKey` is what tells
		// the two apart, and `''` is what a cleared picker leaves behind.
		const { containerEl } = roadmapView(releaseVault(), { ...DATES, releaseDateProperty: '' });

		expect(lines(containerEl)).toHaveLength(0);
	});

	it('reads the roadmap’s OWN key, so pointing it elsewhere moves the mark', () => {
		// Never the release view's key, which this view cannot see. Driven by naming a second
		// property the release note carries: the mark follows the option rather than the name.
		const vault = new FakeVault();
		vault.addFile('1.1.0.md', {
			frontmatter: { type: 'Release', 'target-date': '2026-09-15', shipped: '2026-11-20' },
		});
		vault.addFile('A story.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-10-01' } });
		const { containerEl } = roadmapView(vault, { ...DATES, releaseDateProperty: 'note.shipped' });

		expect(lines(containerEl)).toHaveLength(1);
		const own = containerEl.querySelector<HTMLElement>('.pbl-release-line');
		const { containerEl: other } = roadmapView(vault, { ...DATES });
		const dflt = other.querySelector<HTMLElement>('.pbl-release-line');
		expect(own?.style.getPropertyValue('--pbl-milestone-left')).not.toBe(
			dflt?.style.getPropertyValue('--pbl-milestone-left'),
		);
	});

	it('keys the legend on what DREW, never on the releases the base holds', () => {
		const { containerEl } = roadmapView(releaseVault(), { ...DATES });
		expect(containerEl.querySelector('.pbl-legend-release')).not.toBeNull();

		// A release the grid could not place is still in `model.releases` and must key nothing.
		const undated = new FakeVault();
		undated.addFile('Undated.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
		undated.addFile('A story.md', { frontmatter: { type: 'PBI', order: 10, due: '2026-10-01' } });
		const { containerEl: bare } = roadmapView(undated, { ...DATES });
		expect(bare.querySelector('.pbl-legend-release')).toBeNull();
	});

	it('is a mark and not a row: no card, no shelf entry, and the count is unmoved', () => {
		// The whole of what keeps `placedCount` honest — a release is not a result of this
		// projection, so it is neither placed nor shelved and appears in no walk of cards.
		const { containerEl } = roadmapView(releaseVault(), { ...DATES });

		const titles = Array.from(containerEl.querySelectorAll('.pbl-card-title')).map((el) => el.textContent);
		expect(titles).not.toContain('1.1.0');
		expect(containerEl.querySelectorAll('.pbl-shelf .pbl-card')).toHaveLength(0);
		expect(lines(containerEl)).toHaveLength(1);
	});

	it('draws no line for a release the base excluded', () => {
		// Extension 4a: the date lives on the excluded note, and guessing a position would be
		// worse than the gap.
		const vault = releaseVault();
		const { view, containerEl } = roadmapView(vault, { ...DATES });
		(view as unknown as { data: unknown }).data = {
			data: vault.entries().filter((e) => e.file.path !== '1.1.0.md'),
		};
		view.onDataUpdated();

		expect(lines(containerEl)).toHaveLength(0);
	});
});
