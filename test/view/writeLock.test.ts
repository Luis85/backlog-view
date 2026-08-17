// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { useViewHarness, makeView, fixture, flush } from '../helpers/view';
import { Notice } from '../helpers/obsidian-mock';
import { WriteLock } from '../../src/view/writeLock';

useViewHarness();

/** The one place a test needs the file behind a fixture path. */
function fileOf(vault: ReturnType<typeof fixture>, path: string) {
	return vault.entries().find((e) => e.file.path === path)!.file;
}

describe('the plugin-wide write lock', () => {
	it('serializes two views: the second batch is refused while the first is in flight', async () => {
		const vault = fixture();
		const lock = new WriteLock();
		let release: () => void = () => {};
		// Stall the first write inside processFrontMatter so the second arrives mid-batch.
		vault.beforeWrite = () => new Promise<void>((r) => (release = r));
		const a = makeView(vault, {}, { lock });
		const b = makeView(vault, {}, { lock });
		const first = a.view.applySafely([{ file: fileOf(vault, 'Epic A.md'), order: 99 }]);
		const second = await b.view.applySafely([{ file: fileOf(vault, 'Epic B.md'), order: 42 }]);
		expect(second).toBeNull(); // refused: "Still applying the previous change"
		release();
		await first;
		expect(vault.fm('Epic A.md').order).toBe(99);
		// Refused: the fixture's starting value, never touched by the refused write.
		expect(vault.fm('Epic B.md').order).toBe(20);
	});

	it('shares one undo slot: view B takes back what view A wrote', async () => {
		const vault = fixture();
		const lock = new WriteLock();
		const a = makeView(vault, {}, { lock });
		const b = makeView(vault, {}, { lock });
		await a.view.applySafely([{ file: fileOf(vault, 'Epic A.md'), order: 99 }]);
		expect(b.view.canUndo()).toBe(true);
		await b.view.undoLast();
		expect(vault.fm('Epic A.md').order).toBe(10);
		// The undo itself installed a redo in the same shared slot (see
		// "undoing an undo redoes" in test/view/undo.test.ts) — view A sees it too.
		expect(a.view.canUndo()).toBe(true);
	});

	it('flushes the OTHER view’s deferred data update when the batch ends', async () => {
		const vault = fixture();
		const lock = new WriteLock();
		const a = makeView(vault, {}, { lock });
		const b = makeView(vault, {}, { lock });
		// Bases notices the write and tells view B, which is not the view writing: its
		// gate defers on the same vault-wide `applying`, so nothing but the lock's own
		// batch-end notification can ever release it.
		vault.afterWrite = () => b.view.onDataUpdated();

		await a.view.applySafely([{ file: fileOf(vault, 'Epic A.md'), order: 99 }]);

		expect(b.view.model?.byPath.get('Epic A.md')?.order).toBe(99);
	});

	it('never arms undo or leaves a write control enabled mid-batch, in either view', async () => {
		const vault = fixture();
		const lock = new WriteLock();
		let release: () => void = () => {};
		// Stall the SECOND file, so the first has landed and installed its inverses —
		// the moment the undo slot holds something while the batch is still running.
		vault.beforeWrite = (path) => (path === 'Epic B.md' ? new Promise<void>((r) => (release = r)) : undefined);
		const a = makeView(vault, {}, { lock });
		const b = makeView(vault, {}, { lock });
		const disabled = (harness: typeof a, selector: string) =>
			Array.from(harness.containerEl.querySelectorAll<HTMLButtonElement>(selector)).map((el) => el.disabled);

		const batch = a.view.applySafely([
			{ file: fileOf(vault, 'Epic A.md'), order: 99 },
			{ file: fileOf(vault, 'Epic B.md'), order: 42 },
		]);
		await flush();

		expect(lock.lastUndo?.length).toBeGreaterThan(0); // there IS something in the slot
		for (const harness of [a, b]) {
			expect(harness.view.canUndo()).toBe(false); // …and it may not be reached yet
			expect(disabled(harness, '.pbl-undo-btn')).toEqual([true]);
			expect(disabled(harness, '.pbl-write-ctl')).not.toContain(false);
		}

		release();
		await batch;

		expect(a.view.canUndo()).toBe(true);
		expect(disabled(b, '.pbl-write-ctl')).not.toContain(true);
	});

	it('replays an undo whose own view is misconfigured: authorization came at capture time', async () => {
		const vault = fixture();
		const lock = new WriteLock();
		const a = makeView(vault, {}, { lock });
		// View B writes parent and order to one key, so every FORWARD batch of its own is
		// refused — a verdict about its own planner that says nothing about raw restores.
		const b = makeView(vault, { orderProperty: 'note.parent' }, { lock });
		await a.view.applySafely([{ file: fileOf(vault, 'Epic A.md'), order: 99 }]);
		Notice.reset();

		expect(await b.view.undoLast()).toBe(true);

		expect(vault.fm('Epic A.md').order).toBe(10);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(false);
	});

	it('isolates a throwing subscriber: the batch still succeeds and every other view still flushes', async () => {
		const vault = fixture();
		const lock = new WriteLock();
		const a = makeView(vault, {}, { lock });
		// Subscribed between the two views, so a propagating throw would reach the batch
		// AND cost view B the flush its own listener does.
		lock.subscribe(() => {
			throw new Error('a view blew up while publishing');
		});
		const b = makeView(vault, {}, { lock });
		vault.afterWrite = () => b.view.onDataUpdated();
		vi.spyOn(console, 'error').mockImplementation(() => {});

		const outcome = await a.view.applySafely([{ file: fileOf(vault, 'Epic A.md'), order: 99 }]);

		expect(outcome).not.toBeNull(); // the write landed, and is reported as landed
		expect(vault.fm('Epic A.md').order).toBe(99);
		expect(b.view.model?.byPath.get('Epic A.md')?.order).toBe(99);
	});
});
