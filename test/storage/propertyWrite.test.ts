import { describe, expect, it } from 'vitest';
import { PropertyWrite } from '../../src/domain/estimationWritePlan';
import { applyPropertyWrites } from '../../src/storage/propertyWrite';
import { applyRestores, RestoreWrite } from '../../src/storage/frontmatter';
import { FakeVault } from '../helpers/vault';

/** Run a batch and hand back the inverses it emitted — `restore.test.ts`'s own helper. */
async function writeCapturing(vault: FakeVault, writes: PropertyWrite[]): Promise<RestoreWrite[]> {
	const inverses: RestoreWrite[] = [];
	await applyPropertyWrites(vault.app, writes, 'type', undefined, (inv) => inverses.push(inv));
	return inverses;
}

describe('applyPropertyWrites', () => {
	it('refuses a write to a note whose LIVE type is Resource', async () => {
		// The same race `applyWrites` keeps a guard for, on the writer that shares none of
		// its path: the row this batch was planned from is the MODEL's, and the model is
		// stale about a note retyped since the last Bases pass. Without this the score, the
		// recalculation and the cleanup all land on a person.
		const vault = new FakeVault();
		const item = vault.addFile('Dana.md', { frontmatter: { type: 'Resource' } });

		const outcome = await applyPropertyWrites(vault.app, [{ file: item, sets: [{ key: 'score', value: 5 }] }], 'type');

		expect(outcome.changed).toBe(false);
		expect(vault.fm('Dana.md')).toEqual({ type: 'Resource' });
	});

	it('reads the type from the key it is given, not from a fixed one', async () => {
		// The option is per VIEW in Bases, so this view names its own type property and a
		// vault keeping types under `kind` has to be answered by the key passed in. A fixed
		// `type` here would refuse nothing in exactly the vaults that renamed it.
		const vault = new FakeVault();
		const item = vault.addFile('Dana.md', { frontmatter: { kind: 'Resource' } });

		await applyPropertyWrites(vault.app, [{ file: item, sets: [{ key: 'score', value: 5 }] }], 'kind');

		expect(vault.fm('Dana.md')).toEqual({ kind: 'Resource' });
	});

	it('sets a value through setOwn semantics, so a __proto__-named key round-trips as data', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md');

		await applyPropertyWrites(vault.app, [{ file: item, sets: [{ key: '__proto__', value: 5 }] }], 'type');

		const fm = vault.fm('Item.md');
		expect(Object.prototype.hasOwnProperty.call(fm, '__proto__')).toBe(true);
		expect(fm['__proto__']).toBe(5);
		// setOwn's whole point: a plain `fm[key] = value` on '__proto__' replaces the
		// object's prototype instead of creating a key. Proving it did not.
		expect(Object.getPrototypeOf(fm)).toBe(Object.prototype);
	});

	it('a null value removes the key', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { score: 4, other: 'x' } });

		await applyPropertyWrites(vault.app, [{ file: item, sets: [{ key: 'score', value: null }] }], 'type');

		expect(vault.fm('Item.md')).toEqual({ other: 'x' });
	});

	it('ifMissing leaves an existing value alone and fills an absent one', async () => {
		const vault = new FakeVault();
		const held = vault.addFile('Held.md', { frontmatter: { score: 3 } });
		const bare = vault.addFile('Bare.md');

		await applyPropertyWrites(vault.app, [
			{ file: held, sets: [{ key: 'score', value: 9, ifMissing: true }] },
			{ file: bare, sets: [{ key: 'score', value: 9, ifMissing: true }] },
		], 'type');

		expect(vault.fm('Held.md')['score']).toBe(3);
		expect(vault.fm('Bare.md')['score']).toBe(9);
	});

	it('an effective change emits a RestoreWrite whose replay through the real applyRestores puts the prior value back, absence included', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { score: 3 } });

		const inverses = await writeCapturing(vault, [
			{
				file: item,
				sets: [
					{ key: 'score', value: 4 },
					{ key: 'total', value: 3.55 },
					{ key: 'stamp', value: '1/1 abcd1234' },
				],
			},
		]);
		expect(vault.fm('Item.md')).toEqual({ score: 4, total: 3.55, stamp: '1/1 abcd1234' });

		await applyRestores(vault.app, inverses);

		// The pre-existing key returns to its prior value, and the two keys the write
		// CREATED (absent before it) are removed rather than left dangling — the same
		// compare-and-swap `applyWrites`' own inverses replay through, proven here
		// against the real `applyRestores` rather than a stand-in.
		expect(vault.fm('Item.md')).toEqual({ score: 3 });
	});

	it('a no-op write emits no inverse', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { score: 4 } });

		const inverses = await writeCapturing(vault, [{ file: item, sets: [{ key: 'score', value: 4 }] }]);

		expect(inverses).toEqual([]);
	});

	it('refuses the whole write when a set’s expected value has moved', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('0.9.md', { frontmatter: { type: 'Release', status: 'In progress' } });

		// Another window marks it released while our dialog is open. The plan expected
		// 'In progress'; the note now says otherwise, so NEITHER set may land — writing
		// today's date over the day it actually shipped is the failure this prevents.
		vault.onNextProcess('0.9.md', (fm) => {
			fm['status'] = 'Released';
			fm['released'] = '2026-08-01';
		});

		const outcome = await applyPropertyWrites(vault.app, [
			{
				file,
				requiresType: 'Release',
				sets: [
					{ key: 'status', value: 'Released', expects: 'In progress' },
					{ key: 'released', value: '2026-08-29', expects: null },
				],
			},
		], 'type');

		expect(outcome.changed).toBe(false);
		expect(vault.fm('0.9.md')['released']).toBe('2026-08-01');
	});

	it('treats a bare `released:` as absent, and fills it', async () => {
		const vault = new FakeVault();
		// The commonest shape in a vault, and the one a raw-presence guard gets wrong:
		// `hasOwnProperty` is true, every reading in the plugin calls it absent.
		const file = vault.addFile('0.9.md', { frontmatter: { type: 'Release', status: 'In progress', released: null } });

		await applyPropertyWrites(vault.app, [
			{ file, requiresType: 'Release', sets: [{ key: 'released', value: '2026-08-29', expects: null }] },
		], 'type');

		expect(vault.fm('0.9.md')['released']).toBe('2026-08-29');
	});

	it('treats an absent key as the absence a set expected', async () => {
		const vault = new FakeVault();
		// No `status` key at all. `readLabel(undefined)` is valid-and-absent, so `closeOffer`
		// offers this release — and the raw value the plan captures is `undefined`.
		const file = vault.addFile('0.9.md', { frontmatter: { type: 'Release' } });

		await applyPropertyWrites(vault.app, [
			{ file, requiresType: 'Release', sets: [{ key: 'status', value: 'Released', expects: undefined }] },
		], 'type');

		expect(vault.fm('0.9.md')['status']).toBe('Released');
	});

	it('never writes an UNCONFIGURED key: an empty key is dropped, and its own file is left unopened', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { score: 4 } });
		const onlyEmpty = vault.addFile('Untouched.md', { frontmatter: { score: 4 } });

		const inverses = await writeCapturing(vault, [
			{ file: item, sets: [{ key: '', value: 3.55 }, { key: 'score', value: 5 }] },
			{ file: onlyEmpty, sets: [{ key: '', value: null }] },
		]);

		// Absence is a value and an unconfigured key is never written to — the rule
		// `axisEntries` keeps for the roadmap's keys, asked here at the write itself so it
		// holds for a planner not yet written rather than for the ones that remember.
		expect(vault.fm('Item.md')).toEqual({ score: 5 });
		expect(Object.prototype.hasOwnProperty.call(vault.fm('Item.md'), '')).toBe(false);
		expect(inverses.flatMap((i) => i.keys.map((k) => k.key))).toEqual(['score']);
		// A write with nothing left to say is not a save: processFrontMatter rewrites the
		// note whether or not the callback changed anything.
		expect(vault.writeLog.map((w) => w.path)).toEqual(['Item.md']);
	});
});
