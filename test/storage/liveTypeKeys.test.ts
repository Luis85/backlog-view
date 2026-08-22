// One question at the write boundary — may this note's LIVE type hold this key — asked of
// the two doors a planning key reaches a note through, because the answer used to live
// inside `refusesAxis` and that function returns at its first clause for a write carrying
// no `axis`. Both doors walked past it: the iteration assignment, and the ✨ backfill's
// stubs. Its own file rather than an appendix to `frontmatterDates.test.ts`, whose subject
// is the dated axis and which is near its own line budget.
import { describe, expect, it } from 'vitest';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { buildModel } from '../../src/domain/model';
import { computeInitWrites, computeIterationWrites } from '../../src/domain/writePlan';
import { settingsFrom } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

const settings = settingsFrom({
	iterationProperty: 'note.iteration',
	horizonProperty: 'note.horizon',
	horizonValues: 'Now, Next, Later',
	startProperty: 'note.start',
	targetProperty: 'note.target',
	riskProperty: 'note.risk',
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
