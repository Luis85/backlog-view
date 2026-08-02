import { describe, expect, it } from 'vitest';
import { buildModel, BacklogModel } from '../../src/domain/model';
import { activeAxis, bucketLabelFor, buildRoadmap, configuredAxes, RoadmapAxis, SHELF_LABEL } from '../../src/domain/roadmap';
import { computeHorizonDropWrites } from '../../src/domain/writePlan';
import { BacklogSettings, defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

/** A view with both axes configured, the way `resolveSettings` would hand it over. */
function axisSettings(overrides: Partial<BacklogSettings> = {}): BacklogSettings {
	return { ...defaultSettings(), horizonKey: 'horizon', startKey: 'start', targetKey: 'due', ...overrides };
}

function roadmapOf(model: BacklogModel, settings: BacklogSettings, axis: RoadmapAxis) {
	return buildRoadmap(model, settings, () => true, axis);
}

function titles(items: { title: string }[]): string[] {
	return items.map((i) => i.title);
}

describe('the configured axes', () => {
	it('declares nothing by default, and each axis only once configured', () => {
		expect(configuredAxes(defaultSettings())).toEqual([]);
		expect(configuredAxes(axisSettings({ startKey: '', targetKey: '' }))).toEqual(['horizons']);
		expect(configuredAxes(axisSettings({ horizonKey: '' }))).toEqual(['dates']);
		expect(configuredAxes(axisSettings())).toEqual(['horizons', 'dates']);
	});

	it('one date property is enough — a milestone-only roadmap is coherent', () => {
		expect(configuredAxes(axisSettings({ horizonKey: '', startKey: '' }))).toEqual(['dates']);
		expect(configuredAxes(axisSettings({ horizonKey: '', targetKey: '' }))).toEqual(['dates']);
	});

	it('a horizon property with a cleared values list is a board without stages', () => {
		expect(configuredAxes(axisSettings({ horizonValues: [], startKey: '', targetKey: '' }))).toEqual([]);
	});

	it('renders horizons until the user picks — the axis that cannot over-promise', () => {
		expect(activeAxis(axisSettings(), null)).toBe('horizons');
	});

	it('honors the pick while its axis is configured', () => {
		expect(activeAxis(axisSettings(), 'dates')).toBe('dates');
		expect(activeAxis(axisSettings(), 'horizons')).toBe('horizons');
	});

	it('a configured axis always beats guidance when the picked one is unconfigured', () => {
		// The pick is retained by the caller; only the render falls back.
		expect(activeAxis(axisSettings({ horizonKey: '' }), 'horizons')).toBe('dates');
		expect(activeAxis(axisSettings({ startKey: '', targetKey: '' }), 'dates')).toBe('horizons');
		expect(activeAxis(defaultSettings(), 'dates')).toBeNull();
	});
});

describe('the horizon axis', () => {
	function horizonVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Next' } });
		vault.addFile('Cased.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'now' } });
		vault.addFile('Stray.md', { frontmatter: { type: 'Epic', order: 30, horizon: 'Someday' } });
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 40 } });
		return vault;
	}

	it('renders every declared bucket in declared order, empty or not', () => {
		const settings = axisSettings();
		const vault = horizonVault();
		const roadmap = roadmapOf(buildModel(vault.app, vault.entries(), settings), settings, 'horizons');

		// Later is empty and still there; the stray value appends after the declared.
		expect(roadmap.buckets.map((b) => b.value)).toEqual(['Now', 'Next', 'Later', 'Someday']);
		expect(roadmap.buckets.map((b) => b.declared)).toEqual([true, true, true, false]);
	});

	it('places by the note’s own value, matching case-insensitively like the board', () => {
		const settings = axisSettings();
		const vault = horizonVault();
		const roadmap = roadmapOf(buildModel(vault.app, vault.entries(), settings), settings, 'horizons');

		const byValue = new Map(roadmap.buckets.map((b) => [b.value, b]));
		expect(titles(byValue.get('Now')?.cards ?? [])).toEqual(['Cased']);
		expect(titles(byValue.get('Next')?.cards ?? [])).toEqual(['Placed']);
		expect(titles(byValue.get('Someday')?.cards ?? [])).toEqual(['Stray']);
	});

	it('shelves what the axis cannot place: absence silently, refusal with the reason', () => {
		const settings = axisSettings();
		const vault = horizonVault();
		// An object is a value no single placement can be read from.
		vault.addFile('Broken.md', { frontmatter: { type: 'Epic', order: 50, horizon: { nested: true } } });
		const roadmap = roadmapOf(buildModel(vault.app, vault.entries(), settings), settings, 'horizons');

		expect(roadmap.shelf.map((s) => [s.item.title, s.reason])).toEqual([
			['Untriaged', null],
			['Broken', 'Unreadable horizon value'],
		]);
		// Placed plus shelved equals the row set — no result is ever silently omitted.
		expect(roadmap.placedCount + roadmap.shelf.length).toBe(5);
	});

	it('never reads a date as a horizon — dated-but-unbucketed results shelve', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		vault.addFile('Dated.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-09-01' } });
		const roadmap = roadmapOf(buildModel(vault.app, vault.entries(), settings), settings, 'horizons');

		expect(roadmap.buckets.every((b) => b.cards.length === 0)).toBe(true);
		expect(titles(roadmap.shelf.map((s) => s.item))).toEqual(['Dated']);
	});

	it('ranks cards inside a bucket by the Base’s own sort, never a stored rank', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		// Arrival order is the Bases sort; both land in Now.
		vault.addFile('B.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Now' } });
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const roadmap = roadmapOf(buildModel(vault.app, vault.entries(), settings), settings, 'horizons');

		expect(titles(roadmap.buckets[0].cards)).toEqual(['B', 'A']);
	});
});

