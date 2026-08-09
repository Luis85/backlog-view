import { describe, expect, it } from 'vitest';
import { applyRestores, applyWrites, RestoreWrite } from '../../src/storage/frontmatter';
import { ItemWrite } from '../../src/domain/writePlan';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

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

describe('dependency inverses', () => {
	const linked = { ...settings, dependsOnKey: 'dependsOn' };

	it('preserves an entry the tolerant reader ignores through a removal', async () => {
		// 7 is not a dependency line — the reader drops it — but it is still frontmatter
		// this edit has no business destroying.
		const vault = new FakeVault();
		const a = vault.addFile('A.md');
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: [7, '[[A]]'] } });

		await applyWrites(vault.app, linked, [{ file: item, dependsOn: { removePath: a.path } }]);

		expect(vault.fm('Item.md')['dependsOn']).toEqual([7]);
	});

	it('installs no redo when the replay finds nothing left to change', async () => {
		const vault = new FakeVault();
		const a = vault.addFile('A.md');
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: ['[[A]]'] } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: a.path } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		// The user hand-restores the exact dependency the write just took out.
		vault.fm('Item.md')['dependsOn'] = ['[[A]]'];

		const redoBatch: RestoreWrite[] = [];
		await applyRestores(vault.app, inverses, undefined, (inv) => redoBatch.push(inv));

		// The replay found its own change already undone by hand: nothing to do, and
		// nothing installed that a stray redo could later reapply and remove it again.
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);
		expect(redoBatch).toEqual([]);
	});

	it('restores every duplicate a removal captured, not just the first', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md');
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: ['[[Missing]]', '[[Missing]]', 'X'] } });

		const inverses = await writeCapturing(
			vault,
			[{ file: item, dependsOn: { removeRaw: '[[Missing]]' } }],
			linked,
		);
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['X']);

		await applyRestores(vault.app, inverses);

		expect(vault.fm('Item.md')['dependsOn']).toEqual(['X', '[[Missing]]', '[[Missing]]']);
	});

	it('matches a live entry by the note it resolves to, not by exact text, so a respelled hand edit does not duplicate', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md');
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: 'A' } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removeRaw: 'A' } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		// The user re-adds the SAME note by hand, spelled as a wikilink rather than bare —
		// exactly what the removed line looked like on disk is gone, but the note is not.
		vault.fm('Item.md')['dependsOn'] = '[[A]]';

		await applyRestores(vault.app, inverses);

		// One entry, not two: "[[A]]" already names the note the undo would add back, so
		// a text-exact match that missed it would leave "A" and "[[A]]" both on the note.
		expect(vault.fm('Item.md')['dependsOn']).toBe('[[A]]');
	});

	it('does not erase a dependency that arrived after removeKey was planned', async () => {
		// The picker offered "Remove the empty property" against a value that read as
		// no dependencies — then the note gained a real one before the pick landed.
		const vault = new FakeVault();
		vault.addFile('A.md');
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: '' } });
		vault.fm('Item.md')['dependsOn'] = 'A';

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removeKey: true } }], linked);

		// The stale removal must not erase what arrived in the meantime, and — because
		// nothing changed — it must not spend the undo slot on a change nobody made.
		expect(vault.fm('Item.md')['dependsOn']).toBe('A');
		expect(inverses).toEqual([]);
	});

	it('restores a removed entry with its original spelling, whitespace and all', async () => {
		const vault = new FakeVault();
		const a = vault.addFile('A.md');
		// Significant surrounding whitespace: trimmed is what the reader sees, but undo's
		// promise is to put back what the write took out, not what the reader made of it.
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: [' [[A]] '] } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: a.path } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();

		await applyRestores(vault.app, inverses);

		expect(vault.fm('Item.md')['dependsOn']).toEqual([' [[A]] ']);
	});

	it('captures its own redo from the live spelling it removed, not the trimmed match — mirroring the forward capture', async () => {
		const vault = new FakeVault();
		const a = vault.addFile('A.md');
		const item = vault.addFile('Item.md');

		// The plugin adds [[A]]...
		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { add: a } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);

		// ...the user respells it by hand, padding it with whitespace the reader trims
		// but which is still the user's own edit.
		vault.fm('Item.md')['dependsOn'] = [' [[A]] '];

		const redoBatch: RestoreWrite[] = [];
		await applyRestores(vault.app, inverses, undefined, (inv) => redoBatch.push(inv));
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();

		// Redoing has to reverse what this undo actually did — remove the padded
		// entry — so the redo it records must hold the padded spelling, not the
		// trimmed form the plugin originally wrote.
		await applyRestores(vault.app, redoBatch);
		expect(vault.fm('Item.md')['dependsOn']).toEqual([' [[A]] ']);
	});

	it('takes back its own exact line, not a differently-spelled entry the user added themselves', async () => {
		const vault = new FakeVault();
		const a = vault.addFile('A.md');
		const item = vault.addFile('Item.md');

		// The plugin adds [[A]]...
		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { add: a } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);

		// ...then the user inserts their OWN "A" ahead of it by hand, so the note holds
		// both spellings of the same note.
		vault.fm('Item.md')['dependsOn'] = ['A', '[[A]]'];

		await applyRestores(vault.app, inverses);

		// Undo owns the exact line its own write put there. A resolved-path match would
		// find "A" first and take the user's entry instead, leaving the plugin's behind.
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['A']);
	});

	it('still matches a live entry naming no note by its exact text — nothing to resolve, nothing to share', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: 'Ghost' } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removeRaw: 'Ghost' } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		vault.fm('Item.md')['dependsOn'] = 'Ghost';

		await applyRestores(vault.app, inverses);

		// The hand-typed line already satisfies the restore by its own exact spelling —
		// still a no-op, the ordinary "already back" case, not a second unresolvable copy.
		expect(vault.fm('Item.md')['dependsOn']).toBe('Ghost');
	});

	it('undoes an add whose prerequisite was RENAMED before the undo', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', {});

		const target = vault.files.get('A.md') as never;
		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { add: target } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);
		// Obsidian renames by mutating the one file object and rewriting the links that
		// named it. The captured text `[[A]]` now resolves to nothing; only the file the
		// capture held still says which note the line was about.
		vault.renameFile('A.md', 'B.md');
		vault.fm('Item.md')['dependsOn'] = ['[[B]]'];

		await applyRestores(vault.app, inverses);

		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
	});

	it('restores a removed dependency under the name its note has NOW, after a rename', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: '[[A]]' } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: 'A.md' } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		// Renamed while the line was OFF the note. Obsidian rewrites the links that exist,
		// and a removed one is not there to be rewritten — so the captured `[[A]]` now
		// names nothing, and putting it back verbatim would restore a broken dependency
		// the user never had.
		vault.renameFile('A.md', 'B.md');

		await applyRestores(vault.app, inverses);

		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[B]]']);
	});

	it('takes back an added link whose note was DELETED before the undo', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', {});

		const target = vault.files.get('A.md') as never;
		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { add: target } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);
		// A is gone, so the line the plugin wrote is still sitting there and now names
		// nothing. Resolving to NOTHING is not resolving to somebody else: no other
		// dependency can be claiming that spelling, so the undo still owns it.
		vault.files.delete('A.md');

		await applyRestores(vault.app, inverses);

		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
	});

	it('leaves the user their own obsolete spelling when the target was RENAMED', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', {});

		const target = vault.files.get('A.md') as never;
		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { add: target } }], linked);
		// A is renamed, so Obsidian rewrites the plugin's line — and the user separately
		// types the old name, which now resolves to nothing.
		vault.renameFile('A.md', 'B.md');
		vault.fm('Item.md')['dependsOn'] = ['[[B]]', '[[A]]'];

		await applyRestores(vault.app, inverses);

		// The captured `[[A]]` is unresolved now, exactly as it would be if A had been
		// deleted — but A is alive under a new name, so that spelling is merely obsolete
		// and the user's line is theirs. The plugin takes back its own by identity.
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);
	});

	it('keeps the alias and heading the user wrote when following a rename', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: '[[A#Plan|Prerequisite]]' } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: 'A.md' } }], linked);
		vault.renameFile('A.md', 'B.md');

		await applyRestores(vault.app, inverses);

		// The TARGET is what a rename moved; the heading and the alias say what the user
		// meant by the link and are none of the rename's business. Rebuilding the whole
		// link from the file resolved correctly and silently dropped both.
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[B#Plan|Prerequisite]]']);
	});

	it('gives a hand-restored spelling to the captured line it IS, not one it resembles', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		// Two spellings of one dependency, so the removal captures two lines.
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: ['A', '[[A]]'] } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: 'A.md' } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		// Only one of the two put back by hand.
		vault.fm('Item.md')['dependsOn'] = ['[[A]]'];

		await applyRestores(vault.app, inverses);

		// The live `[[A]]` satisfies the captured `[[A]]`, so what undo owes is the OTHER
		// spelling. Counting by resolved note alone let it satisfy captured `A` instead
		// and then append a second `[[A]]`.
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]', 'A']);
	});

	it('tells two spellings apart by their padding, not by what they trim to', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: [' A ', 'A'] } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: 'A.md' } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		// Only the padded one put back by hand.
		vault.fm('Item.md')['dependsOn'] = [' A '];

		await applyRestores(vault.app, inverses);

		// The live `" A "` is the captured `" A "`, so what undo owes is the bare `A`.
		// Counting exact matches off the TRIMMED reading made it the match for `"A"`
		// instead, and appended a second padded copy.
		expect(vault.fm('Item.md')['dependsOn']).toEqual([' A ', 'A']);
	});

	it('restores nothing for a dependency whose note was replaced under its own name', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: '[[A]]' } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: 'A.md' } }], linked);
		// Deleted, and a DIFFERENT note created under the old name.
		vault.files.delete('A.md');
		vault.addFile('A.md', {});

		await applyRestores(vault.app, inverses);

		// `[[A]]` would resolve — to a note the user never picked. An undo that cannot
		// name what it was undoing writes nothing rather than something plausible.
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
	});

	it('takes back its own line, not a user entry whose spelling now names a REPLACEMENT note', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', {});

		const target = vault.files.get('A.md') as never;
		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { add: target } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);
		// The prerequisite is renamed, so Obsidian rewrites the plugin's live line...
		vault.renameFile('A.md', 'B.md');
		// ...a DIFFERENT note is created under the old name, and the user depends on THAT.
		vault.addFile('A.md', {});
		vault.fm('Item.md')['dependsOn'] = ['[[B]]', '[[A]]'];

		await applyRestores(vault.app, inverses);

		// The captured spelling names somebody else's note now, so it is not this undo's
		// own line to take. Preferring the text regardless removed the user's dependency
		// and left the plugin's `[[B]]` on the note.
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);
	});

	it('still owes a removed line whose captured spelling now names a REPLACEMENT note', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: '[[A]]' } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: 'A.md' } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		// Renamed while the line was OFF the note, a different note created under the old
		// name, and the user hand-adds a dependency on that one.
		vault.renameFile('A.md', 'B.md');
		vault.addFile('A.md', {});
		vault.fm('Item.md')['dependsOn'] = ['[[A]]'];

		await applyRestores(vault.app, inverses);

		// The live `[[A]]` is not the captured line back — it names a different note — so
		// the dependency is still owed, under the name its note has now. Counting the
		// exact text as already-restored made the undo silently do nothing.
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]', '[[B]]']);
	});

	it('recognises a hand-restored unresolvable entry that differs only in padding', async () => {
		const vault = new FakeVault();
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: ' Ghost ' } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removeRaw: 'Ghost' } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		// Put back by hand, as the reader would type it rather than as it was stored.
		vault.fm('Item.md')['dependsOn'] = 'Ghost';

		await applyRestores(vault.app, inverses);

		// One dependency, one line. The captured text kept its padding so the exact line
		// could be restored; the live entry lost it because that is what the reader sees.
		// Counting them under different identities is what appended a second copy.
		expect(vault.fm('Item.md')['dependsOn']).toBe('Ghost');
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
