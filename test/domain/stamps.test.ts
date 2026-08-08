import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { computeStateWrites } from '../../src/domain/writePlan';
import { configProblems, resolveSettings } from '../../src/domain/settings';
import { dateStamp, todayStamp } from '../../src/domain/noteFields';
import { FakeVault, FakeViewConfig } from '../helpers/vault';

/**
 * The stamps a state change writes. Every rule here is about a transition, so each
 * test names the state it comes FROM and the one it goes TO — the pair is the whole
 * input, and the bugs this guards against are all pairs someone did not think of.
 */

const TODAY = '2026-08-02';

/**
 * Stamping fully configured: both properties named, one state counting as started.
 * Resolved from view options rather than spread from `defaultSettings()` — the resolver
 * is where the Deliverable lists FOLLOW a falling-back key, so the literal expressed a
 * configuration nobody could set, and `assertResolvedSettings` rejects it now.
 */
const stamped = resolveSettings(
	new FakeViewConfig({
		stateProperty: 'note.status',
		stateValues: 'New, Active, Done',
		doneValues: 'Done',
		startedStates: 'Active',
		startedDateProperty: 'note.started',
		finishedDateProperty: 'note.finished',
	}) as never,
);

/** An item holding `state`, plus whatever else its note already says. */
function item(state: string | null, extra: Record<string, unknown> = {}) {
	const vault = new FakeVault();
	vault.addFile('A.md', {
		frontmatter: { type: 'Epic', order: 10, ...(state !== null ? { status: state } : {}), ...extra },
	});
	return buildModel(vault.app, vault.entries(), stamped).results[0];
}

/** The single write a state change plans — the stamps ride it rather than following. */
function plan(from: string | null, to: string | null, settings = stamped) {
	return computeStateWrites(item(from), to, settings, TODAY)[0];
}

describe('stamping the start', () => {
	it('writes the date when a card enters a started state', () => {
		expect(plan('New', 'Active')?.startedDate).toBe(TODAY);
	});

	it('offers it every time, and leaves keeping the earliest to the writer', () => {
		// The planner cannot answer "already started?" honestly — the row it reads can be
		// a refresh behind the note — so it always offers and the write boundary decides.
		expect(plan('Done', 'Active')?.startedDate).toBe(TODAY);
	});

	it('offers no start for a state that counts as neither started nor done', () => {
		expect(plan('Active', 'New').startedDate).toBeUndefined();
	});

	it('stamps nothing at all until a started state is named', () => {
		// Naming the property is not naming the states: a first column is a backlog as
		// often as it is a start, and a guess would date work nobody began.
		expect(plan('New', 'Active', { ...stamped, startedStates: [] }).startedDate).toBeUndefined();
	});

	it('stamps nothing when the property is unnamed, whatever the states say', () => {
		expect(plan('New', 'Active', { ...stamped, startedDateKey: '' }).startedDate).toBeUndefined();
	});
});

describe('stamping the finish', () => {
	it('carries the date and whether the target state is done', () => {
		// The plan does NOT decide the crossing. Which way it goes — in, out, or a
		// done-to-done re-label that changes nothing — needs the state the NOTE is in,
		// and only the writer sees that. The model can be a refresh behind.
		expect(plan('Active', 'Done')?.finish).toEqual({ date: TODAY, toDone: true });
		expect(plan('Done', 'Active')?.finish).toEqual({ date: TODAY, toDone: false });
	});

	it('reads done-ness of the target case-insensitively, like every other match', () => {
		expect(plan('New', 'done', { ...stamped, states: ['New', 'done'] })?.finish?.toDone).toBe(true);
	});

	it('treats the no-state target as not done', () => {
		expect(plan('Done', null)?.finish).toEqual({ date: TODAY, toDone: false });
	});

	it('is absent when the property is unnamed, so nothing is written', () => {
		expect(plan('Active', 'Done', { ...stamped, finishedDateKey: '' }).finish).toBeUndefined();
	});
});

describe('stamps and the state write they ride', () => {
	it('are fields of the state write, never a second write', () => {
		// One file, one processFrontMatter call — which is what makes one undo take back
		// the state and its dates together.
		const writes = computeStateWrites(item('New'), 'Active', stamped, TODAY);
		expect(writes).toHaveLength(1);
		expect(writes[0].state).toBe('Active');
		expect(writes[0].startedDate).toBe(TODAY);
	});

	it('plans nothing at all when the state does not change', () => {
		// The no-op contract predates stamping and outranks it: a batch that writes
		// nothing must not cost the user the undo of the change before it.
		expect(computeStateWrites(item('Active'), 'Active', stamped, TODAY)).toEqual([]);
	});

	it('carries both stamps when one move can cross both boundaries', () => {
		const write = computeStateWrites(item('Done'), 'Active', { ...stamped, startedStates: ['Active'] }, TODAY)[0];
		expect(write.startedDate).toBe(TODAY);
		expect(write.finish).toEqual({ date: TODAY, toDone: false });
	});
});

describe('a stamp property naming a key the plugin owns', () => {
	const collides = (extra: Partial<typeof stamped>) => configProblems({ ...stamped, ...extra });

	it('is refused when it takes the parent, order, type or state key', () => {
		expect(collides({ startedDateKey: 'parent' })[0]).toContain('parent');
		expect(collides({ finishedDateKey: 'order' })[0]).toContain('order');
		expect(collides({ startedDateKey: 'type' })[0]).toContain('type');
		expect(collides({ finishedDateKey: 'status' })[0]).toContain('state');
	});

	it('is refused when it takes the tags key', () => {
		expect(collides({ startedDateKey: 'tags' })[0]).toContain('tags');
	});

	it('is refused when the two stamps share one key', () => {
		expect(collides({ startedDateKey: 'when', finishedDateKey: 'when' })).toHaveLength(1);
	});

	it('leaves a working view alone when nothing collides', () => {
		expect(collides({})).toEqual([]);
	});

	it('still reports nothing for a base whose tags property is its state property', () => {
		// The resolver turns a colliding tags key off, and an off key is not a collision:
		// reporting one here would make a view that worked before these options existed
		// read-only.
		expect(configProblems({ ...stamped, tagsKey: '' })).toEqual([]);
	});
});

describe('the stamp value', () => {
	it('is the local date, not the UTC one', () => {
		// 23:30 on the 2nd, for anyone west of Greenwich, is still the 2nd — toISOString
		// would call it the 3rd and date the work to a day the user had not reached.
		const evening = new Date(2026, 7, 2, 23, 30);
		expect(dateStamp(evening)).toBe('2026-08-02');
	});

	it('pads month and day to the shape Obsidian parses', () => {
		expect(dateStamp(new Date(2026, 0, 9))).toBe('2026-01-09');
	});

	it('reads the clock exactly once, in todayStamp', () => {
		expect(todayStamp()).toBe(dateStamp(new Date()));
	});
});
