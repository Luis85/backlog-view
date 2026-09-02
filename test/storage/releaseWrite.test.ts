// The release membership at the write boundary, beside `applyLinks`'s own file for the
// identical reason it exists: a link is spelled from the editing note's own path
// (`wikilinkTo`), never from a basename, or two same-named release notes would be
// indistinguishable on disk.
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { CivilDate } from '../../src/domain/noteFields';
import { BacklogSettings } from '../../src/domain/settings';
import {
	computeHorizonWrites,
	computeIterationWrites,
	computeReleaseWrites,
	computeScheduleWrites,
} from '../../src/domain/writePlan';

describe('writing a release membership', () => {
	it('spells the value as a link resolved from the editing note', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		const release = vault.files.get('Releases/2.4.md')!;
		await applyWrites(vault.app, settingsWith({ releaseKey: 'release' }), [{ file: feature, release }]);
		// A LINK, not a bare string built by hand: `wikilinkTo` goes through Obsidian's own
		// `fileToLinktext`, which is what the basename-collision test below actually exercises.
		expect(vault.fm('F.md').release).toBe('[[2.4]]');
	});

	it('DELETES the key rather than blanking it', async () => {
		const vault = new FakeVault();
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature', release: '[[2.4]]' } });
		await applyWrites(vault.app, settingsWith({ releaseKey: 'release' }), [{ file: feature, release: null }]);
		expect('release' in vault.fm('F.md')).toBe(false);
	});

	it('writes nothing when the key is unbound', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		const release = vault.files.get('Releases/2.4.md')!;
		await applyWrites(vault.app, settingsWith({ releaseKey: '' }), [{ file: feature, release }]);
		// The whole note, not just the absence of a `release` key: an unconfigured key is
		// `''`, and `setOwn(fm, '', …)` would add that as a real key nobody named — a hole
		// the narrower assertion above cannot see.
		expect(vault.fm('F.md')).toEqual({ type: 'Feature' });
	});

	it('is undoable as one batch', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		const release = vault.files.get('Releases/2.4.md')!;
		const settings = settingsWith({ releaseKey: 'release' });
		const inverses: RestoreWrite[] = [];
		await applyWrites(vault.app, settings, [{ file: feature, release }], undefined, (inv) => inverses.push(inv));
		expect(vault.fm('F.md').release).toBe('[[2.4]]');

		await applyRestores(vault.app, inverses);
		expect('release' in vault.fm('F.md')).toBe(false);
	});

	// PBI acceptance criterion: "Two releases whose notes share a basename are
	// distinguishable in the picker and resolve to the file that was picked." The picker
	// half is a menu concern (Task 6); this is the write half, and it is checked by
	// RESOLVING the written link through the vault's own link resolution — a bare
	// `[[2.4]]` would string-match neither fixture path and still be wrong, which a test
	// comparing the written string to the target's path alone could not catch.
	it('resolves to the release that was picked, not the same-named one', async () => {
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Archive/2.4.md', { frontmatter: { type: 'Release' } });
		const feature = vault.addFile('F.md', { frontmatter: { type: 'Feature' } });
		const picked = vault.files.get('Archive/2.4.md')!;

		await applyWrites(vault.app, settingsWith({ releaseKey: 'release' }), [{ file: feature, release: picked }]);

		const written = vault.fm('F.md').release as string;
		const linkpath = written.slice(2, -2); // strip [[ ]]
		const resolved = vault.app.metadataCache.getFirstLinkpathDest(linkpath, 'F.md');
		expect(resolved).toBe(picked);
	});
});

/**
 * **The three questions only the writer can ask** ([ADR 0033](../../docs/adrs/0033-a-stale-rule-is-decided-at-the-writer.md),
 * [[Joining a release dates the work]] 6c): does the note still hold that end, would
 * writing it reverse the span against the end that stands, and is this pick still a join.
 *
 * Every case here is plan-then-apply against a REAL plan — `computeReleaseWrites` with a
 * fixed `today` — because a hand-built `ItemWrite` could state an axis the planner never
 * produces, and the whole point of the split is that the plan carries both candidates
 * whatever the row it was drawn from said.
 */
const TODAY: CivilDate = { year: 2026, month: 9, day: 2 };
const dated = settingsWith({ releaseKey: 'release', startKey: 'start', targetKey: 'due' });

/** A PBI, a `2.4` release, and the plan for joining the one to the other. */
function joining(opts: { own?: Record<string, unknown>; releaseDate?: string; settings?: BacklogSettings } = {}) {
	const settings = opts.settings ?? dated;
	const vault = new FakeVault();
	vault.addFile('Releases/2.4.md', {
		frontmatter: { type: 'Release', ...(opts.releaseDate ? { 'target-date': opts.releaseDate } : {}) },
	});
	vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10, ...opts.own } });
	const model = buildModel(vault.app, vault.entries(), settings);
	const item = model.byPath.get('PBI-1.md')!;
	const writes = computeReleaseWrites(item, model.byPath.get('Releases/2.4.md')!, settings, TODAY);
	return {
		vault,
		writes,
		settings,
		/** Apply the plan as it stands — after whatever the test did to the note meanwhile. */
		apply: () => applyWrites(vault.app, settings, writes),
		fm: () => vault.fm('PBI-1.md'),
	};
}

