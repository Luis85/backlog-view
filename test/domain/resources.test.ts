import { describe, expect, it } from 'vitest';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap, laneIdentity, markerLane } from '../../src/domain/roadmap';
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
 *
 * Every row is a `Resource` note now (Task 5, 2026-08-28): there is no more declared
 * roster setting for this file to configure, so a vault built for one of these tests
 * carries a `Resource` note for every row the test expects, whether empty or not.
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
	it('draws one row per resource note, in the model’s own order, empty or not', () => {
		const settings = resourceSettings();
		const roadmap = laneOf(resourceVault(), settings);

		// Bob is empty and still there; a row is a note now, not a bar that landed.
		expect(roadmap.lanes.map((lane) => lane.name)).toEqual(['Alice', 'Bob', 'Zoe']);
	});

	it('groups by the note’s own resolved assignee, in tree order', () => {
		const settings = resourceSettings();
		const roadmap = laneOf(resourceVault(), settings);

		expect(titles(roadmap.lanes[0].bars)).toEqual(['Alice dated', 'Cased']);
	});

	it('places each same-basename resource’s work in its OWN row, by path — never by name', () => {
		// The read side of the regression the write-side drop test in
		// `resourceMoves.test.ts` closes: `placeAssigned` resolves through
		// `item.assigneeEntry.file.path` against `byPath`, which is keyed by the resource's
		// own `TFile`. A regression back to a name scan (`resources.find(r =>
		// sameValue(r.title, name))`) would put both bars in whichever of the two the scan
		// reaches first, and this fixture — same title, two paths — is exactly what a
		// title-only match cannot tell apart.
		const settings = resourceSettings();
		const vault = new FakeVault();
		vault.addFile('Team/Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Support/Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Team work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: '[[Team/Alex]]', start: '2026-08-01', due: '2026-08-02' },
		});
		vault.addFile('Support work.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: '[[Support/Alex]]', start: '2026-08-03', due: '2026-08-04' },
		});
		const roadmap = laneOf(vault, settings);

		expect(roadmap.lanes.map((lane) => lane.file?.path)).toEqual(['Support/Alex.md', 'Team/Alex.md']);
		expect(titles(roadmap.lanes[0].bars)).toEqual(['Support work']);
		expect(titles(roadmap.lanes[1].bars)).toEqual(['Team work']);
	});

	it('never draws a Resource note in the marker lane, dated or not', () => {
		// The type is a marker, so it takes the marker BRANCH of `deriveLanes` — which is
		// right, since a person is in no resource's row either. What must not follow is a
		// bar: a `Resource` carrying the configured date keys drew a diamond in the
		// `Milestones` lane and minted that lane on a base with no milestone in it.
		const settings = resourceSettings();
		const vault = resourceVault();
		vault.addFile('Dana.md', { frontmatter: { type: 'Resource', start: '2026-08-01', due: '2026-08-31' } });
		const roadmap = laneOf(vault, settings);

		expect(roadmap.lanes.every((lane) => !lane.markers)).toBe(true);
		expect(roadmap.lanes.flatMap((lane) => titles(lane.bars))).not.toContain('Dana');
	});

	it('positions a bar exactly as the dated axis does — no second date reading', () => {
		const settings = resourceSettings();
		const vault = resourceVault();
		const lanes = laneOf(vault, settings);
		const dated = buildRoadmap(buildModel(vault.app, vault.entries(), settings), settings, () => true, 'dates');

		const onLane = lanes.lanes[0].bars.find((bar) => bar.item.title === 'Alice dated');
		const onGrid = dated.bars.find((bar) => bar.item.title === 'Alice dated');
		expect(onLane?.span).toEqual(onGrid?.span);
	});

	it('shelves a result with no assignee whatever its dates say — a row is who, not when', () => {
		const settings = resourceSettings();
		const roadmap = laneOf(resourceVault(), settings);

		const nobody = roadmap.shelf.find((card) => card.item.title === 'Nobody');
		expect(nobody).toBeDefined();
		expect(nobody?.reason).toBeNull();
	});

	it('draws no row at all for a name no Resource note carries, whatever its dates say', () => {
		const settings = resourceSettings();
		const vault = new FakeVault();
		vault.addFile('Named only.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Bob' } });
		const roadmap = laneOf(vault, settings);

		// A link is not a declaration and the type is: nothing on this roster names Bob, so
		// there is no row to place the item in — dated or not.
		expect(roadmap.lanes).toEqual([]);
		expect(roadmap.shelf.map((card) => card.item.title)).toEqual(['Named only']);
	});

	it('shelves an assigned result with no date to place, even though its row exists', () => {
		const settings = resourceSettings();
		const vault = new FakeVault();
		vault.addFile('Bob.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Named only.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Bob' } });
		const roadmap = laneOf(vault, settings);

		// Naming a resource is not scheduling against them: a row with no date to
		// position a bar at has nothing to draw, so nothing is drawn — but the row itself
		// is there regardless, since it is Bob's own note and not a bar that put it there.
		expect(roadmap.lanes.map((lane) => lane.name)).toEqual(['Bob']);
		expect(roadmap.lanes[0].bars).toEqual([]);
		expect(roadmap.shelf.map((card) => card.item.title)).toEqual(['Named only']);
	});

	it('keeps the dated axis’s own refusals and their reasons', () => {
		const settings = resourceSettings();
		const vault = new FakeVault();
		vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Bad.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: 'not a date' } });
		const roadmap = laneOf(vault, settings);

		expect(roadmap.shelf[0].reason).toBe('Unreadable start date');
		expect(roadmap.lanes[0].bars).toEqual([]);
	});

	it('draws a dateless parent’s inferred bar in its own resource’s row', () => {
		const settings = resourceSettings();
		const vault = new FakeVault();
		vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Bob.md', { frontmatter: { type: 'Resource' } });
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
		const settings = resourceSettings();
		const roadmap = laneOf(resourceVault(), settings);

		const placed = roadmap.lanes.reduce((sum, lane) => sum + lane.bars.length, 0);
		expect(roadmap.placedCount).toBe(placed);
		expect(placed + roadmap.shelf.length).toBe(5);
	});

	it('reports every drawn bar on `bars` too, in row order', () => {
		// Two readers ask `bars` "is this path a drawn bar rather than a card" — the card
		// menu's children section and the toolbar's collapse gate — so an axis that draws
		// bars must report them, or a lane's bar answers "card" to both.
		const settings = resourceSettings();
		const roadmap = laneOf(resourceVault(), settings);

		expect(titles(roadmap.bars)).toEqual(['Alice dated', 'Cased', 'Stray']);
	});

	it('gives every lane a file except the milestones’ own, the fact assignableLanes and wireLaneDrop’s cast both rest on', () => {
		// `assignableLanes`' `file !== null` narrowing and `wireLaneDrop`'s
		// `band.lane as AssignableLane` cast both stand on one invariant stated in doc
		// comments across two modules rather than checked anywhere: only `markerLane`
		// ever produces a lane with no file. Putting it on a fact rather than beside it.
		const settings = resourceSettings();
		const vault = resourceVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 60, due: '2026-08-07' } });
		const roadmap = laneOf(vault, settings);
		const markers = roadmap.lanes.find((lane) => lane.markers);

		expect(markers).toBeDefined();
		expect(markers?.file).toBeNull();
		expect(roadmap.lanes.filter((lane) => !lane.markers).every((lane) => lane.file !== null)).toBe(true);
	});
});

