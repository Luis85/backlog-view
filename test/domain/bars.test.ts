import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { buildModel } from '../../src/domain/model';
import { resolveSettings } from '../../src/domain/settings';
import { FakeViewConfig } from '../helpers/vault';
import { barHolds, deriveBars, placeItem, statedEnds, timelineRows, withoutEnds } from '../../src/domain/bars';

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

		expect(placeItem(item, statedEnds(item)).kind).toBe('bar');
		const left = placeItem(item, withoutEnds(statedEnds(item), ['start', 'target']));
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

		expect(placeItem(item, withoutEnds(statedEnds(item), ['start'])).kind).toBe('shelf');
	});

	it('shelves a marker whose target goes, however stale a start it keeps', () => {
		// A marker never reaches inferSpan at all: placeMarker ignores the start and
		// shelves on an absent target. A comparison written beside the placement rules
		// would predict a bar here, which is why the preview asks this function.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, start: '2026-07-01', target: '2026-09-30' } });
		const { item } = itemFor(vault, 'Ship.md');

		const left = placeItem(item, withoutEnds(statedEnds(item), ['target']));
		expect(left.kind).toBe('shelf');
		if (left.kind !== 'shelf') throw new Error('unreachable');
		expect(left.reason).toBeNull();
	});

	it('shelves an unreadable or reversed pair with its reason, before any inference', () => {
		const vault = new FakeVault();
		vault.addFile('Broken.md', { frontmatter: { type: 'PBI', order: 10, start: 'soon', target: '2026-08-01' } });
		vault.addFile('Backwards.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-31', target: '2026-08-01' } });

		expect(placeItem(itemFor(vault, 'Broken.md').item, statedEnds(itemFor(vault, 'Broken.md').item))).toEqual({
			kind: 'shelf',
			reason: 'Unreadable start date',
		});
		const backwards = itemFor(vault, 'Backwards.md').item;
		expect(placeItem(backwards, statedEnds(backwards))).toEqual({
			kind: 'shelf',
			reason: 'Target date precedes the start date',
		});
	});
});

describe('timelineRows', () => {
	/** The bars of a whole vault, in row order, with the named paths shut. */
	function rowsOf(vault: FakeVault, collapsed: string[] = []) {
		const built = model(vault);
		const bars = deriveBars([...built.model.results]).bars;
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
		const placement = placeItem(item, statedEnds(item));
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
		expect(placeItem(item, statedEnds(item)).kind).toBe('shelf');
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
		const placement = placeItem(item, statedEnds(item));
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
		const placement = placeItem(item, statedEnds(item));
		if (placement.kind !== 'bar') throw new Error('expected a bar');

		expect(placement.bar.inferredEnd).toBe(true);
		expect(barHolds(item, settings, placement.bar)).toEqual(['start']);
	});
});
