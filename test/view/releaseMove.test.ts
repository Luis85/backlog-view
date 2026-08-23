// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { BacklogItem } from '../../src/domain/model';
import { ProductBacklogView } from '../../src/view/backlogView';
import * as cardDrag from '../../src/view/interactions/cardDrag';
import { announced } from '../helpers/dnd';
import { FakeVault } from '../helpers/vault';
import { flush, makeView, refresh, useViewHarness } from '../helpers/view';

/**
 * `performReleaseMove` — the one host method both the card menu and the keyboard
 * (Task 6) will call, following `performHorizonMove`'s shape: plan with
 * `computeReleaseWrites`, apply through `applySafely`, announce once. Unlike the
 * board and horizon axes a release is not a column or bucket this view draws, so
 * there is no on-screen vocabulary to translate through — the release's own name IS
 * the word announced, and that is what the capture test below is about.
 */
useViewHarness();

function itemAt(view: ProductBacklogView, path: string): BacklogItem {
	const item = view.model?.byPath.get(path);
	if (!item) throw new Error(`no item loaded: ${path}`);
	return item;
}

/**
 * A PBI (`F.md`) and a release note (`2.4.md`), the two paths the brief names.
 * `exclude` loads `F.md` as a context row rather than a result — a child under it
 * keeps it in the tree (`loadOutsideParents`), the same shape
 * `contextCardWrites.test.ts`'s own fixtures use.
 */
function makeViewWithReleases(opts: { exclude?: string } = {}) {
	const vault = new FakeVault();
	vault.addFile('F.md', { frontmatter: { type: 'PBI', order: 10 } });
	vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
	let only: string[] | undefined;
	if (opts.exclude === 'F.md') {
		vault.addFile('F Child.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'F' });
		only = ['F Child.md', '2.4.md'];
	}
	const harness = makeView(vault, { releaseProperty: 'note.release' }, { collapsed: true, only });
	return { view: harness.view, vault };
}

describe('putting one item in a release', () => {
	it('writes the membership and announces it once', async () => {
		const { view, vault } = makeViewWithReleases();
		vi.useFakeTimers();
		// The write is already complete once this resolves — `announced()` is what
		// needs the fake timers advanced, for the live region's own debounce, so
		// there is nothing left for `flush()`'s real `setTimeout` to wait out.
		await view.performReleaseMove(itemAt(view, 'F.md'), itemAt(view, '2.4.md'));
		expect(vault.writeLog.map((w) => w.path)).toEqual(['F.md']);
		expect(await announced()).toContain('2.4');
	});

	it('refuses a batch naming an item the base excluded', async () => {
		// The context rule, at the gate rather than only at the entry point.
		const { view, vault } = makeViewWithReleases({ exclude: 'F.md' });
		const applied = await view.performReleaseMove(itemAt(view, 'F.md'), itemAt(view, '2.4.md'));
		await flush();
		expect(applied).toBe(false);
		expect(vault.writeLog).toEqual([]);
	});

	it('clears the membership key for a "no release" pick, and plans nothing for a re-pick', async () => {
		// Both branches `computeReleaseWrites` offers, exercised through the host method
		// rather than only through the planner's own suite — the empty-plan path must
		// leave the gate untouched (no write, no announcement) and the removal path
		// must reach the writer.
		const vault = new FakeVault();
		vault.addFile('F.md', { frontmatter: { type: 'PBI', order: 10, release: '[[2.4]]' } });
		vault.addFile('2.4.md', { frontmatter: { type: 'Release' } });
		const { view } = makeView(vault, { releaseProperty: 'note.release' }, { collapsed: true });
		vi.useFakeTimers();

		const noOp = await view.performReleaseMove(itemAt(view, 'F.md'), itemAt(view, '2.4.md'));
		expect(noOp).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(await announced()).toBe('');

		const cleared = await view.performReleaseMove(itemAt(view, 'F.md'), null);
		expect(cleared).toBe(true);
		expect(vault.writeLog.map((w) => w.path)).toEqual(['F.md']);
		expect('release' in vault.fm('F.md')).toBe(false);
		expect(await announced()).toBe('Removed "F" from its release');
	});

	it('captures the release’s own name before the write’s own refresh can take it out of the model', async () => {
		// The batch's own refresh runs inside `applySafely`, synchronously, before this
		// await resolves — `applyCardMove`'s own stated capture rule, the same one
		// `performBoardMove`/`performHorizonMove` keep for `host.board`/`host.roadmap`.
		// Simulated the same way `boardMenu.test.ts` simulates a vacated column: the
		// vault hook fires from inside the write, mid-batch, and rebuilds the model
		// before `performReleaseMove`'s own await sees the result.
		const { view, vault } = makeViewWithReleases();
		vi.useFakeTimers();
		const target = itemAt(view, '2.4.md');
		vault.afterWrite = () => {
			vault.files.delete('2.4.md');
			refresh(view, vault);
		};

		await view.performReleaseMove(itemAt(view, 'F.md'), target);

		// The release is gone from the model by now — proof the write's refresh really
		// ran before this assertion — and the name is announced all the same, because
		// it was read off the argument before any of that happened.
		expect(view.model?.byPath.has('2.4.md')).toBe(false);
		expect(await announced()).toContain('2.4');
	});

	it('announces exactly once', async () => {
		const { view } = makeViewWithReleases();
		vi.useFakeTimers();
		const spy = vi.spyOn(cardDrag, 'announceReleaseMove');

		await view.performReleaseMove(itemAt(view, 'F.md'), itemAt(view, '2.4.md'));

		expect(spy).toHaveBeenCalledTimes(1);
	});
});
