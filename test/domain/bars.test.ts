import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { buildModel } from '../../src/domain/model';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { FakeViewConfig } from '../helpers/vault';
import { barHolds, deriveBars, placeItem, Placement, statedEnds, timelineRows, withoutEnds } from '../../src/domain/bars';
import { drawsAsPoint, placementEnds } from '../../src/domain/itemTypes';

/**
 * `placeItem` answers null for an item the axis cannot place AT ALL — a type that draws
 * no bar. Every case below is about bar-versus-shelf, so null is a broken fixture rather
 * than an outcome, and saying so once here is what lets each case narrow on `kind`.
 */
function place(...args: Parameters<typeof placeItem>): Placement {
	const placement = placeItem(...args);
	if (placement === null) throw new Error('placeItem answered null; the fixture is not placeable');
	return placement;
}

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.target' };

function model(vault: FakeVault, values: Record<string, unknown> = DATE_AXIS) {
	const settings = resolveSettings(new FakeViewConfig(values));
	return { model: buildModel(vault.app, vault.entries(), settings), settings };
}

function itemFor(vault: FakeVault, path: string, values: Record<string, unknown> = DATE_AXIS) {
	const built = model(vault, values);
	const item = built.model.byPath.get(path);
	if (!item) throw new Error(`no item at ${path}`);
	return { item, settings: built.settings };
}

describe('placeItem', () => {
	it('answers bar or shelf from the ends it is GIVEN, not from the note', () => {
		// The preview asks this with the ends a removal would leave, and `deriveBars`
		// asks it with the ends the note states. One function, so the indicator before
		// a drop and the placement after it cannot disagree — the register's own
		// "the checkmark is asked of the plan" rule, reaching a third surface.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01', target: '2026-08-31' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-10', target: '2026-08-20' }, parentLink: 'Parent' });
		const { item } = itemFor(vault, 'Parent.md');

		expect(place(item, statedEnds(item), false).kind).toBe('bar');
		const left = place(item, withoutEnds(statedEnds(item), ['start', 'target']), false);
		expect(left.kind).toBe('bar');
		// Its own dates gone, the descendants still supply a span: it keeps a bar,
		// inferred, and the shelf preview would be a lie.
		if (left.kind !== 'bar') throw new Error('unreachable');
		expect(left.bar.inferredStart).toBe(true);
		expect(left.bar.span.start).toEqual({ year: 2026, month: 8, day: 10 });
	});

	it('shelves a parent whose whole subtree is dateless', () => {
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Parent' });
		const { item } = itemFor(vault, 'Parent.md');

		expect(place(item, withoutEnds(statedEnds(item), ['start']), false).kind).toBe('shelf');
	});

	it('shelves a marker whose target goes, however stale a start it keeps', () => {
		// A marker never reaches inferSpan at all: placeMarker ignores the start and
		// shelves on an absent target. A comparison written beside the placement rules
		// would predict a bar here, which is why the preview asks this function.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, start: '2026-07-01', target: '2026-09-30' } });
		const { item } = itemFor(vault, 'Ship.md');

		const left = place(item, withoutEnds(statedEnds(item), ['target']), false);
		expect(left.kind).toBe('shelf');
		if (left.kind !== 'shelf') throw new Error('unreachable');
		expect(left.reason).toBeNull();
	});

	it('shelves an unreadable or reversed pair with its reason, before any inference', () => {
		const vault = new FakeVault();
		vault.addFile('Broken.md', { frontmatter: { type: 'PBI', order: 10, start: 'soon', target: '2026-08-01' } });
		vault.addFile('Backwards.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-31', target: '2026-08-01' } });

		expect(place(itemFor(vault, 'Broken.md').item, statedEnds(itemFor(vault, 'Broken.md').item), false)).toEqual({
			kind: 'shelf',
			reason: 'Unreadable start date',
		});
		const backwards = itemFor(vault, 'Backwards.md').item;
		expect(place(backwards, statedEnds(backwards), false)).toEqual({
			kind: 'shelf',
			reason: 'Target date precedes the start date',
		});
	});
});

