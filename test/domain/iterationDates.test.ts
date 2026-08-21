import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { computeIterationJoinWrites, computeIterationWrites } from '../../src/domain/writePlan';
import { readDate } from '../../src/domain/noteFields';
import { reversedSpan } from '../../src/domain/timeline';
import { FakeVault } from '../helpers/vault';

/**
 * `computeIterationWrites` — the link, and the timeframe that follows it. Its own file
 * because the two dated-axis suites already split by subject before a shared file
 * becomes the place tests hide.
 */

const settings = settingsWith({ iterationKey: 'iteration' });

/**
 * A PBI and a `Sprint 12` iteration note, built together so the PBI's own link (when
 * given) resolves against the SAME model the target item comes from — matching by path
 * is only a meaningful assertion when both sides are read off one build.
 */
function fixture(iteration?: string) {
	const vault = new FakeVault();
	vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration' } });
	vault.addFile('PBI-1.md', {
		frontmatter: { type: 'PBI', order: 10, ...(iteration !== undefined ? { iteration } : {}) },
	});
	const model = buildModel(vault.app, vault.entries(), settings);
	return {
		model,
		pbi: model.byPath.get('PBI-1.md')!,
		sprint12: model.byPath.get('Sprint 12.md')!,
	};
}

/**
 * `computeIterationJoinWrites` — the same write, asked for by SCOPE rather than by note,
 * which is what a pull from the iteration board's shelf plans. Its four refusals are here
 * rather than at the caller precisely because a view could drive none of them honestly:
 * on the board that plans a pull there is always a model and always a scope.
 */
describe('computeIterationJoinWrites — joining by scope', () => {
	it('plans the join for the note the scope names', () => {
		const { model, pbi, sprint12 } = fixture();
		expect(computeIterationJoinWrites(pbi, model, 'Sprint 12.md', settings)).toEqual([
			{ file: pbi.file, iteration: sprint12.file },
		]);
	});

	it('plans nothing when the item is already in that iteration', () => {
		// By PATH, so a link spelled another way is the same iteration and still no join.
		const { model, pbi } = fixture('[[Sprint 12|this sprint]]');
		expect(computeIterationJoinWrites(pbi, model, 'Sprint 12.md', settings)).toEqual([]);
	});

	it('plans nothing off an iteration scope, with no model, or for a scope nothing holds', () => {
		// The product and Deliverables boards pass a null scope; a view before its first
		// data update has no model; a stored scope can name a note the model does not hold.
		const { model, pbi } = fixture();
		expect(computeIterationJoinWrites(pbi, model, null, settings)).toEqual([]);
		expect(computeIterationJoinWrites(pbi, null, 'Sprint 12.md', settings)).toEqual([]);
		expect(computeIterationJoinWrites(pbi, model, 'Gone.md', settings)).toEqual([]);
	});
});

describe('computeIterationWrites — the link', () => {
	it('plans the link when the item is not already in that iteration', () => {
		const { pbi, sprint12 } = fixture();
		expect(computeIterationWrites(pbi, sprint12, settings)).toEqual([
			{ file: pbi.file, iteration: sprint12.file },
		]);
	});

	it('plans nothing when the item is already in that iteration', () => {
		const { pbi, sprint12 } = fixture('[[Sprint 12]]');
		expect(computeIterationWrites(pbi, sprint12, settings)).toEqual([]);
	});

	it('plans a removal for None', () => {
		const { pbi } = fixture('[[Sprint 12]]');
		expect(computeIterationWrites(pbi, null, settings)).toEqual([{ file: pbi.file, iteration: null }]);
	});

	it('plans nothing at all when no iteration key is configured', () => {
		const { pbi, sprint12 } = fixture();
		expect(computeIterationWrites(pbi, sprint12, settingsWith({ iterationKey: '' }))).toEqual([]);
	});

	it('clears a link that resolved to nothing', () => {
		// Unresolved is not unset: an item holding a broken link must still be clearable.
		const { pbi } = fixture('[[Gone]]');
		expect(pbi.iterationEntry?.file).toBeNull();
		expect(computeIterationWrites(pbi, null, settings)).toEqual([{ file: pbi.file, iteration: null }]);
	});

	it('offers a removal for a key that failed to parse as a link at all — presence, not the parsed entry', () => {
		// `readLinkList` refuses a non-string value outright, so a hand-edited `iteration: 12`
		// reads as no ENTRY (`iterationEntry === null`) while the KEY is still visibly there on
		// the note. Asking the parsed entry for "is there something to clear" would report
		// nothing to remove on a note the reader can plainly see is not empty — the same
		// drift `computeAssigneeWrites` avoids by asking `ownKeys` instead of the reading.
		const vault = new FakeVault();
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10, iteration: 12 } });
		const model = buildModel(vault.app, vault.entries(), settings);
		const pbi = model.byPath.get('PBI-1.md')!;

		expect(pbi.iterationEntry).toBeNull();
		expect(pbi.ownKeys.iteration).toBe(true);
		expect(computeIterationWrites(pbi, null, settings)).toEqual([{ file: pbi.file, iteration: null }]);
	});
});

