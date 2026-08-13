import { describe, expect, it } from 'vitest';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap } from '../../src/domain/roadmap';
import { resourceVault } from '../helpers/resources';
import { FakeVault } from '../helpers/vault';

/**
 * The resources axis: which row an item lands in, and what puts it there. Its own file
 * rather than a block in `roadmap.test.ts`, which is already the horizon axis's — the
 * subject here is a different projection over the same model.
 *
 * Every POSITION question is deliberately not asked twice: the axis reuses `placeItem`
 * unchanged, so what is checked here is the grouping and one test that the two axes agree
 * about a span. `bars.test.ts` owns the placement rules themselves.
 */

/** The resources axis needs an assignee property AND a date property — never one alone. */
function resourceSettings(overrides: Partial<BacklogSettings> = {}): BacklogSettings {
	return settingsWith({ assigneeKey: 'assignee', startKey: 'start', targetKey: 'due', ...overrides });
}

function laneOf(vault: FakeVault, settings: BacklogSettings) {
	return buildRoadmap(buildModel(vault.app, vault.entries(), settings), settings, () => true, 'resources');
}

function titles(bars: { item: { title: string } }[]): string[] {
	return bars.map((bar) => bar.item.title);
}


describe('the resources axis', () => {
	it('renders every declared resource in declared order, empty or not', () => {
		const settings = resourceSettings({ resourceNames: ['Alice', 'Bob'] });
		const roadmap = laneOf(resourceVault(), settings);

		// Bob is empty and still there; the undeclared assignee appends after both.
		expect(roadmap.lanes.map((lane) => lane.name)).toEqual(['Alice', 'Bob', 'Zoe']);
		expect(roadmap.lanes.map((lane) => lane.declared)).toEqual([true, true, false]);
	});

	it('groups by the note’s own assignee, case-insensitively, in tree order', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const roadmap = laneOf(resourceVault(), settings);

		expect(titles(roadmap.lanes[0].bars)).toEqual(['Alice dated', 'Cased']);
	});

	it('positions a bar exactly as the dated axis does — no second date reading', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const vault = resourceVault();
		const lanes = laneOf(vault, settings);
		const dated = buildRoadmap(buildModel(vault.app, vault.entries(), settings), settings, () => true, 'dates');

		const onLane = lanes.lanes[0].bars.find((bar) => bar.item.title === 'Alice dated');
		const onGrid = dated.bars.find((bar) => bar.item.title === 'Alice dated');
		expect(onLane?.span).toEqual(onGrid?.span);
	});

	it('shelves a result with no assignee whatever its dates say — a row is who, not when', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const roadmap = laneOf(resourceVault(), settings);

		const nobody = roadmap.shelf.find((card) => card.item.title === 'Nobody');
		expect(nobody).toBeDefined();
		expect(nobody?.reason).toBeNull();
	});

	it('shelves an assigned result with no date to place, and mints no row for it', () => {
		const settings = resourceSettings();
		const vault = new FakeVault();
		vault.addFile('Named only.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Bob' } });
		const roadmap = laneOf(vault, settings);

		// Naming a resource is not scheduling against them: a row with no date to
		// position a bar at has nothing to draw, so nothing is drawn.
		expect(roadmap.lanes).toEqual([]);
		expect(roadmap.shelf.map((card) => card.item.title)).toEqual(['Named only']);
	});

	it('keeps the dated axis’s own refusals and their reasons', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const vault = new FakeVault();
		vault.addFile('Bad.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: 'not a date' } });
		const roadmap = laneOf(vault, settings);

		expect(roadmap.shelf[0].reason).toBe('Unreadable start date');
		expect(roadmap.lanes[0].bars).toEqual([]);
	});

	it('draws a dateless parent’s inferred bar in its own resource’s row', () => {
		const settings = resourceSettings({ resourceNames: ['Alice', 'Bob'] });
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice' } });
		vault.addFile('Child.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Bob', start: '2026-08-01', due: '2026-08-10' },
			parentLink: 'Epic',
		});
		const roadmap = laneOf(vault, settings);

		// The rollup is `inferSpan`'s, unchanged — only the row it lands in is this
		// axis's doing, and a parent and its child routinely land in different ones.
		const alice = roadmap.lanes[0];
		expect(titles(alice.bars)).toEqual(['Epic']);
		expect(alice.bars[0].inferredStart).toBe(true);
		expect(titles(roadmap.lanes[1].bars)).toEqual(['Child']);
	});

	it('placed plus shelved equals the visible result rows', () => {
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const roadmap = laneOf(resourceVault(), settings);

		const placed = roadmap.lanes.reduce((sum, lane) => sum + lane.bars.length, 0);
		expect(roadmap.placedCount).toBe(placed);
		expect(placed + roadmap.shelf.length).toBe(5);
	});

	it('reports every drawn bar on `bars` too, in row order', () => {
		// Two readers ask `bars` "is this path a drawn bar rather than a card" — the card
		// menu's children section and the toolbar's collapse gate — so an axis that draws
		// bars must report them, or a lane's bar answers "card" to both.
		const settings = resourceSettings({ resourceNames: ['Alice'] });
		const roadmap = laneOf(resourceVault(), settings);

		expect(titles(roadmap.bars)).toEqual(['Alice dated', 'Cased', 'Stray']);
	});
});

