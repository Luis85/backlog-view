import { describe, expect, it } from 'vitest';
import { applyRestores, applyWrites, createBacklogItem, RestoreWrite } from '../../src/storage/frontmatter';
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

	it('writes the bucket a note was created from, in the same single write', async () => {
		const vault = new FakeVault();
		const planned = { ...settings, horizonKey: 'horizon' };

		const file = await createBacklogItem(vault.app, planned, {
			folder: 'Backlog',
			title: 'Planned',
			typeName: 'Epic',
			parent: null,
			order: 10,
			horizon: 'Later',
		});

		// One atomic write: the note never exists in a bucket its frontmatter does
		// not claim, because there is no moment at which the placement is missing.
		expect(vault.fm(file.path)).toEqual({ type: 'Epic', order: 10, horizon: 'Later' });

		// No horizon asked for, and no horizon key configured: neither writes one.
		const plain = await createBacklogItem(vault.app, planned, {
			folder: 'Backlog',
			title: 'Untriaged',
			typeName: 'Epic',
			parent: null,
			order: 20,
		});
		expect(vault.fm(plain.path)).toEqual({ type: 'Epic', order: 20 });
		const unconfigured = await createBacklogItem(vault.app, settings, {
			folder: 'Backlog',
			title: 'Nowhere',
			typeName: 'Epic',
			parent: null,
			order: 30,
			horizon: 'Later',
		});
		expect(vault.fm(unconfigured.path)).toEqual({ type: 'Epic', order: 30 });
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
