import { describe, expect, it } from 'vitest';
import { BacklogItem, BacklogModel, buildModel } from '../../src/domain/model';
import { BacklogSettings, defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

/**
 * What a marker does to everything around it: nothing. Split out of `model.test.ts` and
 * `roadmap.test.ts` by subject — both were within a handful of lines of the 450-line test
 * budget, and the one suite without a cap is the one that grows.
 */

const settings = defaultSettings();
/** The span-rollup fixture's own settings, copied exactly: both date keys, plus state. */
const dated = { ...settings, startKey: 'start', targetKey: 'due', stateKey: 'status' };

/** One note, as a title and the frontmatter it carries — `parent` is a bare title. */
function note(title: string, frontmatter: Record<string, unknown>): [string, Record<string, unknown>] {
	return [title, frontmatter];
}

function buildModelFrom(notes: [string, Record<string, unknown>][], config: BacklogSettings = dated): BacklogModel {
	const vault = new FakeVault();
	for (const [title, frontmatter] of notes) vault.addFile(`${title}.md`, { frontmatter });
	return buildModel(vault.app, vault.entries(), config);
}

describe('a marker aggregates into nothing', () => {
	it('is never counted by an ancestor’s progress rollup', () => {
		// Never counted is a rule about AGGREGATION. A point in time contains no work, so
		// its own status must neither advance a progress figure nor keep a finished
		// subtree on screen. This is the second exception to "a rollup counts every
		// descendant the Base returned"; the first is the context row, and they sit on the
		// same line for the same reason.
		// `subtreeDone` is `item.done && doneDescendants === descendantCount` — the epic
		// itself has to be Done too, or the AND is false either way and the marker's
		// effect on the count is never the thing that flips this assertion.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic', status: 'Done' }),
			note('A story', { type: 'PBI', parent: 'An epic', status: 'Done' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'An epic', status: 'Open' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		expect(epic.descendantCount).toBe(1);
		expect(epic.doneDescendants).toBe(1);
		// The marker being open must not keep the epic's subtree on screen.
		expect(epic.subtreeDone).toBe(true);
	});

	it('is never evidence for an ancestor’s inferred span', () => {
		// A release date hand-placed under an epic must not become the end of that epic's
		// inferred bar — precisely the reading a dateless ancestor takes from a dated
		// descendant. Having a parent makes a marker neither countable nor datable.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'An epic', due: '2026-12-01' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		expect(epic.descendantStart).toBeNull();
		expect(epic.descendantTarget).toBeNull();
	});

	it('is traversed THROUGH: results hand-nested below one still reach their ancestors', () => {
		// The marker is skipped, not its subtree — the context row's exact shape. A work
		// item somebody filed under a milestone is still this base's work.
		const model = buildModelFrom([
			note('An epic', { type: 'Epic' }),
			note('Ship 1.0', { type: 'Milestone', parent: 'An epic' }),
			note('Prep', { type: 'PBI', parent: 'Ship 1.0', due: '2026-09-01' }),
		]);
		const epic = model.byPath.get('An epic.md') as BacklogItem;
		expect(epic.descendantCount).toBe(1);
		expect(epic.descendantTarget).toEqual({ year: 2026, month: 9, day: 1 });
	});
});
