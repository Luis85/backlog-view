// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import * as cardDrag from '../../src/view/interactions/cardDrag';
import { announced } from '../helpers/dnd';
import { FakeVault } from '../helpers/vault';
import { flush, itemAt, makeView, makeViewWithReleases, refresh, useViewHarness } from '../helpers/view';

/**
 * `performReleaseMove` — the one host method both the card menu and the keyboard
 * (Task 6) will call, following `performHorizonMove`'s shape: plan with
 * `computeReleaseWrites`, apply through `applySafely`, announce once. Unlike the
 * board and horizon axes a release is not a column or bucket this view draws, so
 * there is no on-screen vocabulary to translate through — the release's own name IS
 * the word announced, read off the argument rather than looked up, which is what the
 * fourth case below drives.
 */
useViewHarness();

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

	it('announces the release’s own name even where the write takes it out of the model', async () => {
		// About the SOURCE of the name, not the timing of reading it: `performReleaseMove`
		// takes it off its own ARGUMENT rather than looking it up through `host.model`, so
		// the announcement cannot depend on the release still being there afterwards. This
		// drives the case a lookup would have failed on — the vault hook fires from inside
		// the write, mid-batch, and rebuilds the model before the await resolves, the same
		// way `boardMenu.test.ts` empties a column.
		const { view, vault } = makeViewWithReleases();
		vi.useFakeTimers();
		const target = itemAt(view, '2.4.md');
		vault.afterWrite = () => {
			vault.files.delete('2.4.md');
			refresh(view, vault);
		};

		await view.performReleaseMove(itemAt(view, 'F.md'), target);

		// The release is gone from the model by now — proof the refresh really ran before
		// this assertion — and the name is announced all the same, because it never came
		// from the model.
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
