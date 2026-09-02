import { describe, expect, it } from 'vitest';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { computeReleaseWrites, ItemWrite } from '../../src/domain/writePlan';
import { defaultSettings } from '../../src/domain/settings';
import { buildModel } from '../../src/domain/model';
import { FakeVault } from '../helpers/vault';
import { settingsWith } from '../helpers/settings';

const settings = defaultSettings();

/** Run a forward batch and hand back the inverses it emitted. */
async function writeCapturing(
	vault: FakeVault,
	writes: ItemWrite[],
	config = settings,
): Promise<RestoreWrite[]> {
	const inverses: RestoreWrite[] = [];
	await applyWrites(vault.app, config, writes, undefined, (inv) => inverses.push(inv));
	return inverses;
}

describe('inverse capture', () => {
	it('round-trips raw shapes: aliased links, string orders, absent keys, untouched values', async () => {
		const vault = new FakeVault();
		const epic = vault.addFile('Epic.md');
		// An aliased link and a string-typed order survive the model's tolerant
		// readers, so they are exactly what a prior value can look like on disk.
		const child = vault.addFile('Child.md', {
			frontmatter: { parent: '[[Old|Alias]]', order: '5', custom: 'x' },
		});

		const inverses = await writeCapturing(vault, [
			{ file: child, parent: epic, order: 15, typeName: 'Feature' },
		]);
		expect(vault.fm('Child.md')).toEqual({ parent: '[[Epic]]', order: 15, type: 'Feature', custom: 'x' });

		await applyRestores(vault.app, inverses.reverse());
		// The prior values come back exactly — alias, string shape, absent type —
		// and the key the batch never touched still holds its value.
		expect(vault.fm('Child.md')).toEqual({ parent: '[[Old|Alias]]', order: '5', custom: 'x' });
	});

	it('emits no inverse for a write that changes nothing', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { status: 'Done' } });
		const stateful = { ...settings, stateKey: 'status' };

		const inverses = await writeCapturing(vault, [{ file: item, state: 'Done' }], stateful);

		// Re-picking the checked state must not consume the caller's single undo slot.
		expect(inverses).toEqual([]);
	});

	it('captures absence by own property, so a prototype-named key round-trips', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md');

		// 'toString' is a legal property name; `in` would report the inherited
		// function as present and undo would then "restore" it.
		const inverses = await writeCapturing(vault, [{ file: item, order: 10 }], {
			...settings,
			orderKey: 'toString',
		});
		expect(vault.fm('Item.md')['toString']).toBe(10);

		await applyRestores(vault.app, inverses);

		expect(Object.prototype.hasOwnProperty.call(vault.fm('Item.md'), 'toString')).toBe(false);
	});

	it('tells an absent parent key from an empty one, both directions', async () => {
		const vault = new FakeVault();
		const folderMode = { ...settings, folderHierarchy: true };
		const pinned = vault.addFile('A/Pinned.md');
		const linked = vault.addFile('A/Linked.md', { frontmatter: { parent: '[[Somewhere]]' } });

		// parent: null pins with '' where the key was absent; removeParentKey deletes it.
		const inverses = await writeCapturing(
			vault,
			[
				{ file: pinned, parent: null },
				{ file: linked, removeParentKey: true },
			],
			folderMode,
		);
		expect(vault.fm('A/Pinned.md')).toEqual({ parent: '' });
		expect('parent' in vault.fm('A/Linked.md')).toBe(false);

		await applyRestores(vault.app, inverses.reverse());
		expect('parent' in vault.fm('A/Pinned.md')).toBe(false);
		expect(vault.fm('A/Linked.md')).toEqual({ parent: '[[Somewhere]]' });
	});

	it('keeps handing over inverses up to the write that fails', async () => {
		const vault = new FakeVault();
		const a = vault.addFile('A.md', { frontmatter: { order: 1 } });
		const b = vault.addFile('B.md', { frontmatter: { order: 2 } });
		vault.failWrites.add('B.md');

		const inverses: RestoreWrite[] = [];
		await expect(
			applyWrites(
				vault.app,
				settings,
				[
					{ file: a, order: 10 },
					{ file: b, order: 20 },
				],
				undefined,
				(inv) => inverses.push(inv),
			),
		).rejects.toThrow('write failed: B.md');

		// The applied prefix is on disk and exactly what still needs undoing.
		expect(vault.fm('A.md')).toEqual({ order: 10 });
		expect(inverses).toHaveLength(1);
		await applyRestores(vault.app, inverses);
		expect(vault.fm('A.md')).toEqual({ order: 1 });
	});
});

