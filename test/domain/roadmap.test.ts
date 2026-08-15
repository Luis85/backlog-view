import { describe, expect, it } from 'vitest';
import { BacklogSettings, defaultSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { buildModel, BacklogModel } from '../../src/domain/model';
import {
	activeAxis,
	buildRoadmap,
	configuredAxes,
	drawsGrid,
	hasDateAxis,
	hasResourceAxis,
	placementLabel,
	RoadmapAxis,
	SHELF_LABEL,
	targetLabel,
} from '../../src/domain/roadmap';
import { readPlacement } from '../../src/domain/noteFields';
import { FakeVault } from '../helpers/vault';

/** A view with both axes configured, the way `resolveSettings` would hand it over. */
function axisSettings(overrides: Partial<BacklogSettings> = {}): BacklogSettings {
	return settingsWith({ horizonKey: 'horizon', startKey: 'start', targetKey: 'due', ...overrides });
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

	it('puts resources last — a further grouping on top of dates never leads', () => {
		const all = axisSettings({ assigneeKey: 'assignee' });
		expect(configuredAxes(all)).toEqual(['horizons', 'dates', 'resources']);
		// A vault that newly names an assignee property does not have its roadmap change
		// under it: the axis has to be picked, exactly as dates already has to be.
		expect(activeAxis(all, null)).toBe('horizons');
		expect(activeAxis(axisSettings({ assigneeKey: 'assignee', horizonKey: '' }), null)).toBe('dates');
	});

	it('cannot configure resources alone — it needs the date property the dated axis needs', () => {
		const configured = axisSettings({ assigneeKey: 'assignee' });
		expect(hasResourceAxis(configured)).toBe(true);
		expect(hasResourceAxis(axisSettings({ assigneeKey: 'assignee', startKey: '', targetKey: '' }))).toBe(false);
		expect(hasResourceAxis(axisSettings({ assigneeKey: '' }))).toBe(false);
		// Whatever configures this axis configures the dated one too, by construction —
		// there is no parallel pair of "resource dates" to name.
		expect(hasDateAxis(configured)).toBe(true);
	});

	it('falls back the same generic way when the resources axis loses its configuration', () => {
		expect(activeAxis(axisSettings({ assigneeKey: '' }), 'resources')).toBe('horizons');
		expect(activeAxis(axisSettings({ assigneeKey: 'assignee', horizonKey: '' }), 'resources')).toBe('resources');
	});

	it('names the axes that draw the dated grid', () => {
		expect(drawsGrid('dates')).toBe(true);
		expect(drawsGrid('resources')).toBe(true);
		expect(drawsGrid('horizons')).toBe(false);
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

	/** What a note said about its own horizon, as the announcer captures it. */
	function said(value: string | null, keyPresent = value !== null) {
		return { reading: readPlacement(value === null ? undefined : value), keyPresent };
	}

	it('names the bucket a value renders under, in the bucket’s own casing', () => {
		const roadmap = roadmapWith('now', 'Someday');

		// Matched the way the cards were placed, and named the way the screen shows —
		// the declared casing for a declared bucket, the minted one for a stray.
		expect(targetLabel(roadmap, 'NOW')).toBe('Now');
		expect(placementLabel(roadmap, said('someday'))).toBe('Someday');
	});

	it('names a target by the value picked, never by the shelf', () => {
		const roadmap = roadmapWith(null);

		expect(targetLabel(roadmap, null)).toBe(SHELF_LABEL);
		// Hiding can take away a value's only carrier while the menu goes on offering
		// it, so a pick can name a bucket the frame is not currently drawing. The write
		// still puts the note there, and saying "Unplaced" would report a different
		// move than the one that happened.
		expect(targetLabel(roadmap, 'Someday')).toBe('Someday');
	});

	it('tells the three ways a card can be unplaced apart', () => {
		const roadmap = roadmapWith(null);

		// Only the first is nothing to take away. The other two are real, undoable
		// cleanups — `computeHorizonWrites` clears on the KEY, not on the reading — so
		// naming them all "Unplaced" would report a change as a move that did not
		// happen, in exactly the words the move to the shelf already uses.
		expect(placementLabel(roadmap, said(null))).toBe(SHELF_LABEL);
		expect(placementLabel(roadmap, said('', true))).toBe('an empty horizon');
		expect(placementLabel(roadmap, { reading: { value: null, invalid: true }, keyPresent: true })).toBe(
			'an unreadable horizon',
		);
	});
});

describe('the writable horizon vocabulary', () => {
	function vocabularyOf(settings: BacklogSettings, exclude: string[] = []): BacklogModel {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Someday' } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, horizon: 'Now' }, parentLink: 'Epic' });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, horizon: 'now' }, parentLink: 'Epic' });
		vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, horizon: 'Q3' }, parentLink: 'Epic' });
		const entries = vault.entries().filter((e) => !exclude.includes(e.file.path));
		return buildModel(vault.app, entries, settings);
	}

	it('collects the values the results carry, in the order their buckets are minted', () => {
		// First-seen order, not alphabetical: the menu names the buckets in the order
		// the axis draws them. Deduped case-insensitively, first casing kept.
		expect(vocabularyOf(axisSettings()).observedHorizons).toEqual(['Someday', 'Now', 'Q3']);
	});

	it('reads them off the SORTED tree, so the menu cannot contradict the axis', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		// Arrival order and sibling rank disagree — a base sorted by name over notes
		// ranked by hand. The roadmap walks the ranks, so the vocabulary must too.
		vault.addFile('Second.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Eventually' } });
		vault.addFile('First.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Soon' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.observedHorizons).toEqual(['Soon', 'Eventually']);
		// The order the buckets are actually minted in, from the same walk.
		const minted = roadmapOf(model, settings, 'horizons').buckets.filter((b) => !b.declared);
		expect(minted.map((b) => b.value)).toEqual(['Soon', 'Eventually']);
	});

	it('takes nothing from a context row', () => {
		// The Epic is an excluded ancestor: its horizon is not this base's vocabulary,
		// exactly as its state is not, so it can never become assignable to a result.
		expect(vocabularyOf(axisSettings(), ['Epic.md']).observedHorizons).toEqual(['Now', 'Q3']);
	});

	it('reads nothing when no horizon property is configured', () => {
		expect(vocabularyOf(axisSettings({ horizonKey: '' })).observedHorizons).toEqual([]);
	});
});