/**
 * Joining an iteration is joining its timeframe. The dates ride the SAME `ItemWrite` as
 * the link — one file, one `processFrontMatter` call, one undo — so every assertion below
 * reads the first (and only) write of the plan.
 */
const dated = settingsWith({
	iterationKey: 'iteration',
	startKey: 'start',
	targetKey: 'due',
	stateKey: 'status',
	states: ['Backlog', 'Doing'],
});

/**
 * Three iterations with timeframes of their own and one PBI, built together for
 * `fixture`'s reason: the link only matches by path when both sides come off one build.
 * `Kickoff` carries a start and no target — the iteration that cannot supply an end.
 */
function datedFixture(own: Record<string, unknown> = {}, settings = dated) {
	const vault = new FakeVault();
	vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', start: '2026-09-07', due: '2026-09-20' } });
	vault.addFile('Sprint 13.md', { frontmatter: { type: 'Iteration', start: '2026-09-21', due: '2026-10-04' } });
	vault.addFile('Kickoff.md', { frontmatter: { type: 'Iteration', start: '2026-09-07' } });
	vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10, ...own } });
	const model = buildModel(vault.app, vault.entries(), settings);
	const at = (path: string): BacklogItem => model.byPath.get(path)!;
	return { pbi: at('PBI-1.md'), sprint12: at('Sprint 12.md'), sprint13: at('Sprint 13.md'), kickoff: at('Kickoff.md') };
}