describe('a release join fills only what the note leaves empty', () => {
	it('writes both ends onto an item that holds neither', async () => {
		const join = joining({ releaseDate: '2026-12-01' });
		await join.apply();
		expect(join.fm()).toEqual({ type: 'PBI', order: 10, release: '[[2.4]]', start: '2026-09-02', due: '2026-12-01' });
	});

	it('fills a BACKFILLED note, whose keys are present and empty', async () => {
		// "Already holds" is a readable DATE, never a present key — `start: ''` and
		// `due: ''` are exactly what ✨ Assign missing properties leaves on every eligible
		// note, so asking presence would make this feature write nothing in the vaults
		// most likely to have it.
		const join = joining({ releaseDate: '2026-12-01', own: { start: '', due: '' } });
		await join.apply();
		expect(join.fm().start).toBe('2026-09-02');
		expect(join.fm().due).toBe('2026-12-01');
	});

	it('leaves a due the item already holds, and still writes the start', async () => {
		// 3a, and each end asserted with the OTHER empty: a rule that read both together
		// would pass a joint assertion and fail here.
		const join = joining({ releaseDate: '2026-12-01', own: { due: '2026-10-31' } });
		await join.apply();
		expect(join.fm().due).toBe('2026-10-31');
		expect(join.fm().start).toBe('2026-09-02');
	});

	it('leaves a start the item already holds, and still writes the due', async () => {
		const join = joining({ releaseDate: '2026-12-01', own: { start: '2026-01-05' } });
		await join.apply();
		expect(join.fm().start).toBe('2026-01-05');
		expect(join.fm().due).toBe('2026-12-01');
	});

	it('writes today as a start where no due stands at all', async () => {
		// 4c: the release states no date and the item has none, so there is nothing for
		// today to be later than.
		const join = joining();
		await join.apply();
		expect(join.fm().start).toBe('2026-09-02');
		expect('due' in join.fm()).toBe(false);
	});

	it('copies a PAST release date and invents no start', async () => {
		// **The trap, and it is decided from ONE snapshot.** `AXIS_FIELDS` orders `start`
		// before `target`, so a check written inside `applyAxis`'s loop reads, at `target`,
		// a start it wrote itself one iteration earlier: nothing stood to forbid today, so
		// today lands, and the due is then suppressed against it. That is the precise
		// inverse of 4b, which wants the past due copied and no start invented.
		const join = joining({ releaseDate: '2026-08-01' });
		await join.apply();
		expect(join.fm().due).toBe('2026-08-01');
		expect('start' in join.fm()).toBe(false);
	});

	it('writes no due where the release ships before a start that stands', async () => {
		// 4b's second direction, missing until 2026-09-02: 3a wrote the earlier due, 4a
		// kept the later start, and the `AxisWrite` states no `ends`, so the writer's own
		// reversed-span guard did not run on it either. The item keeps its coherent plan.
		const join = joining({ releaseDate: '2026-08-01', own: { start: '2026-12-01' } });
		await join.apply();
		expect(join.fm().start).toBe('2026-12-01');
		expect('due' in join.fm()).toBe(false);
	});

	it('writes no date at all under an unconfigured key, and still lands the link', async () => {
		// 4d: absence is a value. The whole note, not just the two keys — `setOwn(fm, '', …)`
		// would add the empty key as a real one nobody named.
		const join = joining({ releaseDate: '2026-12-01', settings: settingsWith({ releaseKey: 'release' }) });
		await join.apply();
		expect(join.fm()).toEqual({ type: 'PBI', order: 10, release: '[[2.4]]' });
	});
});

describe('the note as it stands, not the row that planned the write', () => {
	it('keeps a due typed onto the note after the row was drawn, and lands no start after it', async () => {
		const join = joining({ releaseDate: '2026-12-01' });
		// The window: somebody types a due into the note while the submenu sits open.
		join.fm().due = '2026-08-15';
		await join.apply();
		expect(join.fm().due).toBe('2026-08-15');
		expect('start' in join.fm()).toBe(false);
	});

	it('still writes today as a start when the captured past due is REMOVED before the batch lands', async () => {
		// The end a pre-filtering planner would have dropped. The row was drawn against a
		// due in the past — which would suppress today — and that due is gone by the time
		// the batch arrives, so nothing stands to forbid the start any more. A plan that
		// had filtered at plan time has no start left to write, and the writer cannot
		// reinstate one.
		const join = joining({ releaseDate: '2026-12-01', own: { due: '2026-08-15' } });
		expect(join.writes[0]?.axis).toEqual({ fillOnly: true, start: '2026-09-02', target: '2026-12-01' });
		delete join.fm().due;
		await join.apply();
		expect(join.fm().start).toBe('2026-09-02');
		expect(join.fm().due).toBe('2026-12-01');
	});
});

