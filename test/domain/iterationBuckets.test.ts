import { describe, expect, it } from 'vitest';
import { bucketOf, bucketRepresentative, iterationBuckets } from '../../src/domain/board';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { BacklogSettings } from '../../src/domain/settings';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { FakeVault, FakeViewConfig } from '../helpers/vault';

/**
 * The three columns an iteration board narrows the PRODUCT workflow into. Nothing here
 * knows what an iteration is: a bucket is a reading of one state value, and the
 * population is whatever the caller hands over — which is what lets the rule be asked of
 * a function rather than of a screen.
 *
 * Resolved from view options rather than spread from a literal, for `board.test.ts`'
 * reason: the resolver is where lists follow one another, so a hand-written settings
 * object can express a configuration nobody could set.
 */
function iterationSettings(extra: Record<string, unknown> = {}): BacklogSettings {
	return resolveSettings(
		new FakeViewConfig({
			stateProperty: 'note.status',
			stateValues: 'New, Ready, Doing, In review, Done',
			doneValues: 'Done',
			iterationOpenStates: 'New, Ready',
			iterationResolvedStates: 'In review',
			...extra,
		}),
	);
}

const settings = iterationSettings();

/**
 * One item per state, built through the real model so a card here is the object the
 * board actually receives — a hand-written `BacklogItem` would let a field the rule
 * reads be quietly absent. A `null` state is a note with no `status` key at all.
 */
function cards(states: (string | null)[], settingsUsed: BacklogSettings = settings): BacklogItem[] {
	const vault = new FakeVault();
	states.forEach((state, i) => {
		vault.addFile(`Item ${i}.md`, {
			frontmatter: { type: 'PBI', order: (i + 1) * 10, ...(state === null ? {} : { status: state }) },
		});
	});
	return buildModel(vault.app, vault.entries(), settingsUsed).results;
}

/** A card the Base excluded, carrying a state of its own — placement, never population. */
function contextCard(state: string): BacklogItem {
	const vault = new FakeVault();
	vault.addFile('Excluded.md', { frontmatter: { type: 'PBI', order: 10, status: state } });
	vault.addFile('Child.md', { frontmatter: { type: 'Task', order: 10, status: 'Doing' }, parentLink: 'Excluded' });
	const model = buildModel(
		vault.app,
		vault.entries().filter((e) => e.file.path !== 'Excluded.md'),
		settings,
	);
	const context = model.byPath.get('Excluded.md');
	if (!context?.outsideFilter) throw new Error('fixture did not produce a context row');
	return context;
}

describe('bucketOf', () => {
	it('puts every declared state and the no-state case in exactly one bucket', () => {
		const seen = ['New', 'Ready', 'Doing', 'In review', 'Done', null].map((s) => bucketOf(s, settings));
		expect(seen).toEqual(['open', 'open', 'inProgress', 'resolved', 'resolved', 'open']);
	});

	it('folds the product done values into Resolved without the list naming them', () => {
		expect(bucketOf('Done', iterationSettings({ iterationResolvedStates: '' }))).toBe('resolved');
	});

	it('gives Resolved precedence over Open for a state in both lists', () => {
		const both = iterationSettings({ iterationOpenStates: 'New', iterationResolvedStates: 'New' });
		expect(bucketOf('New', both)).toBe('resolved');
	});

	it('reads a state neither list names as In Progress, minting no column for it', () => {
		expect(bucketOf('Blocked', settings)).toBe('inProgress');
	});
});

describe('bucketRepresentative', () => {
	it('answers the first state that reads back into its own bucket', () => {
		expect(bucketRepresentative('open', settings)).toBe('New');
		expect(bucketRepresentative('inProgress', settings)).toBe('Doing');
		expect(bucketRepresentative('resolved', settings)).toBe('In review');
	});

	it('skips an open state that the precedence rule routes to Resolved', () => {
		const trap = iterationSettings({ iterationOpenStates: 'Done, Ready' });
		expect(bucketRepresentative('open', trap)).toBe('Ready');
	});

	it('falls Open back to a key removal when no entry survives', () => {
		const trap = iterationSettings({ iterationOpenStates: 'Done' });
		expect(bucketRepresentative('open', trap)).toBeNull();
	});

	it('answers undefined — no drop — for In progress when the outer lists claim every state', () => {
		const claimed = iterationSettings({ iterationOpenStates: 'New, Ready, Doing' });
		expect(bucketRepresentative('inProgress', claimed)).toBeUndefined();
	});

	it('always has a representative for Resolved, whatever is configured', () => {
		// The third answer is in the TYPE for all three buckets and only two can reach it:
		// `resolveSettings` falls `doneValues` back to the shipped list when nobody sets
		// one, so a vault with no done values is not a configuration anybody can express —
		// and every done value routes to Resolved by the precedence rule. The narrower
		// sentence rather than the tidier one: this is checked, "no bucket ever loses its
		// drop unexpectedly" is not.
		for (const extra of [{}, { iterationResolvedStates: '' }, { iterationResolvedStates: 'New' }]) {
			expect(bucketRepresentative('resolved', iterationSettings(extra))).not.toBeUndefined();
		}
	});

	it('falls Resolved back to the first done value with no list set', () => {
		expect(bucketRepresentative('resolved', iterationSettings({ iterationResolvedStates: '' }))).toBe('Done');
	});
});

describe('iterationBuckets', () => {
	it('draws exactly three columns, marks Resolved done, and mints no stray', () => {
		const board = iterationBuckets(cards(['New', 'Blocked', 'Done']), settings);
		expect(board.columns.map((c) => c.label)).toEqual(['Open', 'In progress', 'Resolved']);
		expect(board.columns.map((c) => c.done)).toEqual([false, false, true]);
		expect(board.columns.some((c) => c.outsideWorkflow)).toBe(false);
	});

	it('counts only the population it was handed', () => {
		expect(iterationBuckets(cards(['New']), settings).cardCount).toBe(1);
	});

	it('never counts a context card', () => {
		const board = iterationBuckets([...cards(['New']), contextCard('Ready')], settings);
		expect(board.columns[0].count).toBe(1);
	});

	it('keys two columns holding no state apart', () => {
		// Both hold `state: null` and they mean OPPOSITE things — Open's is a key removal
		// to write, In progress's is nothing to write at all. `state` is the only field
		// the fold key had before `bucket` existed, and `columnKey` lowercases
		// `state ?? ''`, so a key built from it alone folds the two as ONE column.
		//
		// Reachable, not contrived: a vault whose whole vocabulary is finished states, and
		// whose Open list names one of them, gets exactly this board.
		const both = iterationSettings({ stateValues: 'New, In review', iterationResolvedStates: 'New, In review', iterationOpenStates: 'New' });
		const board = iterationBuckets(cards([], both), both);
		const stateless = board.columns.filter((c) => c.state === null);
		expect(stateless.map((c) => c.bucket)).toEqual(['open', 'inProgress']);
		expect(stateless.map((c) => c.takesDrop)).toEqual([true, false]);
	});

	it('marks a bucket with nothing to write as taking no drop', () => {
		const claimed = iterationSettings({ iterationOpenStates: 'New, Ready, Doing' });
		expect(iterationBuckets(cards([], claimed), claimed).columns.map((c) => c.takesDrop)).toEqual([true, false, true]);
	});

	it('leaves every product-board column taking drops', () => {
		// The other two boards have no bucket and every column writes a state, so nothing
		// there may be silently un-wired by the field this task adds.
		const board = iterationBuckets(cards(['New']), settings);
		expect(board.columns.every((c) => c.takesDrop)).toBe(true);
	});
});
