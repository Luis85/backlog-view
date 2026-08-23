// One question at the write boundary — may this note's LIVE type hold this key — asked of
// the two doors a planning key reaches a note through, because the answer used to live
// inside `refusesAxis` and that function returns at its first clause for a write carrying
// no `axis`. Both doors walked past it: the iteration assignment, and the ✨ backfill's
// stubs. Its own file rather than an appendix to `frontmatterDates.test.ts`, whose subject
// is the dated axis and which is near its own line budget.
import { describe, expect, it } from 'vitest';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { buildModel } from '../../src/domain/model';
import {
	computeInitWrites,
	computeIterationNoteWrites,
	computeIterationWrites,
	computeReleaseWrites,
} from '../../src/domain/writePlan';
import { settingsFrom } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

const settings = settingsFrom({
	iterationProperty: 'note.iteration',
	horizonProperty: 'note.horizon',
	horizonValues: 'Now, Next, Later',
	startProperty: 'note.start',
	targetProperty: 'note.target',
	riskProperty: 'note.risk',
	iterationGoalProperty: 'note.goal',
});

/**
 * A vault holding one sprint with both dates and one item, and the join a `Set iteration`
 * pick plans between them — the link AND the sprint's timeframe, which is the shape that
 * carries an `axis` with no `ends` and so slips past the dated axis's own shape check.
 */
function plannedJoin(): { vault: FakeVault; writes: ReturnType<typeof computeIterationWrites> } {
	const vault = new FakeVault();
	vault.addFile('Sprint 3.md', { frontmatter: { type: 'Iteration', start: '2026-09-01', target: '2026-09-14' } });
	vault.addFile('1.0.md', { frontmatter: { type: 'PBI' } });
	const model = buildModel(vault.app, vault.entries(), settings);
	const item = model.byPath.get('1.0.md');
	const sprint = model.byPath.get('Sprint 3.md');
	if (!item || !sprint) throw new Error('fixture did not build');
	return { vault, writes: computeIterationWrites(item, sprint, settings) };
}

describe('the writer asks the LIVE type about an iteration too', () => {
	it('refuses a sprint join the note was retyped out from under', async () => {
		// The same window the horizon has been checked against since the type arrived, on
		// the path that carries no `axis.ends` and therefore never reached the check: a
		// plan captured against a `PBI`, applied to a note somebody retyped to `Release`
		// in between. The consequence is worse than a stray key — `canSetIteration`
		// refuses `isMarkerType`, so no control the view draws would ever offer to clear
		// it again.
		const { vault, writes } = plannedJoin();
		// The plan itself is legitimate — this is a refusal at the boundary, not a plan
		// that was empty all along, which is the way a test like this passes on nothing.
		expect(writes).toHaveLength(1);

		vault.fm('1.0.md').type = 'Release';
		const outcome = await applyWrites(vault.app, settings, writes);

		expect(vault.fm('1.0.md')).toEqual({ type: 'Release' });
		expect(outcome.changed).toBe(false);
	});

	it('still joins the type the note actually holds', async () => {
		// The control that says the refusal is about the live TYPE and not about
		// iterations: the same plan, the same keys, a note nobody retyped — and then the
		// undo of it, taken AFTER a retype. A replay goes through `applyRestores`, which
		// puts back the RAW captured keys and asks nothing of the live type, so closing
		// this hole must not take away a reader's way back.
		const { vault, writes } = plannedJoin();
		const inverses: RestoreWrite[] = [];
		const outcome = await applyWrites(vault.app, settings, writes, undefined, (inv) => inverses.push(inv));

		expect(vault.fm('1.0.md')).toEqual({
			type: 'PBI',
			iteration: '[[Sprint 3]]',
			start: '2026-09-01',
			target: '2026-09-14',
		});
		expect(outcome.changed).toBe(true);

		vault.fm('1.0.md').type = 'Release';
		await applyRestores(vault.app, inverses);
		expect(vault.fm('1.0.md')).toEqual({ type: 'Release' });
	});
});

