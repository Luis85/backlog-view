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

	it('seeds no placement onto a release, from either surface that seeds one', async () => {
		// The last door on the edit path's own rule, and the only write path that does not
		// go through `applyWrites` — so nothing downstream would have caught it. A `Release`
		// speaks no placement end and takes no horizon, and BOTH surfaces that seed a
		// placement land here: a bucket header's `+` (`horizon`) and an iteration board's
		// `+` (that sprint's `axis` dates). Reachable in focus mode, where `newItemType`
		// follows `focusTarget` and that accepts any declared type name.
		const vault = new FakeVault();
		const planned = {
			...settings,
			horizonKey: 'horizon',
			startKey: 'start',
			targetKey: 'due',
			iterationKey: 'iteration',
			releaseKey: 'release',
		};

		const sprint = vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 5 } });
		// The release scope tree's own `New <child>` is the third surface that seeds
		// something, and it is under the identical rule: a `Release` created from one is
		// not put inside another.
		const shipping = vault.addFile('1.1.md', { frontmatter: { type: 'Release' } });
		const release = await createBacklogItem(vault.app, planned, {
			folder: 'Backlog',
			title: '1.0',
			typeName: 'Release',
			parent: null,
			order: 10,
			horizon: 'Later',
			axis: { start: '2026-09-01', target: '2026-09-30' },
			iteration: sprint,
			release: shipping,
		});
		// The sprint key with them, and it is the worst of the three rather than the
		// mildest: `canSetIteration` refuses a marker, so a release joined to a sprint
		// board's population would carry a key no edit path will write again or offer to
		// clear.
		expect(vault.fm(release.path)).toEqual({ type: 'Release', order: 10 });

		// The type it must not disturb: an ordinary item created the same way keeps both.
		const work = await createBacklogItem(vault.app, planned, {
			folder: 'Backlog',
			title: 'Work',
			typeName: 'PBI',
			parent: null,
			order: 20,
			horizon: 'Later',
			axis: { start: '2026-09-01', target: '2026-09-30' },
			iteration: sprint,
			release: shipping,
		});
		expect(vault.fm(work.path)).toEqual({
			type: 'PBI',
			order: 20,
			horizon: 'Later',
			start: '2026-09-01',
			due: '2026-09-30',
			iteration: '[[Sprint 12]]',
			release: '[[1.1]]',
		});
	});

	it('writes no membership where the offering view has no key bound for it', async () => {
		// `settings.releaseKey` is the OFFERING view's own membership key, and an unconfigured
		// key is never written to — the same rule `axisEntries` and the state key keep, asked
		// of the one property a release scope's `New <child>` adds. Without it a base whose
		// membership option nobody has named would gain a key from a surface that cannot
		// read one back.
		const vault = new FakeVault();
		const shipping = vault.addFile('1.1.md', { frontmatter: { type: 'Release' } });

		const file = await createBacklogItem(vault.app, { ...settings, releaseKey: '' }, {
			folder: 'Backlog',
			title: 'Unfiled',
			typeName: 'PBI',
			parent: null,
			order: 10,
			release: shipping,
		});

		expect(vault.fm(file.path)).toEqual({ type: 'PBI', order: 10 });
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