// "a dateless parent spans its children" moved to `roadmapSpans.test.ts` when this
// file hit its `test/**` line budget — one subject, fully self-contained.

describe('a focused row and a below-focus descendant (probe)', () => {
	it('below-focus: an inferred span reaches a dated child the focus level hides', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		// The PBI is Feature's direct child — one rung below the focus level: never a
		// row of its own once focused, only evidence for its ancestor's inferred span.
		vault.addFile('PBI.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-03-01', due: '2026-06-01' },
			parentLink: 'Feature',
		});
		const model = buildModel(vault.app, vault.entries(), { ...settings, focusLevel: 'Feature' });

		const roadmap = roadmapOf(model, settings, 'dates');

		// The PBI never renders its own row while focus is on Feature.
		expect(titles(roadmap.bars.map((b) => b.item))).toEqual(['Feature']);
		const feature = roadmap.bars.find((b) => b.item.title === 'Feature');
		expect(feature?.span).toEqual({
			start: { year: 2026, month: 3, day: 1 },
			target: { year: 2026, month: 6, day: 1 },
		});
		expect(feature?.inferredStart).toBe(true);
		expect(feature?.inferredEnd).toBe(true);
	});
});

describe('which placement keys a note carries', () => {
	/** The three placement fields of the record; the rest belong to the state and the stamps. */
	function keysOf(frontmatter: Record<string, unknown>, settings = axisSettings()) {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, ...frontmatter } });
		const { horizon, start, target } = buildModel(vault.app, vault.entries(), settings).items[0].ownKeys;
		return { horizon, start, target };
	}

	it('reports presence, not value — an empty horizon is a key the note has', () => {
		// The two questions differ: the reading says untriaged, the key says there is
		// something to clear. Collapsing them would offer an action that writes nothing.
		expect(keysOf({ horizon: '' })).toEqual({ horizon: true, start: false, target: false });
		expect(keysOf({ horizon: 'Now', start: '2026-08-03', due: '2026-08-14' })).toEqual({
			horizon: true,
			start: true,
			target: true,
		});
		expect(keysOf({})).toEqual({ horizon: false, start: false, target: false });
	});

	it('reports an unconfigured field as absent — there is no key to carry', () => {
		expect(keysOf({ horizon: 'Now' }, axisSettings({ horizonKey: '' }))).toEqual({
			horizon: false,
			start: false,
			target: false,
		});
	});
});