describe('applyRestores', () => {
	it('compare-and-swaps: a key edited since the write is kept, the rest restore', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { order: 1, type: 'Epic' } });

		const inverses = await writeCapturing(vault, [{ file: item, order: 10, typeName: 'Feature' }]);
		// A hand edit lands between the write and the undo.
		vault.fm('Item.md')['order'] = 99;

		const outcome = await applyRestores(vault.app, inverses);

		expect(outcome.conflicts).toBe(1);
		expect(vault.fm('Item.md')).toEqual({ order: 99, type: 'Epic' });
	});

	it('skips a note deleted since the write and restores the rest', async () => {
		const vault = new FakeVault();
		const gone = vault.addFile('Gone.md', { frontmatter: { order: 1 } });
		const kept = vault.addFile('Kept.md', { frontmatter: { order: 2 } });

		const inverses = await writeCapturing(vault, [
			{ file: gone, order: 10 },
			{ file: kept, order: 20 },
		]);
		vault.files.delete('Gone.md');

		const outcome = await applyRestores(vault.app, inverses.reverse());

		expect(outcome.missing).toBe(1);
		expect(vault.fm('Kept.md')).toEqual({ order: 2 });
	});

	it('treats a note recreated at the captured path as missing, not as a match', async () => {
		const vault = new FakeVault();
		const original = vault.addFile('Item.md', { frontmatter: { parent: '[[Somewhere]]' } });

		// The forward write deletes the key, so the inverse's compare side is
		// "absent" — which a fresh, unrelated note at this path would satisfy.
		const inverses = await writeCapturing(vault, [{ file: original, removeParentKey: true }]);
		vault.files.delete('Item.md');
		vault.addFile('Item.md', { frontmatter: { own: 'note' } });

		const outcome = await applyRestores(vault.app, inverses);

		// The replacement is a different file; it must not inherit the original's history.
		expect(outcome.missing).toBe(1);
		expect(vault.fm('Item.md')).toEqual({ own: 'note' });
	});

	it('records its own inverses, so undoing an undo is redo', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { order: 1 } });

		const undoBatch = await writeCapturing(vault, [{ file: item, order: 10 }]);

		const redoBatch: RestoreWrite[] = [];
		await applyRestores(vault.app, undoBatch, undefined, (inv) => redoBatch.push(inv));
		expect(vault.fm('Item.md')).toEqual({ order: 1 });

		await applyRestores(vault.app, redoBatch);
		expect(vault.fm('Item.md')).toEqual({ order: 10 });
	});
});

describe('tag inverses', () => {
	const tagged = { ...settings, tagsKey: 'tags' };

	it('reverses only the effective delta, composing with edits made since', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { tags: ['alpha'] } });

		// 'alpha' is already present, so only 'new' is effectively added.
		const inverses = await writeCapturing(vault, [{ file: item, tags: { add: ['alpha', 'new'] } }], tagged);
		expect(vault.fm('Item.md')).toEqual({ tags: ['alpha', 'new'] });
		// The user tags the note themselves before the undo.
		(vault.fm('Item.md')['tags'] as string[]).push('mine');

		await applyRestores(vault.app, inverses);

		// The undo removes what the write added — never 'alpha', never 'mine'.
		expect(vault.fm('Item.md')).toEqual({ tags: ['alpha', 'mine'] });
	});

	it('restores a removed tag as a list, whatever shape the note held before', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { tags: 'alpha beta' } });

		const inverses = await writeCapturing(vault, [{ file: item, tags: { remove: ['beta'] } }], tagged);
		expect(vault.fm('Item.md')).toEqual({ tags: ['alpha'] });

		await applyRestores(vault.app, inverses);

		// The accepted price of delta restore: the scalar comes back as the list
		// the write path writes anyway. The tags themselves are all there.
		expect(vault.fm('Item.md')).toEqual({ tags: ['alpha', 'beta'] });
	});
});