describe('timelineRows', () => {
	/** The bars of a whole vault, in row order, with the named paths shut. */
	function rowsOf(vault: FakeVault, collapsed: string[] = []) {
		const built = model(vault);
		const bars = deriveBars([...built.model.results], false).bars;
		return timelineRows(bars, (path) => collapsed.includes(path));
	}

	function nested(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', target: '2026-12-01' } });
		vault.addFile('Feature.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-08-05', target: '2026-09-01' },
			parentLink: 'Epic',
		});
		vault.addFile('PBI.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-06', target: '2026-08-20' },
			parentLink: 'Feature',
		});
		return vault;
	}

	it('marks the rows that have a bar below them and leaves the rest leaves', () => {
		const rows = rowsOf(nested());

		expect(rows.map((row) => [row.bar.item.title, row.hasChildren])).toEqual([
			['Epic', true],
			['Feature', true],
			['PBI', false],
		]);
	});

	it('hides a collapsed row’s WHOLE subtree, not only its children', () => {
		const rows = rowsOf(nested(), ['Epic.md']);

		expect(rows.map((row) => row.bar.item.title)).toEqual(['Epic']);
		// The grandchild goes with the child: hiding is by ancestry, so a level with no
		// bar of its own between them cannot let one back through.
		expect(rows[0].collapsed).toBe(true);
	});

	it('keeps the chevron on the row that is collapsed', () => {
		// Asked of the bars derived BEFORE any were hidden. Computed from what is left,
		// a collapsed row would have no children to have and its own chevron would
		// vanish the moment it was used — nothing left to open it with.
		const rows = rowsOf(nested(), ['Feature.md']);

		expect(rows.map((row) => [row.bar.item.title, row.hasChildren, row.collapsed])).toEqual([
			['Epic', true, false],
			['Feature', true, true],
		]);
	});

	it('reaches through a parent the grid did not draw', () => {
		// The Feature states no dates and none of its children's evidence reaches it
		// (its own child is a marker, which is never evidence), so it shelves — and the
		// Epic above it still owns the milestone row below it.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', target: '2026-12-01' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 10, target: '2026-09-30' },
			parentLink: 'Feature',
		});

		expect(rowsOf(vault).map((row) => [row.bar.item.title, row.hasChildren])).toEqual([
			['Epic', true],
			['Ship', false],
		]);
		expect(rowsOf(vault, ['Epic.md']).map((row) => row.bar.item.title)).toEqual(['Epic']);
	});
});

describe('barHolds', () => {
	function holdsFor(frontmatter: Record<string, unknown>, values = DATE_AXIS) {
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { order: 10, ...frontmatter } });
		const { item, settings } = itemFor(vault, 'Item.md', values);
		const placement = place(item, statedEnds(item), false);
		if (placement.kind !== 'bar') throw new Error('expected a bar');
		return barHolds(item, settings, placement.bar);
	}

	it('offers body and both grips on a stated pair', () => {
		expect(holdsFor({ type: 'PBI', start: '2026-08-01', target: '2026-08-10' }).sort()).toEqual([
			'body',
			'end',
			'start',
		]);
	});

	it('offers the grip on an OPEN end — that grip is how the missing date gets written', () => {
		expect(holdsFor({ type: 'PBI', start: '2026-08-01' }).sort()).toEqual(['body', 'end', 'start']);
	});

	it('withholds every grip on an unconfigured key', () => {
		expect(holdsFor({ type: 'PBI', start: '2026-08-01' }, { startProperty: 'note.start', targetProperty: '' }).sort()).toEqual(
			['start', 'body'].sort(),
		);
	});

	it('gives a marker the body alone: a point has no duration to resize', () => {
		expect(holdsFor({ type: 'Milestone', target: '2026-09-30' })).toEqual(['body']);
	});

	it('withholds a marker’s hold entirely where its target key is unconfigured', () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, target: '2026-09-30' } });
		const { item, settings } = itemFor(vault, 'Ship.md', { startProperty: 'note.start', targetProperty: '' });
		// With no target property there is no bar either, so the shelf card is what a
		// gesture would have to grip — and it offers nothing. Asserted through the
		// placement so the two answers cannot disagree.
		expect(place(item, statedEnds(item), false).kind).toBe('shelf');
		expect(barHolds(item, settings, { item, span: { start: null, target: null }, inferredStart: false, inferredEnd: false })).toEqual([]);
	});

	it('withholds every grip when the note states NEITHER end, even where a child’s date fills the bar', () => {
		// The bug this guards: a start that is simply ABSENT (no evidence from children
		// either) reads `inferredStart: false`, the same as a genuinely stated start —
		// the flag alone cannot tell "open" from "nothing to hold". Only the note's own
		// stated ends (`statedEnds`) may ground a grip; a bar drawn entirely from a
		// child's evidence has no baseline anywhere on the note to drag from.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-09-01' }, parentLink: 'Parent' });
		const { item, settings } = itemFor(vault, 'Parent.md');
		const placement = place(item, statedEnds(item), false);
		if (placement.kind !== 'bar') throw new Error('expected a bar');

		expect(placement.bar.inferredStart).toBe(false);
		expect(placement.bar.span.start).toBeNull();
		expect(barHolds(item, settings, placement.bar)).toEqual([]);
	});

	it('an inferred END withholds the body hold too, not only its own grip', () => {
		// Extension 1c: sliding a bar half-anchored to its children is a resize wearing
		// a slide's cursor. Watch this one fail with `holds.push('body')` unguarded.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-08-20' }, parentLink: 'Parent' });
		const { item, settings } = itemFor(vault, 'Parent.md');
		const placement = place(item, statedEnds(item), false);
		if (placement.kind !== 'bar') throw new Error('expected a bar');

		expect(placement.bar.inferredEnd).toBe(true);
		expect(barHolds(item, settings, placement.bar)).toEqual(['start']);
	});
});

