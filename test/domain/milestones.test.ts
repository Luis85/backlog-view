import { describe, expect, it } from 'vitest';
import { BacklogItem, BacklogModel, buildModel } from '../../src/domain/model';
import { buildRoadmap, RoadmapAxis } from '../../src/domain/roadmap';
import { BacklogSettings, defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

/**
 * What a marker does to everything around it: nothing. Split out of `model.test.ts` and
 * `roadmap.test.ts` by subject — both were within a handful of lines of the 450-line test
 * budget, and the one suite without a cap is the one that grows.
 */

const settings = defaultSettings();
/** The span-rollup fixture's own settings, copied exactly: both date keys, plus state. */
const dated = { ...settings, startKey: 'start', targetKey: 'due', stateKey: 'status' };

/** One note, as a title and the frontmatter it carries — `parent` is a bare title. */
function note(title: string, frontmatter: Record<string, unknown>): [string, Record<string, unknown>] {
	return [title, frontmatter];
}

function buildModelFrom(notes: [string, Record<string, unknown>][], config: BacklogSettings = dated): BacklogModel {
	const vault = new FakeVault();
	for (const [title, frontmatter] of notes) vault.addFile(`${title}.md`, { frontmatter });
	return buildModel(vault.app, vault.entries(), config);
}

function buildRoadmapFrom(
	notes: [string, Record<string, unknown>][],
	config: Partial<BacklogSettings>,
	axis: RoadmapAxis = 'dates',
) {
	const merged = { ...settings, ...config };
	return buildRoadmap(buildModelFrom(notes, merged), merged, () => true, axis);
}

describe('a marker aggregates into nothing', () => {
	it('is never counted by an ancestor’s progress rollup', () => {
		// Never counted is a rule about AGGREGATION. A point in time contains no work, so
		// its own status must neither advance a progress figure nor keep a finished
		// subtree on screen. This is the second exception to "a rollup counts every
		// descendant the Base returned"; the first is the context row, and they sit on the
		// same line for the same reason.
		// `subtreeDone` is `item.done && doneDescendants === descendantCount` — the epic
		// itself has to be Done too, or the AND is false either way and the marker's
		// effect on the count is never the thing that flips this assertion.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic', status: 'Done' }),
			note('A story', { type: 'PBI', parent: 'An epic', status: 'Done' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'An epic', status: 'Open' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		expect(epic.descendantCount).toBe(1);
		expect(epic.doneDescendants).toBe(1);
		// The marker being open must not keep the epic's subtree on screen.
		expect(epic.subtreeDone).toBe(true);
	});

	it('is never evidence for an ancestor’s inferred span', () => {
		// A release date hand-placed under an epic must not become the end of that epic's
		// inferred bar — precisely the reading a dateless ancestor takes from a dated
		// descendant. Having a parent makes a marker neither countable nor datable.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'An epic', due: '2026-12-01' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		expect(epic.descendantStart).toBeNull();
		expect(epic.descendantTarget).toBeNull();
	});

	it('is traversed THROUGH: results hand-nested below one still reach their ancestors', () => {
		// The marker is skipped, not its subtree — the context row's exact shape. A work
		// item somebody filed under a milestone is still this base's work.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'An epic' }),
			note('Prep', { type: 'PBI', parent: 'Ship 1.0', due: '2026-09-01' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		expect(epic.descendantCount).toBe(1);
		expect(epic.descendantTarget).toEqual({ year: 2026, month: 9, day: 1 });
	});

	it('counts for nothing wherever it sits, and is traversed through — a Release too', () => {
		// The three claims above, asked of a `Release`. NOT "a release is not a child of
		// anything": `linkAll` special-cases no marker, so a hand-written parent nests one
		// exactly as it nests a `Milestone`. What `Releases as their own type` 2a means by
		// "the parent places it nowhere" is what the model DOES enforce — no rung, no count,
		// no date evidence, and the walk goes THROUGH it to the work below.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic' }),
			note('1.0', { type: 'Release', parent: 'An epic', due: '2026-12-01' }),
			note('Prep', { type: 'PBI', parent: '1.0', due: '2026-09-01' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		// The release itself is not counted; the PBI filed under it still is.
		expect(epic.descendantCount).toBe(1);
		// And the release's own date is not evidence for the epic's inferred span.
		expect(epic.descendantTarget).toEqual({ year: 2026, month: 9, day: 1 });
	});
});

describe('a release is on no axis of the backlog roadmap', () => {
	/** One release stating everything all three axes read, so no axis can plead absence. */
	const RELEASE: [string, Record<string, unknown>][] = [
		['1.0', { type: 'Release', start: '2026-09-01', due: '2026-09-30', horizon: 'Now', assignee: 'Sam' }],
		['Prep', { type: 'PBI', due: '2026-09-15' }],
	];
	const AXIS_CONFIG = {
		startKey: 'start',
		targetKey: 'due',
		horizonKey: 'horizon',
		horizonValues: ['Now', 'Next'],
		assigneeKey: 'assignee',
	};

	// All three, because the guard is at `roadmapRows` — the single funnel `buildRoadmap`
	// takes before it branches — and the one that would be missed by asking only the axis
	// the guard was written for is the BUCKET axis, which never calls `placeItem` at all.
	for (const axis of ['dates', 'resources', 'horizons'] as RoadmapAxis[]) {
		it(`draws nothing and shelves nothing on the ${axis} axis`, () => {
			const roadmap = buildRoadmapFrom(RELEASE, AXIS_CONFIG, axis);
			expect(roadmap.bars.map((b) => b.item.title)).not.toContain('1.0');
			// The shelf is the half that is easy to call "gated": it is counted, grouped and
			// a drop target that un-places, so a release sitting there is still a release
			// this roadmap is showing.
			expect(roadmap.shelf.map((s) => s.item.title)).not.toContain('1.0');
			expect(roadmap.buckets.flatMap((b) => b.cards).map((c) => c.title)).not.toContain('1.0');
			expect(roadmap.lanes.flatMap((l) => l.bars).map((b) => b.item.title)).not.toContain('1.0');
			expect(roadmap.context.map((c) => c.title)).not.toContain('1.0');
			// And it is not counted as a result either — placed plus shelved is the visible
			// result rows, and a release is none of them.
			expect(roadmap.placedCount + roadmap.shelf.length).toBe(1);
		});
	}
});

describe('a milestone draws as the point it is', () => {
	it('reduces to its target date and ignores a start the note also carries', () => {
		// The type is the stronger statement. Reading the pair as a span would let a stray
		// property turn a deadline into a duration.
		const roadmap = buildRoadmapFrom(
			[note('Ship 1.0', { type: 'Milestone', start: '2026-01-01', due: '2026-12-01' })],
			{ startKey: 'start', targetKey: 'due' },
		);
		expect(roadmap.shelf).toEqual([]);
		expect(roadmap.bars).toHaveLength(1);
		expect(roadmap.bars[0].span).toEqual({
			start: { year: 2026, month: 12, day: 1 },
			target: { year: 2026, month: 12, day: 1 },
		});
		expect(roadmap.bars[0].inferredStart).toBe(false);
		expect(roadmap.bars[0].inferredEnd).toBe(false);
	});

	it('draws a stale start LATER than the target as a point, not a shelved reversal', () => {
		// This is the whole reason the reduction lives in derivation. A rendering seam is
		// never reached: `reversedSpan` shelves the item before any geometry runs.
		const roadmap = buildRoadmapFrom(
			[note('Ship 1.0', { type: 'Milestone', start: '2027-01-01', due: '2026-12-01' })],
			{ startKey: 'start', targetKey: 'due' },
		);
		expect(roadmap.shelf).toEqual([]);
		expect(roadmap.bars[0].span.target).toEqual({ year: 2026, month: 12, day: 1 });
	});

	it('never infers a milestone’s date from anything', () => {
		// Nothing about a deadline is inferred, swapped or written by rendering it. A
		// milestone with no target shelves as unplaced even with dated work below it.
		const roadmap = buildRoadmapFrom(
			[
				note('Ship 1.0', { type: 'Milestone' }),
				note('Prep', { type: 'PBI', parent: 'Ship 1.0', due: '2026-09-01' }),
			],
			{ targetKey: 'due' },
		);
		expect(roadmap.bars.map((b) => b.item.title)).not.toContain('Ship 1.0');
		expect(roadmap.shelf.find((s) => s.item.title === 'Ship 1.0')?.reason).toBeNull();
	});

	it('draws as a point when its start is unreadable and its target is not', () => {
		// The discriminating case for the reduction: `placeMarker` never reads
		// `plannedStart` at all, so an unreadable one is silently ignored exactly like a
		// stale one is. Without the reduction, `deriveBars` would run the ordinary span
		// rule that checks `start.invalid` FIRST (ahead of the target) and shelve this as
		// 'Unreadable start date' — unlike the 'unreadable target' case below, which
		// shelves under either implementation and so proves nothing about which one runs.
		const roadmap = buildRoadmapFrom(
			[note('Ship 1.0', { type: 'Milestone', start: 'whenever', due: '2026-12-01' })],
			{ startKey: 'start', targetKey: 'due' },
		);
		expect(roadmap.shelf).toEqual([]);
		expect(roadmap.bars).toHaveLength(1);
		expect(roadmap.bars[0].span).toEqual({
			start: { year: 2026, month: 12, day: 1 },
			target: { year: 2026, month: 12, day: 1 },
		});
	});

	it('shelves an unreadable target with the reason on its card', () => {
		// A guessed date on a deadline is indistinguishable from a commitment nobody made.
		const roadmap = buildRoadmapFrom([note('Ship 1.0', { type: 'Milestone', due: 'soon' })], { targetKey: 'due' });
		expect(roadmap.shelf[0].reason).toBe('Unreadable target date');
	});

	it('is an ordinary result on the bucket axis, and its date is never read as a horizon', () => {
		const roadmap = buildRoadmapFrom(
			[note('Ship 1.0', { type: 'Milestone', due: '2026-12-01' })],
			{ horizonKey: 'horizon', horizonValues: ['Now', 'Next'], targetKey: 'due' },
			'horizons',
		);
		expect(roadmap.shelf.map((s) => s.item.title)).toEqual(['Ship 1.0']);
		expect(roadmap.buckets.every((b) => b.count === 0)).toBe(true);
	});
});