describe('iteration inverses', () => {
	const withIteration = { ...settings, iterationKey: 'iteration' };

	it('takes an iteration link back with the one undo slot', async () => {
		const vault = new FakeVault();
		const pbi = vault.addFile('PBI-1.md');
		const sprint12 = vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration' } });

		const inverses = await writeCapturing(vault, [{ file: pbi, iteration: sprint12 }], withIteration);
		expect(vault.fm('PBI-1.md')['iteration']).toBe('[[Sprint 12]]');

		await applyRestores(vault.app, inverses);

		expect(vault.fm('PBI-1.md')['iteration']).toBeUndefined();
	});

	it('deletes the key for a removal, and undo puts it back', async () => {
		const vault = new FakeVault();
		const pbi = vault.addFile('PBI-1.md', { frontmatter: { iteration: '[[Sprint 12]]' } });

		const inverses = await writeCapturing(vault, [{ file: pbi, iteration: null }], withIteration);
		expect(vault.fm('PBI-1.md')).toEqual({});

		await applyRestores(vault.app, inverses);

		expect(vault.fm('PBI-1.md')['iteration']).toBe('[[Sprint 12]]');
	});

	it('never writes to an unconfigured key', async () => {
		const vault = new FakeVault();
		const pbi = vault.addFile('PBI-1.md');
		const sprint12 = vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration' } });

		const inverses = await writeCapturing(vault, [{ file: pbi, iteration: sprint12 }], {
			...settings,
			iterationKey: '',
		});

		expect(vault.fm('PBI-1.md')).toEqual({});
		expect(inverses).toEqual([]);
	});

	it('takes the link and both dates back together, from the one undo slot', async () => {
		// The join is ONE batch — the link plus both dates on one `ItemWrite` — so the
		// undo it captures must put back all three, asked of the note itself and never
		// of `touchedKeys`' own list: a key written but not captured would be a change
		// no undo could reach, which is exactly how "the dates come back and the link
		// stays" would happen if the link had no row of its own in that module.
		const dated = { ...withIteration, startKey: 'start', targetKey: 'due' };
		const vault = new FakeVault();
		const pbi = vault.addFile('PBI-1.md');
		const sprint12 = vault.addFile('Sprint 12.md', {
			frontmatter: { type: 'Iteration', start: '2026-09-07', due: '2026-09-20' },
		});

		const inverses = await writeCapturing(
			vault,
			[{ file: pbi, iteration: sprint12, axis: { start: '2026-09-07', target: '2026-09-20' } }],
			dated,
		);
		expect(vault.fm('PBI-1.md')).toEqual({ iteration: '[[Sprint 12]]', start: '2026-09-07', due: '2026-09-20' });

		await applyRestores(vault.app, inverses);

		// All three keys gone — not merely the dates, with the link left behind.
		expect(vault.fm('PBI-1.md')).toEqual({});
	});
});

describe('release inverses', () => {
	it('takes the link and both dates back together, from the one undo slot', async () => {
		// The join is ONE batch — the link plus whichever dates the writer decided to land
		// — so the undo it captures has to put back all three at once. Asked of the note
		// itself rather than of `touchedKeys`' list, exactly as the iteration's own case
		// above is: a key written but not captured is a change no undo could reach.
		const dated = settingsWith({ releaseKey: 'release', startKey: 'start', targetKey: 'due' });
		const vault = new FakeVault();
		vault.addFile('Releases/2.4.md', { frontmatter: { type: 'Release', 'target-date': '2026-12-01' } });
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', order: 10 } });
		const model = buildModel(vault.app, vault.entries(), dated);
		const writes = computeReleaseWrites(
			model.byPath.get('PBI-1.md')!,
			model.byPath.get('Releases/2.4.md')!,
			dated,
			{ year: 2026, month: 9, day: 2 },
		);

		const inverses = await writeCapturing(vault, writes, dated);
		expect(vault.fm('PBI-1.md')).toEqual({
			type: 'PBI',
			order: 10,
			release: '[[2.4]]',
			start: '2026-09-02',
			due: '2026-12-01',
		});

		await applyRestores(vault.app, inverses);

		// All three keys gone — not the dates alone, with the membership left behind.
		expect(vault.fm('PBI-1.md')).toEqual({ type: 'PBI', order: 10 });
	});
});