describe('the dated axis', () => {
	it('places by what the note states: spans, single dates, milestones', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		vault.addFile('Span.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', due: '2026-09-15' } });
		vault.addFile('Start only.md', { frontmatter: { type: 'Epic', order: 20, start: '2026-08-05' } });
		vault.addFile('Target only.md', { frontmatter: { type: 'Epic', order: 30, due: '2026-10-01' } });
		const roadmap = roadmapOf(buildModel(vault.app, vault.entries(), settings), settings, 'dates');

		expect(titles(roadmap.bars.map((b) => b.item))).toEqual(['Span', 'Start only', 'Target only']);
		expect(roadmap.bars[1].span).toEqual({ start: { year: 2026, month: 8, day: 5 }, target: null });
		expect(roadmap.shelf).toEqual([]);
	});

	it('shelves the unreadable and the reversed with reasons, never guessing or swapping', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 10, start: 'next tuesday' } });
		vault.addFile('Reversed.md', { frontmatter: { type: 'Epic', order: 20, start: '2026-09-01', due: '2026-08-01' } });
		vault.addFile('Bad target.md', { frontmatter: { type: 'Epic', order: 30, start: '2026-08-01', due: 42 } });
		vault.addFile('Dateless.md', { frontmatter: { type: 'Epic', order: 40 } });
		const roadmap = roadmapOf(buildModel(vault.app, vault.entries(), settings), settings, 'dates');

		expect(roadmap.bars).toEqual([]);
		expect(roadmap.shelf.map((s) => [s.item.title, s.reason])).toEqual([
			['Garbled', 'Unreadable start date'],
			['Reversed', 'Target date precedes the start date'],
			['Bad target', 'Unreadable target date'],
			['Dateless', null],
		]);
	});

	it('keeps the shelf in sibling order — the order property’s rank, not arrival order', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		// Arrival order disagrees with sibling rank on purpose.
		vault.addFile('Second.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('First.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Child.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'First' });
		const roadmap = roadmapOf(buildModel(vault.app, vault.entries(), settings), settings, 'dates');

		expect(titles(roadmap.shelf.map((s) => s.item))).toEqual(['First', 'Child', 'Second']);
	});

	it('narrows with the view’s own visibility rule, so the counts always agree', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		vault.addFile('Shown.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Hidden.md', { frontmatter: { type: 'Epic', order: 20 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const roadmap = buildRoadmap(model, settings, (item) => item.title !== 'Hidden', 'dates');

		expect(titles(roadmap.shelf.map((s) => s.item))).toEqual(['Shown']);
		expect(roadmap.placedCount).toBe(0);
	});
});