/**
 * **Is this pick still a join?** — read before `applyLinks` overwrites the membership, the
 * way `leaving` already captures the departing state, and read with the SAME semantics the
 * planner uses: a resolved PATH with cardinality beside it, never the raw text. Both
 * directions of that have been a shipped defect one layer up, so both are driven here.
 */
describe('a membership another view joined first', () => {
	it('writes no date where the note already names the target, however it is spelled', async () => {
		const join = joining({ releaseDate: '2026-12-01' });
		// A relative link with an alias — a raw-text compare reads this as a non-match and
		// tops up the dates on a note that was already a member, which is what 2a forbids.
		join.fm().release = '[[Releases/2.4|2.4]]';
		await join.apply();
		expect('start' in join.fm()).toBe(false);
		expect('due' in join.fm()).toBe(false);
	});

	it('writes no date where the note names it plainly either', async () => {
		const join = joining({ releaseDate: '2026-12-01' });
		join.fm().release = '[[2.4]]';
		await join.apply();
		expect('start' in join.fm()).toBe(false);
		expect('due' in join.fm()).toBe(false);
	});

	it('DOES date a note whose two-valued key merely starts with the target', async () => {
		// The other direction, and the one a raw-text compare gets wrong the other way: a
		// `release: [R, E]` whose first entry IS the target reads as a match and the write
		// calls itself a no-op — but membership is ONE value, so that note must still be
		// repaired, and the repair IS the join.
		const join = joining({ releaseDate: '2026-12-01' });
		join.fm().release = ['[[Releases/2.4]]', '[[Releases/2.5]]'];
		await join.apply();
		expect(join.fm().release).toBe('[[2.4]]');
		expect(join.fm().start).toBe('2026-09-02');
		expect(join.fm().due).toBe('2026-12-01');
	});
});

/**
 * **The flag is never `applyAxis`'s default** — the category invariant behind it, driven at
 * the three paths that share that function and overwrite on purpose. Each runs against a
 * note ALREADY holding the end being written, so a fill-only rule that leaked into the
 * default fails here rather than in a vault.
 */
describe('every other axis path still overwrites', () => {
	it('overwrites the horizon a drag moved the card out of', async () => {
		const vault = new FakeVault();
		const settings = settingsWith({ horizonKey: 'horizon', horizonValues: ['Now', 'Next'] });
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10, horizon: 'Now' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		await applyWrites(vault.app, settings, computeHorizonWrites(model.byPath.get('PBI-1.md')!, 'Next'));
		expect(vault.fm('PBI-1.md').horizon).toBe('Next');
	});

	it('overwrites both ends a timeline resize moved', async () => {
		const vault = new FakeVault();
		const settings = settingsWith({ startKey: 'start', targetKey: 'due' });
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-01-01', due: '2026-02-01' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const item = model.byPath.get('PBI-1.md')!;
		const writes = computeScheduleWrites(item, { start: '2026-03-01', target: '2026-04-01' }, ['start', 'target']);
		await applyWrites(vault.app, settings, writes);
		expect(vault.fm('PBI-1.md').start).toBe('2026-03-01');
		expect(vault.fm('PBI-1.md').due).toBe('2026-04-01');
	});

	it('overwrites the dates an iteration join imposes', async () => {
		// [[An iteration's timeframe schedules its items]] 2a: a sprint is a time BOX and
		// imposes both of its ends, which is the decision a shared default would retire.
		const vault = new FakeVault();
		const settings = settingsWith({ iterationKey: 'iteration', startKey: 'start', targetKey: 'due' });
		vault.addFile('Sprint 12.md', {
			frontmatter: { type: 'Iteration', start: '2026-09-07', due: '2026-09-20' },
		});
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-01-01', due: '2026-02-01' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const writes = computeIterationWrites(model.byPath.get('PBI-1.md')!, model.byPath.get('Sprint 12.md')!, settings);
		await applyWrites(vault.app, settings, writes);
		expect(vault.fm('PBI-1.md').start).toBe('2026-09-07');
		expect(vault.fm('PBI-1.md').due).toBe('2026-09-20');
	});
});

describe('the fill-only flag is the release join’s and nothing else’s', () => {
	it('lands no date for a write that carries no membership at all', async () => {
		// The dates ride the JOIN and only the join. No planner produces this shape, and
		// the guard is what keeps that true of one written later — a batch that borrowed
		// the flag to fill two keys would have no join to be a top-up of.
		const vault = new FakeVault();
		const pbi = vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10 } });
		await applyWrites(vault.app, dated, [
			{ file: pbi, axis: { fillOnly: true, start: '2026-09-02', target: '2026-12-01' } },
		]);
		expect(vault.fm('PBI-1.md')).toEqual({ type: 'PBI', order: 10 });
	});

	it('reads a ONE-element list as the plain membership both ends already call it', async () => {
		// `readString` unwraps a single-entry list, so the reader and the planner both call
		// `[R]` an ordinary membership of R — and the live check has to agree, or a note
		// spelled that way would be topped up on every re-pick.
		const join = joining({ releaseDate: '2026-12-01' });
		join.fm().release = ['[[Releases/2.4]]'];
		await join.apply();
		expect('start' in join.fm()).toBe(false);
		expect('due' in join.fm()).toBe(false);
	});
});
