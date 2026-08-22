import { describe, expect, it } from 'vitest';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

describe('applyWrites', () => {
	it('writes wikilink parents, deletes cleared parents, and sets order/type', async () => {
		const vault = new FakeVault();
		const epic = vault.addFile('Epic.md');
		const child = vault.addFile('Child.md', { frontmatter: { parent: '[[Old]]', order: 1 } });

		await applyWrites(vault.app, settings, [
			{ file: child, parent: epic, order: 15, typeName: 'Feature' },
		]);
		expect(vault.fm('Child.md')).toEqual({ parent: '[[Epic]]', order: 15, type: 'Feature' });

		await applyWrites(vault.app, settings, [{ file: child, parent: null }]);
		expect(vault.fm('Child.md')).toEqual({ order: 15, type: 'Feature' });
	});

	it('reports progress after each file, knowing the total from the start', async () => {
		const vault = new FakeVault();
		const files = ['A.md', 'B.md', 'C.md'].map((p) => vault.addFile(p));
		const ticks: string[] = [];

		await applyWrites(
			vault.app,
			settings,
			files.map((file, i) => ({ file, order: (i + 1) * 10 })),
			(done, total) => ticks.push(`${done}/${total}`),
		);

		// One tick per file, after that file is on disk — so a caller can report
		// real progress rather than an estimate.
		expect(ticks).toEqual(['1/3', '2/3', '3/3']);
		expect(vault.writeLog).toHaveLength(3);
	});

	it('writes the state to the configured key, and never to an empty key', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { status: 'Open' } });

		await applyWrites(vault.app, { ...settings, stateKey: 'status' }, [{ file: item, state: 'Done' }]);
		expect(vault.fm('Item.md')).toEqual({ status: 'Done' });

		// Without a configured state property the write is dropped, not misfiled.
		await applyWrites(vault.app, settings, [{ file: item, state: 'Open' }]);
		expect(vault.fm('Item.md')).toEqual({ status: 'Done' });
	});

	it('creates a stub for each configured optional key, and never for one no property names', async () => {
		const vault = new FakeVault();
		const configured = { ...settings, stateKey: 'status', horizonKey: 'horizon' };
		const item = vault.addFile('Item.md', { frontmatter: { order: 5 } });
		const inverses: RestoreWrite[] = [];

		// `startedDate` is unconfigured here: dropped, not misfiled — the state key's own
		// rule, applied to the one write that creates keys rather than setting them.
		await applyWrites(
			vault.app,
			configured,
			[{ file: item, stubs: ['state', 'startedDate', 'horizon'] }],
			undefined,
			(inv) => inverses.push(inv),
		);
		expect(vault.fm('Item.md')).toEqual({ order: 5, status: '', horizon: '' });

		// Captured like every other write, so one undo takes the whole backfill back.
		await applyRestores(vault.app, inverses);
		expect(vault.fm('Item.md')).toEqual({ order: 5 });
	});

	it('never stubs a start key onto a note the vault retyped to Milestone since the plan', async () => {
		const vault = new FakeVault();
		const configured = { ...settings, startKey: 'start', targetKey: 'due' };
		// The plan was built against an ordinary item and still carries its start stub;
		// the note has since been retyped to a point type that answers for `target` alone.
		const item = vault.addFile('Item.md', { frontmatter: { type: 'Milestone', order: 5 } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, configured, [{ file: item, stubs: ['start', 'target'] }], undefined, (inv) =>
			inverses.push(inv),
		);

		// `schemaEnds` narrows this the same way it narrows the plan: a Milestone's note
		// gains no start property, whatever a stale row asked for.
		expect(vault.fm('Item.md')).toEqual({ type: 'Milestone', order: 5, due: '' });
	});

	it('leaves a key the note already carries exactly as it is, whatever it holds', async () => {
		const vault = new FakeVault();
		const configured = { ...settings, stateKey: 'status', horizonKey: 'horizon' };
		const item = vault.addFile('Item.md', { frontmatter: { status: 'Active', horizon: '' } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, configured, [{ file: item, stubs: ['state', 'horizon'] }], undefined, (inv) =>
			inverses.push(inv),
		);

		// Presence is the question, and it is asked of the live note: a value is never
		// blanked, an empty key is not rewritten, and a write that changed nothing emits
		// no inverse — so a backfill over a settled backlog cannot cost the undo slot.
		expect(vault.fm('Item.md')).toEqual({ status: 'Active', horizon: '' });
		expect(inverses).toEqual([]);
	});

	it('removeStateKey deletes the key, and the captured inverse puts the value back', async () => {
		const vault = new FakeVault();
		const stated = { ...settings, stateKey: 'status' };
		const item = vault.addFile('Item.md', { frontmatter: { status: 'Active', order: 5 } });
		const inverses: RestoreWrite[] = [];

		// The no-state column's drop: absence, never an empty string.
		await applyWrites(vault.app, stated, [{ file: item, removeStateKey: true }], undefined, (inv) =>
			inverses.push(inv),
		);
		expect(vault.fm('Item.md')).toEqual({ order: 5 });

		// Absence is first-class in the restore machinery: undo restores the value.
		expect(inverses).toHaveLength(1);
		await applyRestores(vault.app, inverses);
		expect(vault.fm('Item.md')).toEqual({ status: 'Active', order: 5 });

		// Removing an already absent key changes nothing and emits no inverse —
		// it must not cost the caller's single undo slot.
		const again: RestoreWrite[] = [];
		await applyWrites(
			vault.app,
			stated,
			[{ file: vault.addFile('Bare.md'), removeStateKey: true }],
			undefined,
			(inv) => again.push(inv),
		);
		expect(again).toHaveLength(0);
	});

	it('writes the horizon on its own key, and removes it with a restorable inverse', async () => {
		const vault = new FakeVault();
		const planned = { ...settings, horizonKey: 'horizon' };
		const item = vault.addFile('Item.md', { frontmatter: { order: 5 } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, planned, [{ file: item, axis: { horizon: 'Next' } }]);
		expect(vault.fm('Item.md')).toEqual({ order: 5, horizon: 'Next' });

		// The shelf's drop: absence, never an empty string — and undo puts it back.
		await applyWrites(vault.app, planned, [{ file: item, axis: { horizon: null } }], undefined, (inv) =>
			inverses.push(inv),
		);
		expect(vault.fm('Item.md')).toEqual({ order: 5 });
		await applyRestores(vault.app, inverses);
		expect(vault.fm('Item.md')).toEqual({ order: 5, horizon: 'Next' });

		// Without a configured horizon property the write is dropped, not misfiled —
		// the state key's rule, because it is the same rule.
		await applyWrites(vault.app, settings, [{ file: item, axis: { horizon: 'Now' } }]);
		expect(vault.fm('Item.md')).toEqual({ order: 5, horizon: 'Next' });
	});

	it('writes a date-shaped horizon as the label it is, not as a date', async () => {
		const vault = new FakeVault();
		const planned = { ...settings, horizonKey: 'horizon' };
		// A horizon is a user-typed label and `readDate` accepts a trailing group, so
		// `2026-08-01 Planning` parses as a civil date with a suffix. Treated as one, the
		// re-pick check below compares equal and skips the write, and the shape merge
		// carries ` Planning` onto whatever replaces it. The axis fields share a writer,
		// not a meaning.
		const item = vault.addFile('Item.md', { frontmatter: { horizon: '2026-08-01 Planning' } });

		await applyWrites(vault.app, planned, [{ file: item, axis: { horizon: '2026-08-01 Review' } }]);

		expect(vault.fm('Item.md')).toEqual({ horizon: '2026-08-01 Review' });
	});

	it('reports what landed when a later write in the batch is refused', async () => {
		const vault = new FakeVault();
		const dated = { ...settings, startKey: 'start' };
		const first = vault.addFile('First.md', { frontmatter: { start: '2026-08-01' } });
		// The second write states a baseline the note does not hold, so the writer refuses
		// it — but the first has already landed and emitted its inverse. Reporting
		// `changed: false` there would tell the caller, and the announcement, that a
		// change nobody can undo away did not happen.
		const second = vault.addFile('Second.md', { frontmatter: { start: '2026-08-05' } });
		const inverses: RestoreWrite[] = [];

		const outcome = await applyWrites(
			vault.app,
			dated,
			[
				{ file: first, axis: { start: '2026-08-02', ends: ['start', 'target'] } },
				{ file: second, axis: { start: '2026-08-09', ends: ['start', 'target'], from: { start: '2026-08-04' } } },
			],
			undefined,
			(inv) => inverses.push(inv),
		);

		expect(outcome.changed).toBe(true);
		expect(vault.fm('First.md')).toEqual({ start: '2026-08-02' });
		expect(vault.fm('Second.md')).toEqual({ start: '2026-08-05' });
		// And what landed is undoable, which is the whole reason it must be reported.
		expect(inverses).toHaveLength(1);
	});

	it('carries a state and a horizon change in one write, each on its own key', async () => {
		const vault = new FakeVault();
		const both = { ...settings, stateKey: 'status', horizonKey: 'horizon' };
		const item = vault.addFile('Item.md', { frontmatter: { status: 'New', horizon: 'Now' } });

		await applyWrites(vault.app, both, [{ file: item, state: 'Active', axis: { horizon: null } }]);
		expect(vault.fm('Item.md')).toEqual({ status: 'Active' });
	});

	it('applies tag deltas to what the note holds, and drops the key when it empties', async () => {
		const vault = new FakeVault();
		const tagged = { ...settings, tagsKey: 'tags' };
		const item = vault.addFile('Item.md', { frontmatter: { tags: 'alpha beta' } });

		await applyWrites(vault.app, tagged, [{ file: item, tags: { add: ['gamma'] } }]);
		// Always written back as a list, whatever shape the note held before
		expect(vault.fm('Item.md')).toEqual({ tags: ['alpha', 'beta', 'gamma'] });

		await applyWrites(vault.app, tagged, [{ file: item, tags: { remove: ['alpha', 'gamma'] } }]);
		expect(vault.fm('Item.md')).toEqual({ tags: ['beta'] });

		await applyWrites(vault.app, tagged, [{ file: item, tags: { remove: ['BETA'] } }]);
		expect(vault.fm('Item.md')).toEqual({});

		// Without a configured tags property the write is dropped, not misfiled.
		await applyWrites(vault.app, { ...settings, tagsKey: '' }, [{ file: item, tags: { add: ['x'] } }]);
		expect(vault.fm('Item.md')).toEqual({});
	});

	it('leaves the note alone when the delta changes nothing', async () => {
		const vault = new FakeVault();
		const tagged = { ...settings, tagsKey: 'tags' };
		const item = vault.addFile('Item.md', { frontmatter: { tags: 'alpha beta' } });

		await applyWrites(vault.app, tagged, [{ file: item, tags: { add: ['alpha'], remove: ['gamma'] } }]);
		// Still the original string: a no-op delta must not restyle the value
		expect(vault.fm('Item.md')).toEqual({ tags: 'alpha beta' });
	});

	it('removeParentKey deletes the property even in folder mode', async () => {
		const vault = new FakeVault();
		const child = vault.addFile('Epic/Child.md', { frontmatter: { parent: '[[Elsewhere]]' } });

		await applyWrites(vault.app, { ...settings, folderHierarchy: true }, [
			{ file: child, removeParentKey: true },
		]);

		// Unlike parent: null, this reverts the item to folder-note inference
		expect('parent' in vault.fm('Epic/Child.md')).toBe(false);
	});

	it('pins folder-mode top-level moves with an empty parent value', async () => {
		const vault = new FakeVault();
		const child = vault.addFile('Epic/Child.md', { frontmatter: { parent: '[[Epic]]' } });

		await applyWrites(vault.app, { ...settings, folderHierarchy: true }, [{ file: child, parent: null }]);

		// Deleting the key would just re-infer the folder parent on the next build
		expect(vault.fm('Epic/Child.md')).toEqual({ parent: '' });
	});
});

/** Both stamp properties named, so the writer has somewhere to put them. */
const stamping = { ...settings, stateKey: 'status', startedDateKey: 'started', finishedDateKey: 'finished' };

describe('applying date stamps', () => {
	it('stamps the start beside the state, in one write', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'New' } });

		await applyWrites(vault.app, stamping, [{ file, state: 'Active', startedDate: '2026-08-02' }]);

		expect(vault.fm('A.md')).toEqual({ status: 'Active', started: '2026-08-02' });
		// One processFrontMatter call, not two: a stamp is never a second write.
		expect(vault.writeLog).toHaveLength(1);
	});

	it('keeps the earliest start, deciding against the live value', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'Done', started: '2026-01-15' } });

		// Rework: back into a started state, with a start already on the note. The
		// planner offers the date every time and the writer is what declines it, so the
		// measure keeps reporting the age of the work rather than the last restart.
		await applyWrites(vault.app, stamping, [{ file, state: 'Active', startedDate: '2026-08-02' }]);

		expect(vault.fm('A.md')['started']).toBe('2026-01-15');
	});

	it('stamps no start when the note is already in the state being written', async () => {
		// The model still said New; the note is already Active, with no start recorded.
		// Picking Active writes a state the note already holds — no transition happened,
		// so dating one would record a redundant selection rather than the moment work
		// began, and spend the undo slot on it.
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'Active' } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, stamping, [{ file, state: 'Active', startedDate: '2026-08-02' }], undefined, (inv) =>
			inverses.push(inv),
		);

		expect('started' in vault.fm('A.md')).toBe(false);
		expect(inverses).toEqual([]);
	});

	it('compares that state case-insensitively, like every other state match', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'active' } });

		await applyWrites(vault.app, stamping, [{ file, state: 'Active', startedDate: '2026-08-02' }]);

		expect('started' in vault.fm('A.md')).toBe(false);
	});

	it('treats an empty start property as no start at all', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'New', started: '  ' } });

		await applyWrites(vault.app, stamping, [{ file, state: 'Active', startedDate: '2026-08-02' }]);

		expect(vault.fm('A.md')['started']).toBe('2026-08-02');
	});

	it('treats an emptied list property as no start at all', async () => {
		// Obsidian writes an emptied list property as `[]`, and the date readers call
		// that absence. Reading it as a date already recorded would decline the stamp
		// forever — write-once protecting a value that is not there.
		const vault = new FakeVault();
		const empty = vault.addFile('A.md', { frontmatter: { status: 'New', started: [] } });
		const blank = vault.addFile('B.md', { frontmatter: { status: 'New', started: [''] } });

		await applyWrites(vault.app, stamping, [
			{ file: empty, state: 'Active', startedDate: '2026-08-02' },
			{ file: blank, state: 'Active', startedDate: '2026-08-02' },
		]);

		expect(vault.fm('A.md')['started']).toBe('2026-08-02');
		expect(vault.fm('B.md')['started']).toBe('2026-08-02');
	});

	it('leaves a list that actually holds a date alone', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'New', started: ['2026-01-15'] } });

		await applyWrites(vault.app, stamping, [{ file, state: 'Active', startedDate: '2026-08-02' }]);

		expect(vault.fm('A.md')['started']).toEqual(['2026-01-15']);
	});

	it('declines to stamp over a start already holding a boolean, not just a string or a list', async () => {
		// `isBlank`'s own comment states the rule this protects: write-once, so a key
		// already holding SOMETHING must decline a second stamp. A boolean is a plausible
		// vault shape here — Obsidian's Checkbox property type is exactly this, and a
		// reader could have the started key pointed at one before ever configuring this
		// plugin's stamping. `isBlank`'s fallthrough (neither undefined/null, string, nor
		// array) has to answer `false` for it, or this counts as no start yet and the
		// stamp overwrites a value the note already carries.
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'New', started: true } });

		await applyWrites(vault.app, stamping, [{ file, state: 'Active', startedDate: '2026-08-02' }]);

		expect(vault.fm('A.md')['started']).toBe(true);
	});

	it('treats a date property inherited from Object as absent', async () => {
		// `toString` is a legal frontmatter name. On a note that lacks it, `fm.toString`
		// is the inherited FUNCTION — truthy, so a blank test reads it as a date already
		// recorded and declines the stamp forever. This hazard has shipped three times in
		// this codebase on other tables; it is why every configured-key read goes through
		// `ownValue`.
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'New' } });

		await applyWrites(vault.app, { ...stamping, startedDateKey: 'toString' }, [
			{ file, state: 'Active', startedDate: '2026-08-02' },
		]);

		const fm = vault.fm('A.md');
		expect(Object.prototype.hasOwnProperty.call(fm, 'toString')).toBe(true);
		expect(fm['toString']).toBe('2026-08-02');
	});

	it('creates a `__proto__` date property instead of hitting the prototype setter', async () => {
		// `__proto__` is a legal frontmatter name. Plain assignment reaches
		// Object.prototype's setter, which ignores a string outright — so the state
		// would change and its transition date vanish, with nothing to notice.
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'New' } });

		await applyWrites(vault.app, { ...stamping, startedDateKey: '__proto__' }, [
			{ file, state: 'Active', startedDate: '2026-08-02' },
		]);

		const fm = vault.fm('A.md');
		expect(Object.prototype.hasOwnProperty.call(fm, '__proto__')).toBe(true);
		expect(Object.getOwnPropertyDescriptor(fm, '__proto__')?.value).toBe('2026-08-02');
		expect(fm['status']).toBe('Active');
	});

	it('keeps a `__proto__` tag list a list, rather than the object’s prototype', async () => {
		// The worst shape of the same bug: assigning an ARRAY to `__proto__` does not
		// drop the write, it replaces the object's prototype.
		const vault = new FakeVault();
		const file = vault.addFile('A.md', {});

		await applyWrites(vault.app, { ...stamping, tagsKey: '__proto__' }, [{ file, tags: { add: ['spike'] } }]);

		const fm = vault.fm('A.md');
		expect(Object.getOwnPropertyDescriptor(fm, '__proto__')?.value).toEqual(['spike']);
		expect(Object.getPrototypeOf(fm)).toBe(Object.prototype);
	});

	it('stamps the finish on crossing INTO done', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'Active' } });

		await applyWrites(vault.app, stamping, [{ file, state: 'Done', finish: { date: '2026-08-02', toDone: true } }]);

		expect(vault.fm('A.md')['finished']).toBe('2026-08-02');
	});

	it('leaves the finish alone done-to-done — a re-label is not a new finish', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'Done', finished: '2026-07-01' } });
		const settings = { ...stamping, doneValues: ['Done', 'Dropped'] };

		await applyWrites(vault.app, settings, [{ file, state: 'Dropped', finish: { date: '2026-08-02', toDone: true } }]);

		// Moving the date forward would rewrite the item's history to say the work took
		// longer than it did.
		expect(vault.fm('A.md')['finished']).toBe('2026-07-01');
	});

	it('removes the finish on crossing OUT of done', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'Done', finished: '2026-07-01' } });

		await applyWrites(vault.app, stamping, [{ file, state: 'Active', finish: { date: '2026-08-02', toDone: false } }]);

		expect('finished' in vault.fm('A.md')).toBe(false);
	});

	it('judges the crossing on the note’s state, not the one the plan came from', async () => {
		// The model said Active; the note is already Done, finished, by an edit the view
		// has not seen yet. Moving it to New is a crossing OUT however stale the row was,
		// and a New note carrying a finished date is exactly the lie the rule forbids.
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'Done', finished: '2026-07-01' } });

		await applyWrites(vault.app, stamping, [{ file, state: 'New', finish: { date: '2026-08-02', toDone: false } }]);

		expect(vault.fm('A.md')['status']).toBe('New');
		expect('finished' in vault.fm('A.md')).toBe(false);
	});

	it('reads the live state as tolerantly as the model does', async () => {
		// `status: [Done]` is a state the model reads as "Done" — a one-item list is one
		// of the shapes frontmatter takes. Reading it more strictly here would answer
		// "no state" to a question the model answers "Done", and the boundary rule would
		// believe the wrong one: reopening would keep a finish, and a re-label would
		// overwrite the original date.
		const vault = new FakeVault();
		const listed = vault.addFile('A.md', { frontmatter: { status: ['Done'], finished: '2026-07-01' } });
		const numeric = vault.addFile('B.md', { frontmatter: { status: 1, finished: '2026-07-01' } });

		await applyWrites(vault.app, { ...stamping, doneValues: ['Done', '1'] }, [
			{ file: listed, state: 'Active', finish: { date: '2026-08-02', toDone: false } },
			{ file: numeric, state: 'Active', finish: { date: '2026-08-02', toDone: false } },
		]);

		expect('finished' in vault.fm('A.md')).toBe(false);
		expect('finished' in vault.fm('B.md')).toBe(false);
	});

	it('does not re-stamp a finish a list-valued state already crossed into', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: ['Done'], finished: '2026-07-01' } });
		const settings = { ...stamping, doneValues: ['Done', 'Dropped'] };

		await applyWrites(vault.app, settings, [{ file, state: 'Dropped', finish: { date: '2026-08-02', toDone: true } }]);

		expect(vault.fm('A.md')['finished']).toBe('2026-07-01');
	});

	it('does not re-stamp a finish the note already crossed into', async () => {
		// The mirror: the model said Active, the note is already Done. Writing Done again
		// is not a new finish, so the original date stands.
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'Done', finished: '2026-07-01' } });

		await applyWrites(vault.app, stamping, [{ file, state: 'Done', finish: { date: '2026-08-02', toDone: true } }]);

		expect(vault.fm('A.md')['finished']).toBe('2026-07-01');
	});

	it('writes no stamp to a property the user has not named', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'New' } });

		// Every part of stamping is opt-in — an unnamed property is not one with a
		// default name, so the date has nowhere to go and goes nowhere.
		await applyWrites(vault.app, { ...settings, stateKey: 'status' }, [
			{ file, state: 'Active', startedDate: '2026-08-02', finish: { date: '2026-08-02', toDone: true } },
		]);

		expect(vault.fm('A.md')).toEqual({ status: 'Active' });
	});

	it('takes the state and its dates back as one undo', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { status: 'Active', started: '2026-01-15' } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(
			vault.app,
			stamping,
			[{ file, state: 'Done', finish: { date: '2026-08-02', toDone: true } }],
			undefined,
			(inv) => inverses.push(inv),
		);
		expect(vault.fm('A.md')).toEqual({ status: 'Done', started: '2026-01-15', finished: '2026-08-02' });

		// One inverse covers both keys, because both rode one write.
		expect(inverses).toHaveLength(1);
		await applyRestores(vault.app, inverses);
		expect(vault.fm('A.md')).toEqual({ status: 'Active', started: '2026-01-15' });
	});

	it('emits no inverse for a start it declined to write', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('A.md', { frontmatter: { started: '2026-01-15' } });
		const inverses: RestoreWrite[] = [];

		await applyWrites(vault.app, stamping, [{ file, startedDate: '2026-08-02' }], undefined, (inv) =>
			inverses.push(inv),
		);

		// Nothing changed, so nothing is undoable — a declined stamp must not cost the
		// user the undo of the change before it.
		expect(inverses).toEqual([]);
	});
});