describe('the writer asks the LIVE type about an iteration NOTE’s own fields', () => {
	it('refuses a goal the note was retyped out from under', async () => {
		// `saveIteration` (`view/interactions/create.ts`) re-reads the MODEL and not the
		// note, so its `isIterationType` gate is authorization at PLAN time — which is the
		// thing this guard exists to stop trusting. A goal-only save lands the key on a
		// `Release`, where the dialog that wrote it is never offered again and no other
		// control mentions a goal at all: the sprint link's unclearable shape, reached
		// through the other field.
		//
		// Driven at the boundary rather than through the dialog, because the rule is stated
		// on the write; the plan is the real one that dialog makes.
		const vault = new FakeVault();
		vault.addFile('1.0.md', { frontmatter: { type: 'Iteration' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const item = model.byPath.get('1.0.md');
		if (!item) throw new Error('fixture did not build');
		const writes = computeIterationNoteWrites(item, { axis: {}, goal: 'Ship the thing' });
		expect(writes[0].iterationGoal).toBe('Ship the thing');

		vault.fm('1.0.md').type = 'Release';
		const outcome = await applyWrites(vault.app, settings, writes);

		expect(vault.fm('1.0.md')).toEqual({ type: 'Release' });
		expect(outcome.changed).toBe(false);
	});

	it('lets a REMOVAL through, which is the only way one of these keys comes off', async () => {
		// The guard exists because a key on a marker is unclearable — no control the view
		// draws offers to take it off — so refusing the removal as well would stand against
		// its own reason. `null` is how every one of these keys is removed, and a write that
		// only removes cannot put a key on a type that may not hold it.
		const vault = new FakeVault();
		const file = vault.addFile('1.0.md', {
			frontmatter: { type: 'Release', iteration: '[[Sprint 3]]', horizon: 'Now' },
		});

		await applyWrites(vault.app, settings, [{ file, iteration: null, axis: { horizon: null } }]);

		expect(vault.fm('1.0.md')).toEqual({ type: 'Release' });
	});
});

describe('the ✨ backfill stubs no key a release may not hold', () => {
	it('leaves a release its own keys and stubs the item beside it', async () => {
		// The whole ✨ path over one base — what `runInit` plans (`computeInitWrites`) put
		// through what it applies (`applySafely` → `applyWrites`) — because the guard is
		// stated at both ends and either alone would pass a test that drove only the other.
		const vault = new FakeVault();
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 10 } });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 20 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const writes = computeInitWrites(model, settings);

		// What ✨ OFFERS, first, and asserted apart from the frontmatter below: the two
		// guards catch this in different windows, so each has to be able to fail alone —
		// the writer's drop would otherwise carry an assertion made only about the plan.
		// `risk` is the control at this end: the release keeps every stub it MAY hold, so
		// the planner is narrowing rather than skipping the note.
		expect(writes.find((write) => write.file.path === '1.0.md')?.stubs ?? []).toEqual(['risk']);

		await applyWrites(vault.app, settings, writes);

		// The roadmap's own three planning keys, named one by one: a release is the type
		// this plugin declares unplaceable, and an empty key is pollution rather than
		// placement but is still not "not written".
		expect(vault.fm('1.0.md')).not.toHaveProperty('horizon');
		expect(vault.fm('1.0.md')).not.toHaveProperty('start');
		expect(vault.fm('1.0.md')).not.toHaveProperty('target');
		expect(vault.fm('1.0.md').iteration).toBeUndefined();
		// And the control: the backfill still does its job on the note beside it, so the
		// guard narrows rather than refusing everything.
		expect(vault.fm('Work.md')).toMatchObject({ horizon: '', start: '', target: '', iteration: '' });
	});

	it('drops a stub the note was retyped out from under', async () => {
		// The writer's own half. Authorization at plan time is not authorization at write
		// time: this plan was made against a `PBI` and lands on a `Release`. Dropped, not
		// refused — a backfill names hundreds of notes in one batch, and refusing at the
		// one release would abandon every note after it for a key carrying no decision.
		const vault = new FakeVault();
		const file = vault.addFile('1.0.md', { frontmatter: { type: 'PBI' } });
		const other = vault.addFile('Work.md', { frontmatter: { type: 'PBI' } });
		const stubs = ['horizon', 'start', 'target', 'iteration', 'risk'] as const;

		vault.fm('1.0.md').type = 'Release';
		await applyWrites(vault.app, settings, [
			{ file, stubs: [...stubs] },
			{ file: other, stubs: [...stubs] },
		]);

		// The risk is the control INSIDE the refused note: a release holds no placement
		// and is an ordinary note in every other respect, so a rule that dropped the whole
		// batch of stubs would pass every assertion above it and be wrong.
		expect(vault.fm('1.0.md')).toEqual({ type: 'Release', risk: '' });
		expect(vault.fm('Work.md')).toEqual({ type: 'PBI', horizon: '', start: '', target: '', iteration: '', risk: '' });
	});
});