describe('a lane’s own identity', () => {
	it('is the note’s path for a resource, and the shared constant for the milestones’ row', () => {
		// `laneIdentity` is what a fold key and a keyboard stop both have to agree a row
		// IS — never `lane.name`, which two same-basename resources draw as one
		// disambiguated label and a rename changes without the note itself changing. Both
		// of today's callers already skip the milestones' row before asking (`!lane.markers`
		// upstream of either call), so this is exercised directly rather than through them
		// — the fallback is a real part of the function's own contract, not dead weight.
		const vault = resourceVault();
		const alice = vault.files.get('Alice.md');
		if (!alice) throw new Error('fixture has no Alice.md');

		expect(laneIdentity({ file: alice, name: 'Alice', markers: false, bars: [], absences: [], context: [] })).toBe(
			'Alice.md',
		);
		expect(laneIdentity(markerLane([]))).toBe('Milestones');
	});
});

/**
 * The one row that is not a resource. A milestone is a fact about the plan rather than
 * about a person, so it leaves the bands entirely — [[Milestones out of the resource rows]].
 */
describe('the milestones’ own row', () => {
	function markerVault(assignee?: string): FakeVault {
		const vault = resourceVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 60, assignee, due: '2026-08-07' } });
		return vault;
	}

	it('draws first, ahead of every other row', () => {
		const settings = resourceSettings();
		const roadmap = laneOf(markerVault('Alice'), settings);

		expect(roadmap.lanes.map((lane) => lane.name)).toEqual(['Milestones', 'Alice', 'Bob', 'Zoe']);
		expect(roadmap.lanes[0].markers).toBe(true);
		expect(roadmap.lanes.slice(1).every((lane) => !lane.markers)).toBe(true);
	});

	it('takes the marker out of its assignee’s band, and reads that assignee for nothing', () => {
		const settings = resourceSettings();
		const assigned = laneOf(markerVault('Alice'), settings);
		const unassigned = laneOf(markerVault(), settings);

		expect(titles(assigned.lanes[0].bars)).toEqual(['Ship']);
		expect(titles(assigned.lanes[1].bars)).not.toContain('Ship');
		// An unassigned milestone DRAWS rather than shelving: there is no assignee left to
		// be missing, which is the rule "a row is who" applied to a row that is nobody's.
		expect(titles(unassigned.lanes[0].bars)).toEqual(['Ship']);
		expect(unassigned.shelf.map((card) => card.item.title)).not.toContain('Ship');
	});

	it('is absent from a roadmap whose markers none of them place', () => {
		const settings = resourceSettings();
		const vault = resourceVault();
		// A marker with no readable date shelves like anything else, and the row is minted
		// by the bar that lands in it — never by an item that had one to shelve.
		vault.addFile('No date.md', { frontmatter: { type: 'Milestone', order: 60, assignee: 'Alice' } });
		const roadmap = laneOf(vault, settings);

		expect(roadmap.lanes.map((lane) => lane.name)).not.toContain('Milestones');
		expect(roadmap.shelf.map((card) => card.item.title)).toContain('No date');
	});

	it('counts a marker among the placed, and reports it on `bars` in row order', () => {
		const settings = resourceSettings();
		const roadmap = laneOf(markerVault('Alice'), settings);

		expect(titles(roadmap.bars)).toEqual(['Ship', 'Alice dated', 'Cased', 'Stray']);
		expect(roadmap.placedCount).toBe(4);
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
		return laneOf(withAbsence(resource), resourceSettings());
	}

	it('draws in the row its own resource names, and nowhere else', () => {
		const roadmap = lanesWith('Alice');

		expect(roadmap.lanes.find((lane) => lane.name === 'Alice')?.absences.map((a) => a.title)).toEqual(['Away']);
		expect(roadmap.lanes.filter((lane) => lane.absences.length > 0)).toHaveLength(1);
	});

	it('draws nowhere for a resource no Resource note carries — an absence cannot mint one', () => {
		// A row is a note now: an absence naming somebody off the roster used to mint a
		// trailing row for them (4b, "a third source"), and it no longer can — it is a
		// statement about a resource, not a declaration of one, so it draws nowhere.
		const roadmap = lanesWith('Quinn');

		expect(roadmap.lanes.map((lane) => lane.name)).not.toContain('Quinn');
		expect(roadmap.lanes.every((lane) => lane.absences.length === 0)).toBe(true);
	});

	it('draws nowhere when the link resolves to a note that is not on the roster', () => {
		// An absence names its resource by a LINK now (Task 6), read and matched exactly as
		// an item's own assignee is — `placeAssigned`'s one-answer-three-cases rule read
		// again: a link that resolves to a real note this base does not carry as a
		// `Resource` (here, the Epic `Alice dated`) names nobody as far as this row list is
		// concerned, the same as a link that resolves to nothing at all.
		const roadmap = lanesWith('[[Alice dated]]');

		expect(roadmap.lanes.every((lane) => lane.absences.length === 0)).toBe(true);
	});

	it('is never counted, and never changes what the shelf reports', () => {
		// The row's count is RESULT bars, exactly as a bucket's count is results. An
		// absence is neither a result nor a work item, so it moves no number here.
		const settings = resourceSettings();
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
	 * the horizon axis's own context tests set up. `resourceTitles` is the roster this
	 * roadmap draws rows for — a note per name, since every row is one now (Task 5).
	 */
	function contextRoadmap(
		settings: BacklogSettings,
		epicAssignee: string,
		resultAssignee: string,
		resourceTitles: string[],
	) {
		const vault = new FakeVault();
		for (const title of resourceTitles) vault.addFile(`${title}.md`, { frontmatter: { type: 'Resource' } });
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
		const roadmap = contextRoadmap(resourceSettings(), 'Alice', 'Alice', ['Alice']);

		const alice = roadmap.lanes[0];
		expect(alice.context.map((item) => item.title)).toEqual(['Outside epic']);
		// Placement, not population: it draws no bar of its own, and the shelf is a
		// statement about results — the row set at this focus level holds none.
		expect(alice.bars).toEqual([]);
		expect(roadmap.shelf).toEqual([]);
		expect(roadmap.placedCount).toBe(0);
	});

	it('falls to the undifferentiated context when it is a marker, whatever it names', () => {
		// [[Milestones out of the resource rows]] 4a: "a milestone is in no resource's row" is
		// a rule about the ROW, so the one path that positions nothing has to keep it too —
		// Alice's row exists here and the excluded marker still does not join it.
		const settings = resourceSettings();
		const vault = new FakeVault();
		vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Outside ship.md', { frontmatter: { type: 'Milestone', order: 10, assignee: 'Alice' } });
		vault.addFile('Result.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-02' },
			parentLink: 'Outside ship',
		});
		const entries = vault.entries().filter((entry) => entry.file.path !== 'Outside ship.md');
		const focused = { ...settings, focusLevel: 'Milestone' };
		const roadmap = buildRoadmap(buildModel(vault.app, entries, focused), focused, () => true, 'resources');

		expect(roadmap.context.map((item) => item.title)).toEqual(['Outside ship']);
		expect(roadmap.lanes.flatMap((lane) => lane.context.map((item) => item.title))).toEqual([]);
	});

	it('never joins a row of its own, and falls to the undifferentiated context', () => {
		// The only row is Bob's — Alice has no Resource note at all here — so the excluded
		// Epic that names her has none to join.
		const roadmap = contextRoadmap(resourceSettings(), 'Alice', 'Bob', ['Bob']);

		expect(roadmap.lanes.map((lane) => lane.name)).toEqual(['Bob']);
		expect(roadmap.context.map((item) => item.title)).toEqual(['Outside epic']);
	});
});