describe('absences in the row list', () => {
	/** The shared vault, plus one absence written the way the prompt writes them. */
	function withAbsence(resource: string): FakeVault {
		const vault = resourceVault();
		vault.addFile('Away.md', {
			frontmatter: { type: 'Absence', assignee: resource, start: '2026-08-04', due: '2026-08-06' },
		});
		return vault;
	}

	function lanesWith(resource: string) {
		return laneOf(withAbsence(resource), resourceSettings({ resourceNames: ['Alice', 'Bob'] }));
	}

	it('draws in the row its own resource names, and nowhere else', () => {
		const roadmap = lanesWith('Alice');

		expect(roadmap.lanes.find((lane) => lane.name === 'Alice')?.absences.map((a) => a.title)).toEqual(['Away']);
		expect(roadmap.lanes.filter((lane) => lane.absences.length > 0)).toHaveLength(1);
	});

	it('mints a row for a resource nothing else names — a third source', () => {
		// 4b: an absence can be the first reason a row exists, extending the
		// declared-or-observed row list rather than needing something assigned first.
		const quinn = lanesWith('Quinn').lanes.find((lane) => lane.name === 'Quinn');

		expect(quinn).toBeDefined();
		expect(quinn?.declared).toBe(false);
		expect(quinn?.bars).toEqual([]);
		expect(quinn?.absences).toHaveLength(1);
	});

	it('joins the row a result already minted, matched as the bars are', () => {
		// Case-insensitively, the one matching rule this axis has.
		const roadmap = lanesWith('alice');

		expect(roadmap.lanes.filter((lane) => lane.name.toLowerCase() === 'alice')).toHaveLength(1);
		expect(roadmap.lanes.find((lane) => lane.name === 'Alice')?.absences).toHaveLength(1);
	});

	it('is never counted, and never changes what the shelf reports', () => {
		// The row's count is RESULT bars, exactly as a bucket's count is results. An
		// absence is neither a result nor a work item, so it moves no number here.
		const settings = resourceSettings({ resourceNames: ['Alice', 'Bob'] });
		const bare = laneOf(resourceVault(), settings);
		const withOne = lanesWith('Alice');

		expect(withOne.placedCount).toBe(bare.placedCount);
		expect(withOne.shelf.map((card) => card.item.title)).toEqual(bare.shelf.map((card) => card.item.title));
		expect(titles(withOne.bars)).toEqual(titles(bare.bars));
	});

	it('draws on the other two axes not at all', () => {
		// It reaches `deriveLanes` and nothing else: the horizon axis and the plain dated
		// axis read the model's own rows, which an absence was never among.
		const settings = resourceSettings({ horizonKey: 'horizon', horizonValues: ['Now', 'Next'] });
		const vault = withAbsence('Alice');
		const model = buildModel(vault.app, vault.entries(), settings);

		const dates = buildRoadmap(model, settings, () => true, 'dates');
		const horizons = buildRoadmap(model, settings, () => true, 'horizons');
		const named = [
			...titles(dates.bars),
			...dates.shelf.map((card) => card.item.title),
			...horizons.buckets.flatMap((bucket) => bucket.cards.map((card) => card.title)),
			...horizons.shelf.map((card) => card.item.title),
		];
		expect(named).not.toContain('Away');
	});
});

describe('a context row on the resources axis', () => {
	/**
	 * A vault whose Epic is loaded as CONTEXT, and a FOCUS level that puts it in the row
	 * set. Both halves are needed and the second is the one worth stating: unfocused,
	 * `roadmapRows` hands over `model.results`, which holds no context rows at all — so
	 * an excluded ancestor reaches any roadmap axis only at the focus level, exactly as
	 * the horizon axis's own context tests set up.
	 */
	function contextRoadmap(settings: BacklogSettings, epicAssignee: string, resultAssignee: string) {
		const vault = new FakeVault();
		vault.addFile('Outside epic.md', { frontmatter: { type: 'Epic', order: 10, assignee: epicAssignee } });
		vault.addFile('Result.md', {
			frontmatter: {
				type: 'Feature',
				order: 10,
				assignee: resultAssignee,
				start: '2026-08-01',
				due: '2026-08-02',
			},
			parentLink: 'Outside epic',
		});
		const entries = vault.entries().filter((entry) => entry.file.path !== 'Outside epic.md');
		const focused = { ...settings, focusLevel: 'Epic' };
		return buildRoadmap(buildModel(vault.app, entries, focused), focused, () => true, 'resources');
	}

	it('groups into a row that already exists, uncounted and never shelved', () => {
		const roadmap = contextRoadmap(resourceSettings({ resourceNames: ['Alice'] }), 'Alice', 'Alice');

		const alice = roadmap.lanes[0];
		expect(alice.context.map((item) => item.title)).toEqual(['Outside epic']);
		// Placement, not population: it draws no bar of its own, and the shelf is a
		// statement about results — the row set at this focus level holds none.
		expect(alice.bars).toEqual([]);
		expect(roadmap.shelf).toEqual([]);
		expect(roadmap.placedCount).toBe(0);
	});

	it('never mints a row of its own, and falls to the undifferentiated context', () => {
		// The only declared row is Bob's — so Alice's does not exist, and the excluded
		// Epic that names her has none to join.
		const roadmap = contextRoadmap(resourceSettings({ resourceNames: ['Bob'] }), 'Alice', 'Bob');

		expect(roadmap.lanes.map((lane) => lane.name)).toEqual(['Bob']);
		expect(roadmap.context.map((item) => item.title)).toEqual(['Outside epic']);
	});
});
