// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { drag, fixture, flush, key, makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

const undoButton = (containerEl: HTMLElement): HTMLButtonElement => {
	const btn = containerEl.querySelector<HTMLButtonElement>('.pbl-undo-btn');
	if (!btn) throw new Error('undo button not rendered');
	return btn;
};

describe('undoing the last change', () => {
	it('restores a drop whole: parent, order and type all come back', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Epic B'), 'inside');
		await flush();
		expect(vault.fm('Epic A.md')).toEqual({ type: 'Feature', order: 30, parent: '[[Epic B]]' });

		undoButton(containerEl).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flush();

		// The parent key was absent before the drop, so it is absent again — not empty.
		expect(vault.fm('Epic A.md')).toEqual({ type: 'Epic', order: 10 });
	});

	it('enables the toolbar button only once a batch has landed', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		expect(undoButton(containerEl).disabled).toBe(true);

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Epic B'), 'inside');
		await flush();

		expect(undoButton(containerEl).disabled).toBe(false);
	});

	it('is reachable with Mod+Z in the tree, and says so when there is nothing to undo', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();
		expect(Notice.messages).toContain('Nothing to undo.');

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Epic B'), 'inside');
		await flush();
		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();

		expect(vault.fm('Epic A.md')).toEqual({ type: 'Epic', order: 10 });
	});

	it('undoing an undo redoes', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Epic B'), 'inside');
		await flush();
		key(tree, 'z', { ctrlKey: true });
		await flush();
		expect(vault.fm('Epic A.md')).toEqual({ type: 'Epic', order: 10 });

		key(tree, 'z', { ctrlKey: true });
		await flush();

		expect(vault.fm('Epic A.md')).toEqual({ type: 'Feature', order: 30, parent: '[[Epic B]]' });
	});

	it('keeps a key edited since the write, restores the rest, and says what it kept', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Epic B'), 'inside');
		await flush();
		// A hand edit in the note beats the snapshot: undo must not overwrite it.
		vault.fm('Epic A.md')['order'] = 99;

		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();

		expect(vault.fm('Epic A.md')).toEqual({ type: 'Epic', order: 99 });
		expect(Notice.messages).toContain('Undo: 1 value was edited since and kept.');
	});

	it('stays reachable from an emptied tree, where the change removed the last row', async () => {
		const vault = new FakeVault();
		vault.addFile('Only.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		const { view, containerEl } = makeView(vault, { stateProperty: 'note.status' });

		rowByTitle(containerEl, 'Only')
			.querySelector<HTMLElement>('.pbl-state-chip')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		Menu.lastShown?.item('Done')?.clickHandler?.();
		await flush();
		// The base's filter excludes done items; the requery now returns nothing.
		(view as unknown as Record<string, unknown>).data = { data: [] };
		view.onDataUpdated();

		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();

		expect(vault.fm('Only.md')['status']).toBe('New');
	});

	it('a spent undo is consumed: a replay that restored nothing disables instead of retrying', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const tree = treeOf(containerEl);

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Epic B'), 'inside');
		await flush();
		// Every key the batch wrote is hand-edited afterwards, so nothing can restore.
		Object.assign(vault.fm('Epic A.md'), { parent: '[[Elsewhere]]', order: 1, type: 'Custom' });

		key(tree, 'z', { ctrlKey: true });
		await flush();
		expect(Notice.messages).toContain('Undo: 3 values were edited since and kept.');
		expect(vault.fm('Epic A.md')).toEqual({ parent: '[[Elsewhere]]', order: 1, type: 'Custom' });

		// The batch is spent — conflicts stay conflicted — so it is not offered again.
		expect(undoButton(containerEl).disabled).toBe(true);
		key(tree, 'z', { ctrlKey: true });
		await flush();
		expect(Notice.messages).toContain('Nothing to undo.');
	});

	it('a no-op write does not cost the slot: re-picking the checked state keeps the real undo', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'New' } });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		drag(rowByTitle(containerEl, 'Epic A'), rowByTitle(containerEl, 'Epic B'), 'inside');
		await flush();

		// The checked state is offered and clickable; picking it writes nothing new.
		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-state-chip')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		Menu.lastShown?.item('New')?.clickHandler?.();
		await flush();

		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();

		// The undo went to the drop, not to the state no-op that followed it.
		expect(vault.fm('Epic A.md')).toEqual({ type: 'Epic', order: 10, status: 'New' });
	});
});