/**
 * The release membership is the same window through a third field, and it was open until
 * 2026-08-23: `refusesLiveType` listed the horizon, the two dates, the sprint link and its
 * goal, and not this one. What makes it the guard's own case rather than a nearby key is
 * the shape it leaves behind — `canSetRelease` refuses a marker, so a membership landed on
 * one is offered by no control the view draws, and `membershipTarget` reports it as
 * unresolved for as long as it sits there.
 */
const releaseSettings = settingsFrom({ releaseProperty: 'note.release' });

describe('the writer asks the LIVE type about a release membership', () => {
	it('refuses a membership the note was retyped out from under', async () => {
		const vault = new FakeVault();
		vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('1.0.md', { frontmatter: { type: 'PBI' } });
		const model = buildModel(vault.app, vault.entries(), releaseSettings);
		const item = model.byPath.get('1.0.md');
		const release = model.byPath.get('2.4.md');
		if (!item || !release) throw new Error('fixture did not build');
		const writes = computeReleaseWrites(item, release, releaseSettings);
		// The plan is legitimate — this is a refusal at the boundary, not a plan that was
		// empty all along, which is the way a test like this passes on nothing.
		expect(writes).toEqual([{ file: item.file, release: release.file }]);

		vault.fm('1.0.md').type = 'Milestone';
		const outcome = await applyWrites(vault.app, releaseSettings, writes);

		expect(vault.fm('1.0.md')).toEqual({ type: 'Milestone' });
		expect(outcome.changed).toBe(false);
	});

	it('refuses a membership on a note retyped into the test catalog', async () => {
		// A marker is not the only carrier the reader refuses: `membershipTarget` asks
		// `inPlan` too, so a catalog note wearing a membership is reported unresolved and
		// `canSetRelease` draws no action to take it off again.
		const vault = new FakeVault();
		vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('1.0.md', { frontmatter: { type: 'PBI' } });
		const model = buildModel(vault.app, vault.entries(), releaseSettings);
		const item = model.byPath.get('1.0.md');
		const release = model.byPath.get('2.4.md');
		if (!item || !release) throw new Error('fixture did not build');
		const writes = computeReleaseWrites(item, release, releaseSettings);
		expect(writes).toEqual([{ file: item.file, release: release.file }]);

		vault.fm('1.0.md').type = 'Test case';
		const outcome = await applyWrites(vault.app, releaseSettings, writes);

		expect(vault.fm('1.0.md')).toEqual({ type: 'Test case' });
		expect(outcome.changed).toBe(false);
	});

	it('refuses a membership whose CARRIER was reparented into the catalog', async () => {
		// A `Task` is on both ladders, so its own name cannot answer this and the type half
		// admits it: only the live parent chain says the note walked into the test catalog
		// while the menu was open. `inPlan` fails on the rebuilt item, so `canSetRelease`
		// draws nothing that could take the membership off again.
		const vault = new FakeVault();
		vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('S.md', { frontmatter: { type: 'Test suite' } });
		vault.addFile('1.0.md', { frontmatter: { type: 'PBI' } });
		const task = vault.addFile('1.1.md', { frontmatter: { type: 'Task' }, parentLink: '1.0' });
		const model = buildModel(vault.app, vault.entries(), releaseSettings);
		const release = model.byPath.get('2.4.md');
		const item = model.byPath.get('1.1.md');
		if (!item || !release) throw new Error('fixture did not build');
		const writes = computeReleaseWrites(item, release, releaseSettings);
		expect(writes).toEqual([{ file: task, release: release.file }]);

		// Re-added rather than edited in place: the parent is a link, and `resolveParent`
		// reads the link CACHE before the raw value, so a fixture that changed only the
		// text would leave the walk following the note it no longer names.
		vault.addFile('1.1.md', { frontmatter: { type: 'Task' }, parentLink: 'S' });
		const outcome = await applyWrites(vault.app, releaseSettings, writes);

		expect(vault.fm('1.1.md')['release']).toBeUndefined();
		expect(outcome.changed).toBe(false);
	});

	it('lets the same task through while its parent is still plan work', async () => {
		// The control INSIDE the walk: without it the test above passes on a guard that
		// refuses every task, which is the way a ladder check reads as working and is not.
		const vault = new FakeVault();
		vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('1.0.md', { frontmatter: { type: 'PBI' } });
		vault.addFile('1.1.md', { frontmatter: { type: 'Task' }, parentLink: '1.0' });
		const model = buildModel(vault.app, vault.entries(), releaseSettings);
		const item = model.byPath.get('1.1.md');
		const release = model.byPath.get('2.4.md');
		if (!item || !release) throw new Error('fixture did not build');

		await applyWrites(vault.app, releaseSettings, computeReleaseWrites(item, release, releaseSettings));

		expect(vault.fm('1.1.md')['release']).toBe('[[2.4]]');
	});

	it('follows a FOLDER-inferred parent, which no parent link spells', async () => {
		// Folder mode hangs a note with no parent value under its nearest folder note, so
		// moving a task into a test suite's folder changes the ladder `buildModel` assigns
		// while every link on the note stays as it was.
		const folderSettings = { ...releaseSettings, folderHierarchy: true };
		const vault = new FakeVault();
		vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('S/S.md', { frontmatter: { type: 'Test suite' } });
		const task = vault.addFile('1.1.md', { frontmatter: { type: 'Task' } });
		const model = buildModel(vault.app, vault.entries(), folderSettings);
		const item = model.byPath.get('1.1.md');
		const release = model.byPath.get('2.4.md');
		if (!item || !release) throw new Error('fixture did not build');
		const writes = computeReleaseWrites(item, release, folderSettings);
		expect(writes).toEqual([{ file: task, release: release.file }]);

		vault.renameFile('1.1.md', 'S/1.1.md');
		const outcome = await applyWrites(vault.app, folderSettings, writes);

		expect(vault.fm('S/1.1.md')['release']).toBeUndefined();
		expect(outcome.changed).toBe(false);
	});

	it('refuses a membership whose TARGET is no longer a release', async () => {
		// The plan carries the `TFile` the picker was built from. Retype that note while
		// the submenu is open and the link would name something that is not a release,
		// which the reader reports as an unresolved membership.
		const vault = new FakeVault();
		vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
		vault.addFile('1.0.md', { frontmatter: { type: 'PBI' } });
		const model = buildModel(vault.app, vault.entries(), releaseSettings);
		const item = model.byPath.get('1.0.md');
		const release = model.byPath.get('2.4.md');
		if (!item || !release) throw new Error('fixture did not build');
		const writes = computeReleaseWrites(item, release, releaseSettings);

		vault.fm('2.4.md').type = 'Epic';
		const outcome = await applyWrites(vault.app, releaseSettings, writes);

		expect(vault.fm('1.0.md')).toEqual({ type: 'PBI' });
		expect(outcome.changed).toBe(false);
	});

	it('lets a REMOVAL through, which is the only way this key comes off a marker', async () => {
		// The guard's stated exemption, checked rather than claimed: `stated()` reads a
		// `null` as not-stated, so the removal lands on the very type the write above is
		// refused for. A guard that refused this one would stand against its own reason.
		const vault = new FakeVault();
		const file = vault.addFile('1.0.md', { frontmatter: { type: 'Milestone', release: '[[2.4]]' } });

		await applyWrites(vault.app, releaseSettings, [{ file, release: null }]);

		expect(vault.fm('1.0.md')).toEqual({ type: 'Milestone' });
	});
});