describe('context rows on the roadmap', () => {
	/** The Base returns only the features; their epic is context at the focus level. */
	function focusedModel(epicFm: Record<string, unknown>, settings: BacklogSettings): BacklogModel {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, ...epicFm } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, horizon: 'Now' }, parentLink: 'Epic' });
		const entries = vault.entries().filter((e) => e.file.path !== 'Epic.md');
		return buildModel(vault.app, entries, { ...settings, focusLevel: 'Epic' });
	}

	it('an excluded focus-level item sits in a bucket that already exists, uncounted', () => {
		const settings = axisSettings();
		const roadmap = roadmapOf(focusedModel({ horizon: 'now' }, settings), settings, 'horizons');

		const now = roadmap.buckets[0];
		expect(titles(now.cards)).toEqual(['Epic']);
		// Placement, not population: the count is results-only, and the row set here
		// holds no results at all — everything below focus surfaces through rollups.
		expect(now.count).toBe(0);
		expect(roadmap.shelf).toEqual([]);
		expect(roadmap.context).toEqual([]);
	});

	it('a context value never mints a bucket — the row stands beside the shelf instead', () => {
		const settings = axisSettings();
		const roadmap = roadmapOf(focusedModel({ horizon: 'Someday' }, settings), settings, 'horizons');

		expect(roadmap.buckets.map((b) => b.value)).toEqual(['Now', 'Next', 'Later']);
		expect(titles(roadmap.context)).toEqual(['Epic']);
		// Never shelved, never counted there: the shelf is a statement about results.
		expect(roadmap.shelf).toEqual([]);
	});

	it("sorts where its first visible result would — the board's own rule", () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Now' } });
		const entries = vault.entries().filter((e) => e.file.path !== 'Epic A.md');
		const model = buildModel(vault.app, entries, { ...settings, focusLevel: 'Epic' });

		const roadmap = roadmapOf(model, settings, 'horizons');

		// Epic A is loaded after every result, so its raw entryIndex would sink it to
		// the bucket's end. It interleaves where F1 — the result it places — sorts,
		// so the same focused items cannot appear in a different order per projection.
		expect(titles(roadmap.buckets[0].cards)).toEqual(['Epic A', 'Epic B']);
	});

	it('is never placed by its own dates on the timeline', () => {
		const settings = axisSettings();
		const roadmap = roadmapOf(
			focusedModel({ start: '2026-08-01', due: '2026-09-01' }, settings),
			settings,
			'dates',
		);

		// Its span, once spans roll up, is what its visible results give it — never
		// its own dates. Until then it stands beside the shelf as context.
		expect(roadmap.bars).toEqual([]);
		expect(titles(roadmap.context)).toEqual(['Epic']);
		expect(roadmap.shelf).toEqual([]);
	});
});

describe('the label a placement is named by', () => {
	function roadmapWith(...values: (string | null)[]) {
		const settings = axisSettings();
		const vault = new FakeVault();
		values.forEach((value, i) => {
			vault.addFile(`${i}.md`, {
				frontmatter: { type: 'Epic', order: (i + 1) * 10, ...(value !== null ? { horizon: value } : {}) },
			});
		});
		return roadmapOf(buildModel(vault.app, vault.entries(), settings), settings, 'horizons');
	}

	it('names the bucket a value renders under, in the bucket’s own casing', () => {
		const roadmap = roadmapWith('now', 'Someday');

		// Matched the way the cards were placed, and named the way the screen shows —
		// the declared casing for a declared bucket, the minted one for a stray.
		expect(bucketLabelFor(roadmap, 'NOW')).toBe('Now');
		expect(bucketLabelFor(roadmap, 'someday')).toBe('Someday');
	});

	it('names the shelf for absence, and for a value no bucket shows', () => {
		const roadmap = roadmapWith(null);

		expect(bucketLabelFor(roadmap, null)).toBe(SHELF_LABEL);
		// A result the axis did not place is on the shelf — the only other place there
		// is — so a message about it says the shelf rather than a bucket nobody sees.
		expect(bucketLabelFor(roadmap, 'Gone')).toBe(SHELF_LABEL);
	});
});

describe('computeHorizonDropWrites', () => {
	function item(horizon: unknown) {
		const vault = new FakeVault();
		vault.addFile('A.md', {
			frontmatter: { type: 'Epic', order: 10, ...(horizon !== undefined ? { horizon } : {}) },
		});
		return buildModel(vault.app, vault.entries(), axisSettings()).results[0];
	}

	it('writes the target bucket’s value, untransformed', () => {
		const card = item('Now');
		expect(computeHorizonDropWrites(card, 'Later')).toEqual([{ file: card.file, horizon: 'Later' }]);
	});

	it('plans nothing for a drop on the card’s own bucket, case-insensitively', () => {
		expect(computeHorizonDropWrites(item('later'), 'Later')).toEqual([]);
	});

	it('removes the key for a drop on the shelf', () => {
		const writes = computeHorizonDropWrites(item('Now'), null);
		expect(writes).toHaveLength(1);
		expect(writes[0].removeHorizonKey).toBe(true);
		expect(writes[0].horizon).toBeUndefined();
	});

	it('plans nothing for an unplaced card dropped on the shelf', () => {
		expect(computeHorizonDropWrites(item(undefined), null)).toEqual([]);
		// An empty value is absence to the reader, so there is nothing to un-place:
		// rewriting the note would change it without changing what the roadmap says.
		expect(computeHorizonDropWrites(item(''), null)).toEqual([]);
	});

	it('un-places a value the reader refuses — shelved is not the same as unset', () => {
		const card = item({ when: 'soon' });
		expect(card.horizon).toEqual({ value: null, invalid: true });
		expect(computeHorizonDropWrites(card, null)).toEqual([{ file: card.file, removeHorizonKey: true }]);
		// And it takes a value like anything else: the reading was refused, not the note.
		expect(computeHorizonDropWrites(card, 'Now')).toEqual([{ file: card.file, horizon: 'Now' }]);
	});
});
