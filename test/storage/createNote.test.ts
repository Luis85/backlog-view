import { describe, expect, it } from 'vitest';
import { createBacklogItem, createResourceNote } from '../../src/storage/createNote';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

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

describe('createResourceNote', () => {
	it('writes exactly the type key — no order, no parent, even in folder mode', async () => {
		// Folder mode is ON so the branch that would pin an explicitly-empty `parent`
		// (`createBacklogItem`'s own `else if (settings.folderHierarchy)`) is live in this
		// fixture — a resource must not take that rung either, since it is not on the tree
		// to be nested onto anything.
		const vault = new FakeVault();

		const file = await createResourceNote(vault.app, { ...settings, folderHierarchy: true }, {
			folder: 'People',
			title: 'Alex',
		});

		expect(vault.fm(file.path)).toEqual({ type: 'Resource' });
	});

	it('creates the folder and dedupes a taken title', async () => {
		const vault = new FakeVault();

		const first = await createResourceNote(vault.app, settings, { folder: 'People', title: 'Alex' });
		expect(first.path).toBe('People/Alex.md');
		expect(vault.folders.has('People')).toBe(true);

		const second = await createResourceNote(vault.app, settings, { folder: 'People', title: 'Alex' });
		expect(second.path).toBe('People/Alex 1.md');
	});
});
