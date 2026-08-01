import { describe, expect, it } from 'vitest';
import { applyWrites, createBacklogItem } from '../../src/storage/frontmatter';
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

describe('createBacklogItem', () => {
	it('creates folders, dedupes names, sanitizes titles, and writes properties', async () => {
		const vault = new FakeVault();
		const parent = vault.addFile('Backlog/Epic.md');

		const first = await createBacklogItem(vault.app, settings, {
			folder: 'Backlog/Items',
			title: 'My: Story?',
			typeName: 'PBI',
			parent,
			order: 10,
		});
		expect(first.path).toBe('Backlog/Items/My- Story.md');
		expect(vault.folders.has('Backlog')).toBe(true);
		expect(vault.folders.has('Backlog/Items')).toBe(true);
		expect(vault.fm(first.path)).toEqual({ type: 'PBI', parent: '[[Epic]]', order: 10 });

		const second = await createBacklogItem(vault.app, settings, {
			folder: 'Backlog/Items',
			title: 'My: Story?',
			typeName: 'PBI',
			parent: null,
			order: 20,
		});
		expect(second.path).toBe('Backlog/Items/My- Story 1.md');
		expect(vault.fm(second.path)).toEqual({ type: 'PBI', order: 20 });
	});

	it('pins parentless creations in folder mode', async () => {
		const vault = new FakeVault();
		vault.addFile('Epics/Alpha/Alpha.md', { frontmatter: { type: 'Epic' } });

		const file = await createBacklogItem(vault.app, { ...settings, folderHierarchy: true }, {
			folder: 'Epics/Alpha',
			title: 'Standalone',
			typeName: 'Epic',
			parent: null,
			order: 10,
		});

		// Without the empty-parent pin, folder inference would nest this under Alpha
		expect(vault.fm(file.path)['parent']).toBe('');
	});

	it('removes the folders it made when the note itself cannot be written', async () => {
		const vault = new FakeVault();
		vault.folders.add('Backlog');
		vault.failCreates.add('Backlog/bugs/Fix.md');

		await expect(
			createBacklogItem(vault.app, settings, {
				folder: 'Backlog/bugs',
				title: 'Fix',
				typeName: 'Bug',
				parent: null,
				order: 10,
			}),
		).rejects.toThrow('create failed');

		// Only what this attempt made. `Backlog` was already there and is not ours to take.
		expect(vault.trashed).toEqual(['Backlog/bugs']);
		expect(vault.folders.has('Backlog')).toBe(true);
	});

	it('unwinds a whole created chain, deepest first', async () => {
		const vault = new FakeVault();
		vault.failCreates.add('Roadmap/work/open/Thing.md');

		await expect(
			createBacklogItem(vault.app, settings, {
				folder: 'Roadmap/work/open',
				title: 'Thing',
				typeName: 'Task',
				parent: null,
				order: 10,
			}),
		).rejects.toThrow('create failed');

		// Deepest first is the only order in which each one is empty when it is reached.
		expect(vault.trashed).toEqual(['Roadmap/work/open', 'Roadmap/work', 'Roadmap']);
		expect([...vault.folders]).toEqual(['/']);
	});

	it('keeps a created folder that is no longer empty, and everything above it', async () => {
		const vault = new FakeVault();
		// Something else put a note here between the folder being made and the write
		// failing — a sync client, another plugin, the user. The rollback is not entitled
		// to it, and a folder holding it is not empty.
		vault.addFile('Roadmap/work/Someone else.md');
		vault.failCreates.add('Roadmap/work/Thing.md');

		await expect(
			createBacklogItem(vault.app, settings, {
				folder: 'Roadmap/work',
				title: 'Thing',
				typeName: 'Task',
				parent: null,
				order: 10,
			}),
		).rejects.toThrow('create failed');

		// And `Roadmap` stays too: it cannot be empty while `work` is still standing in it.
		expect(vault.trashed).toEqual([]);
		expect(vault.folders.has('Roadmap/work')).toBe(true);
		expect(vault.folders.has('Roadmap')).toBe(true);
	});

	it('does not take the folder out from under a creation running beside it', async () => {
		const vault = new FakeVault();
		vault.failCreates.add('Roadmap/First.md');

		// Started together, which nothing upstream prevents: `createFromPrompt` calls
		// straight into storage rather than through the view's write gate, so two modals,
		// two views, or a creation beside the scaffold command all reach here at once.
		const first = createBacklogItem(vault.app, settings, {
			folder: 'Roadmap',
			title: 'First',
			typeName: 'Task',
			parent: null,
			order: 10,
		});
		const second = createBacklogItem(vault.app, settings, {
			folder: 'Roadmap',
			title: 'Second',
			typeName: 'Task',
			parent: null,
			order: 20,
		});

		await expect(first).rejects.toThrow('create failed');
		expect((await second).path).toBe('Roadmap/Second.md');
		expect(vault.folders.has('Roadmap')).toBe(true);
		// And each attempt answered for its own folder. Unserialized, the two interleave
		// between the look that decides what to create and the look that decides what to
		// remove: the second sees the folder already there, records nothing, and is left
		// depending on a folder the first still believes is its own to unwind. Whichever
		// way that lands is wrong — the second loses its parent mid-write, or the first
		// silently keeps a folder it should have taken back because the second's note made
		// it look occupied. Serialized, the first unwinds its own and the second makes its
		// own, which is this one line.
		expect(vault.trashed).toEqual(['Roadmap']);
	});

	it('falls back to Untitled for empty titles and supports the vault root', async () => {
		const vault = new FakeVault();
		const file = await createBacklogItem(vault.app, settings, {
			folder: '',
			title: '???',
			typeName: 'Epic',
			parent: null,
			order: 10,
		});
		expect(file.path).toBe('Untitled.md');
	});
});
