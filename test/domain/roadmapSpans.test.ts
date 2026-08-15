import { describe, expect, it } from 'vitest';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { buildModel, BacklogModel } from '../../src/domain/model';
import { buildRoadmap, RoadmapAxis } from '../../src/domain/roadmap';
import { FakeVault } from '../helpers/vault';

/**
 * A dateless parent spans its children — split out of `roadmap.test.ts` when that file
 * hit its `test/**` line budget (`## Testing` in the root `CLAUDE.md`), one subject
 * fully self-contained: [[Spans roll up the tree]]'s inference rules, asked of nothing
 * but dates and the tree shape.
 */

/** A view with both axes configured, the way `resolveSettings` would hand it over. */
function axisSettings(overrides: Partial<BacklogSettings> = {}): BacklogSettings {
	return settingsWith({ horizonKey: 'horizon', startKey: 'start', targetKey: 'due', ...overrides });
}

function roadmapOf(model: BacklogModel, settings: BacklogSettings, axis: RoadmapAxis) {
	return buildRoadmap(model, settings, () => true, axis);
}

describe('a dateless parent spans its children', () => {
	const march = { year: 2026, month: 3, day: 1 };
	const june = { year: 2026, month: 6, day: 1 };

	function bars(model: BacklogModel) {
		return roadmapOf(model, axisSettings(), 'dates').bars;
	}

	function tree(files: [string, Record<string, unknown>, string?][]): BacklogModel {
		const vault = new FakeVault();
		for (const [name, fm, parent] of files) {
			vault.addFile(`${name}.md`, { frontmatter: fm, ...(parent ? { parentLink: parent } : {}) });
		}
		return buildModel(vault.app, vault.entries(), axisSettings());
	}

	it('infers both ends from the subtree and marks both inferred', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10 }],
			['A', { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-04-01' }, 'Epic'],
			['B', { type: 'Feature', order: 20, start: '2026-04-01', due: '2026-06-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		expect(epic?.span).toEqual({ start: march, target: june });
		expect(epic?.inferredStart).toBe(true);
		expect(epic?.inferredEnd).toBe(true);
	});

	it('a stated end always wins, and the disagreement renders rather than resolves', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10, start: '2026-04-01' }],
			['A', { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-06-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		// The stated start stands even though the child begins a month earlier.
		expect(epic?.span.start).toEqual({ year: 2026, month: 4, day: 1 });
		expect(epic?.inferredStart).toBe(false);
		// The empty end fills from below and carries the inferred styling alone.
		expect(epic?.span.target).toEqual(june);
		expect(epic?.inferredEnd).toBe(true);
	});

	it('an inference may extend a statement and never contradict it', () => {
		// Child's target precedes the parent's stated start: filling the parent's
		// empty target from it would draw a reversed bar. The end stays open instead.
		const model = tree([
			['Epic', { type: 'Epic', order: 10, start: '2026-06-01' }],
			['A', { type: 'Feature', order: 10, due: '2026-03-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		expect(epic?.span).toEqual({ start: june, target: null });
		expect(epic?.inferredEnd).toBe(false);
	});

	it('an inference may extend a statement and never contradict it — the other side', () => {
		// Parent's target precedes the child's stated start: filling the parent's
		// empty start from it would draw a reversed bar. The end stays open instead.
		const model = tree([
			['Epic', { type: 'Epic', order: 10, due: '2026-03-01' }],
			['A', { type: 'Feature', order: 10, start: '2026-06-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		expect(epic?.span).toEqual({ start: null, target: march });
		expect(epic?.inferredStart).toBe(false);
	});

	it('an end with no evidence of its own kind stays open', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10 }],
			['A', { type: 'Feature', order: 10, due: '2026-06-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		expect(epic?.span).toEqual({ start: null, target: june });
		expect(epic?.inferredStart).toBe(false);
		expect(epic?.inferredEnd).toBe(true);
	});

	it('crossed evidence covers both known dates with both ends inferred, never reversed', () => {
		// One child states only a start, a later one only an earlier target.
		const model = tree([
			['Epic', { type: 'Epic', order: 10 }],
			['A', { type: 'Feature', order: 10, start: '2026-06-01' }, 'Epic'],
			['B', { type: 'Feature', order: 20, due: '2026-03-01' }, 'Epic'],
		]);

		const epic = bars(model).find((b) => b.item.title === 'Epic');
		// The bar covers what is known, never reversed, and claims neither end.
		expect(epic?.span).toEqual({ start: march, target: june });
		expect(epic?.inferredStart).toBe(true);
		expect(epic?.inferredEnd).toBe(true);
	});

	it('a parent whose own pair is reversed shelves — no inference stands in for a typo', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10, start: '2026-06-01', due: '2026-03-01' }],
			['A', { type: 'Feature', order: 10, start: '2026-04-01', due: '2026-05-01' }, 'Epic'],
		]);

		const roadmap = roadmapOf(model, axisSettings(), 'dates');
		expect(roadmap.shelf.map((s) => [s.item.title, s.reason])).toContainEqual([
			'Epic',
			'Target date precedes the start date',
		]);
	});

	it('a reversed CHILD cannot draw its parent either — the typo is surfaced, not inherited', () => {
		// The child shelves for its reversed pair. Its parent has no dates of its own
		// and no other dated descendant, so it must shelve too — not display a
		// plausible span the crossed-evidence branch swapped out of one broken note.
		const model = tree([
			['Epic', { type: 'Epic', order: 10 }],
			['A', { type: 'Feature', order: 10, start: '2026-06-01', due: '2026-03-01' }, 'Epic'],
		]);

		const roadmap = roadmapOf(model, axisSettings(), 'dates');
		expect(roadmap.bars).toEqual([]);
		expect(roadmap.shelf.map((s) => [s.item.title, s.reason])).toEqual([
			['Epic', null],
			['A', 'Target date precedes the start date'],
		]);
	});

	it('a subtree with no dates at all still shelves', () => {
		const model = tree([
			['Epic', { type: 'Epic', order: 10 }],
			['A', { type: 'Feature', order: 10 }, 'Epic'],
		]);

		const roadmap = roadmapOf(model, axisSettings(), 'dates');
		expect(roadmap.bars).toEqual([]);
		expect(roadmap.shelf.map((s) => s.item.title)).toEqual(['Epic', 'A']);
	});

	it('a stated bar is never marked inferred', () => {
		const model = tree([['Solo', { type: 'PBI', order: 10, start: '2026-03-01', due: '2026-06-01' }]]);

		const solo = bars(model)[0];
		expect(solo.inferredStart).toBe(false);
		expect(solo.inferredEnd).toBe(false);
	});

	it('is derived every pass and written nowhere — a changed child moves the parent', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-04-01' },
			parentLink: 'Epic',
		});

		const first = buildModel(vault.app, vault.entries(), axisSettings());
		expect(roadmapOf(first, axisSettings(), 'dates').bars[0].span.target).toEqual({
			year: 2026,
			month: 4,
			day: 1,
		});

		// The child's plan slips. Nothing re-plans the epic — it is recomputed.
		vault.setFrontmatter('A.md', { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-09-01' });
		const second = buildModel(vault.app, vault.entries(), axisSettings());
		expect(roadmapOf(second, axisSettings(), 'dates').bars[0].span.target).toEqual({
			year: 2026,
			month: 9,
			day: 1,
		});

		// "Written nowhere" is guaranteed structurally, not by an assertion here:
		// `src/domain/` is barred from importing `src/storage/` (eslint
		// no-restricted-imports), so nothing in this module can reach a write path.
	});
});
