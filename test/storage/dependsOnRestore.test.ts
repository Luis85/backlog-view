// The dependency inverse is the one restore whose target can be RENAMED, DELETED or
// REPLACED between the write and the undo, which is a subject of its own —
// `src/storage/CLAUDE.md`'s "Undoing a prerequisite: one identity rule". Split out of
// `restore.test.ts` on 2026-09-02 when that file reached its 450-line budget: the rule
// here is about IDENTITY, and the rest of that file is about capture and replay.
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

		const target = vault.fileAt('A.md');
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

		const target = vault.fileAt('A.md');
		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { add: target } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);
		// A is gone, so the line the plugin wrote is still sitting there and now names
		// nothing. Resolving to NOTHING is not resolving to somebody else: no other
		// dependency can be claiming that spelling, so the undo still owns it.
		vault.files.delete('A.md');

		await applyRestores(vault.app, inverses);

		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
	});

	it('takes back an added link whose prerequisite was RENAMED and then DELETED', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', {});

		const target = vault.fileAt('A.md');
		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { add: target } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);
		// Renamed — Obsidian rewrites the plugin's line to match — and then deleted. The
		// captured text names nothing, the live text names nothing, and the captured file
		// is at no path. What still connects them is the file's LAST path, which is what
		// the live line was rewritten to say.
		vault.renameFile('A.md', 'B.md');
		vault.fm('Item.md')['dependsOn'] = ['[[B]]'];
		vault.files.delete('B.md');

		await applyRestores(vault.app, inverses);

		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
	});

	it('restores a removed dependency whose note was DELETED, as the broken line it now is', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: '[[A]]' } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: 'A.md' } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		// Deleted while the line was OFF the note, and nothing took the name.
		vault.files.delete('A.md');

		await applyRestores(vault.app, inverses);

		// The line goes back as it was. It names nothing now — which is exactly what the
		// note would be saying had the removal never happened, and is the same judgement
		// the remove arm already makes about a broken line it wrote itself.
		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[A]]']);
	});

	it('restores a removed dependency under the name its note DIED under', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', { frontmatter: { dependsOn: '[[A]]' } });

		const inverses = await writeCapturing(vault, [{ file: item, dependsOn: { removePath: 'A.md' } }], linked);
		expect(vault.fm('Item.md')['dependsOn']).toBeUndefined();
		// Renamed and then deleted, both while the line was OFF the note. Had the removal
		// never happened, Obsidian's rename would have rewritten the line to `[[B]]` and the
		// deletion would have left it there broken — so `[[B]]` is what the note would be
		// saying, and putting back `[[A]]` would lose the rename and could later bind the
		// dependency to an unrelated note recreated as A.
		vault.renameFile('A.md', 'B.md');
		vault.files.delete('B.md');

		await applyRestores(vault.app, inverses);

		expect(vault.fm('Item.md')['dependsOn']).toEqual(['[[B]]']);
	});

	it('leaves the user their own obsolete spelling when the target was RENAMED', async () => {
		const vault = new FakeVault();
		vault.addFile('A.md', {});
		const item = vault.addFile('Item.md', {});

		const target = vault.fileAt('A.md');
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

		const target = vault.fileAt('A.md');
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