describe('computeIterationWrites — the timeframe', () => {
	it("writes the iteration's dates over whatever the item held", () => {
		// Overwrite, with no branch on what the item states: a sprint's dates ARE the
		// item's dates once it is in the sprint, so a merge or a fill-only-what-is-empty
		// would leave a card outside the band it was just committed to.
		const { pbi, sprint12 } = datedFixture({ start: '2026-05-01', due: '2026-05-30' });

		expect(computeIterationWrites(pbi, sprint12, dated)).toEqual([
			{ file: pbi.file, iteration: sprint12.file, axis: { start: '2026-09-07', target: '2026-09-20' } },
		]);
	});

	it('leaves an end the iteration does not carry alone, rather than deleting it', () => {
		// `undefined`, never `null`: null is a REMOVAL in an `AxisWrite`, so an iteration
		// with no target would delete the item's own target on the way in.
		const { pbi, kickoff } = datedFixture({ start: '2026-05-01', due: '2026-05-30' });

		const [write] = computeIterationWrites(pbi, kickoff, dated);
		expect(write.axis?.target).toBeUndefined();
		expect(write.axis).toEqual({ start: '2026-09-07' });
	});

	it('leaves a reversed span behind rather than refusing the join or moving the target', () => {
		// This write states no `axis.ends`, so the writer's reversed-span guard
		// (`refusesAxis`) never runs on it — deliberately. Refusing would contradict the
		// overwrite rule, and adjusting the item's target is the decision the
		// `undefined`-never-`null` rule forbids: the sprint states no target to adjust it
		// to. The pair lands incoherent, the roadmap shelves the card with its reason, and
		// that is the intended outcome rather than a missed guard.
		const { pbi, kickoff } = datedFixture({ due: '2026-05-30' });

		const [write] = computeIterationWrites(pbi, kickoff, dated);
		// Not refused, and the target is untouched — neither written nor deleted.
		expect(write.axis).toEqual({ start: '2026-09-07' });
		// No `ends`, which is what takes the write past `refusesAxis` unexamined.
		expect(write.axis?.ends).toBeUndefined();
		// And the pair that lands is reversed, by the roadmap's own criterion for it.
		expect(reversedSpan(readDate(write.axis?.start).value, pbi.plannedTarget.value)).toBe(true);
	});

	it('omits a date the item already matches', () => {
		const { pbi, sprint12 } = datedFixture({ start: '2026-09-07', due: '2026-01-01' });

		expect(computeIterationWrites(pbi, sprint12, dated)[0].axis).toEqual({ target: '2026-09-20' });
	});

	it('compares the ends as civil dates, not as text', () => {
		// The comparison the axis writes already make: `2026-9-7` and a datetime suffix
		// both spell the day the sprint starts, so re-syncing must not rewrite either.
		const { pbi, sprint12 } = datedFixture({ start: '2026-9-7', due: '2026-09-20T09:00' });

		expect(computeIterationWrites(pbi, sprint12, dated)).toEqual([{ file: pbi.file, iteration: sprint12.file }]);
	});

	it('writes no date under an unconfigured key', () => {
		const bare = settingsWith({ iterationKey: 'iteration' });
		const { pbi, sprint12 } = datedFixture({ start: '2026-05-01', due: '2026-05-30' }, bare);

		expect(computeIterationWrites(pbi, sprint12, bare)).toEqual([{ file: pbi.file, iteration: sprint12.file }]);
	});

	it('re-syncs the dates when the picked iteration is the one it is already in', () => {
		const { pbi, sprint12 } = datedFixture({ iteration: '[[Sprint 12]]', start: '2026-01-01', due: '2026-01-14' });

		const [write] = computeIterationWrites(pbi, sprint12, dated);
		expect(write.iteration).toBeUndefined();
		expect(write.axis).toEqual({ start: '2026-09-07', target: '2026-09-20' });
	});

	it('plans nothing at all when the link and both ends already agree', () => {
		// Emptiness is what the menu's `None` gate and the undo slot both rest on.
		const { pbi, sprint12 } = datedFixture({ iteration: '[[Sprint 12]]', start: '2026-09-07', due: '2026-09-20' });

		expect(computeIterationWrites(pbi, sprint12, dated)).toEqual([]);
	});

	it('plans the link removal alone for None, leaving the dates', () => {
		// Leaving a sprint is not a reschedule: the item keeps whatever plan it had.
		const { pbi } = datedFixture({ iteration: '[[Sprint 12]]', start: '2026-09-07', due: '2026-09-20' });

		expect(computeIterationWrites(pbi, null, dated)).toEqual([{ file: pbi.file, iteration: null }]);
	});

	// The category invariant, asked of the PLANNER because the menu is one caller of it:
	// "nothing writes a state here" cannot be checked by driving the paths someone thought
	// of, so it is swept over every combination of target and item the planner accepts.
	it('never names a state key, on any path', () => {
		const items: Record<string, unknown>[] = [
			{},
			{ iteration: '[[Sprint 12]]' },
			{ status: 'Doing' },
			{ iteration: '[[Sprint 12]]', status: 'Doing', start: '2026-05-01', due: '2026-05-30' },
		];
		let planned = 0;
		for (const own of items) {
			const fixture = datedFixture(own);
			for (const target of [fixture.sprint12, fixture.sprint13, fixture.kickoff, null]) {
				for (const write of computeIterationWrites(fixture.pbi, target, dated)) {
					planned += 1;
					expect(write.state).toBeUndefined();
					expect(write.removeStateKey).toBeUndefined();
				}
			}
		}
		// Not vacuous: the sweep really did produce writes to inspect.
		expect(planned).toBeGreaterThan(0);
	});
});