describe('a release is on neither axis', () => {
	function releaseVault(): FakeVault {
		const vault = new FakeVault();
		// Carrying the BACKLOG's own start and target: the whole point is that a release
		// stating both still draws nothing, because these keys are the wrong mapping to
		// read and a far worse one to write. [[A release on the dated axis]] is deferred.
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10, start: '2026-09-01', target: '2026-09-30' } });
		return vault;
	}

	it('is refused by `placeItem` itself, the site both grid axes reach', () => {
		// `placeItem` is asked directly because it is the ONE site both axes reach:
		// `deriveBars` for the dated one, and `placeBar` in `roadmap.ts` for the resources
		// one, which `deriveLanes` routes through without ever calling `deriveBars`. A guard
		// proved only through `deriveBars` proves nothing about resource lanes or the shelf.
		const { item } = itemFor(releaseVault(), '1.0.md');
		expect(placeItem(item, statedEnds(item), false)).toBeNull();
		expect(placeItem(item, statedEnds(item), true)).toBeNull();
	});

	it('places no bar and shelves no card on the dated axis', () => {
		// Neither half is enough alone: the shelf is a counted, drop-targetable band, so a
		// release sitting there is still a release the roadmap is showing.
		const { item, settings } = itemFor(releaseVault(), '1.0.md');
		const axis = deriveBars([item], settings.iterationBars);
		expect(axis.bars).toEqual([]);
		expect(axis.shelf).toEqual([]);
		expect(axis.context).toEqual([]);
	});
});

describe('drawsAsPoint', () => {
	it('splits the drawing question off the structural one', () => {
		// A milestone IS a point; an iteration is one exactly while the option is off.
		expect(drawsAsPoint('Milestone', false)).toBe(true);
		expect(drawsAsPoint('Milestone', true)).toBe(true);
		expect(drawsAsPoint('Iteration', false)).toBe(true);
		expect(drawsAsPoint('Iteration', true)).toBe(false);
		expect(drawsAsPoint('PBI', false)).toBe(false);
		expect(drawsAsPoint(null, false)).toBe(false);
	});

	it('narrows placementEnds: a point admits its target alone', () => {
		expect(placementEnds('Iteration', false)).toEqual(['target']);
		expect(placementEnds('Iteration', true)).toEqual(['start', 'target']);
		expect(placementEnds('Milestone', true)).toEqual(['target']);
	});
});

describe('an iteration on the dated axis', () => {
	function sprintVault(fm: Record<string, unknown>): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10, ...fm } });
		return vault;
	}

	it('is a point at its target while the option is off, its start ignored', () => {
		const { item } = itemFor(sprintVault({ start: '2026-09-07', target: '2026-09-20' }), 'Sprint 12.md');
		const placed = place(item, statedEnds(item), false);
		if (placed.kind !== 'bar') throw new Error('expected a bar');
		expect(placed.bar.span).toEqual({ start: placed.bar.span.target, target: placed.bar.span.target });
	});

	it('is a start→target span while the option is on', () => {
		const { item } = itemFor(sprintVault({ start: '2026-09-07', target: '2026-09-20' }), 'Sprint 12.md');
		const placed = place(item, statedEnds(item), true);
		if (placed.kind !== 'bar') throw new Error('expected a bar');
		expect(placed.bar.span.start).toEqual({ year: 2026, month: 9, day: 7 });
		expect(placed.bar.span.target).toEqual({ year: 2026, month: 9, day: 20 });
	});

	it('shelves with no target in line mode, places open-ended on a start in bar mode', () => {
		const { item } = itemFor(sprintVault({ start: '2026-09-07' }), 'Sprint 12.md');
		expect(place(item, statedEnds(item), false).kind).toBe('shelf');
		const barMode = place(item, statedEnds(item), true);
		expect(barMode.kind).toBe('bar');
	});

	it('shelves a reversed span in bar mode with the ordinary reason', () => {
		const { item } = itemFor(sprintVault({ start: '2026-09-20', target: '2026-09-07' }), 'Sprint 12.md');
		const placed = place(item, statedEnds(item), true);
		if (placed.kind !== 'shelf') throw new Error('expected the shelf');
		expect(placed.reason).toBe('Target date precedes the start date');
	});

	it('holds: body-only as a point, grips per configured key as a bar', () => {
		const { item, settings } = itemFor(sprintVault({ start: '2026-09-07', target: '2026-09-20' }), 'Sprint 12.md');
		const point = place(item, statedEnds(item), false);
		if (point.kind !== 'bar') throw new Error('unreachable');
		expect(barHolds(item, settings, point.bar)).toEqual(['body']);
		const span = place(item, { ...statedEnds(item) }, true);
		if (span.kind !== 'bar') throw new Error('unreachable');
		const on = { ...settings, iterationBars: true };
		expect(barHolds(item, on, span.bar)).toEqual(['start', 'end', 'body']);
		// The configuration still decides writable: no start property, no start grip —
		// `startKey` is the settings field `optionalKeyFor(settings, 'start')` reads.
		const noStart = { ...on, startKey: '' };
		expect(barHolds(item, noStart, span.bar)).not.toContain('start');
	});
});
