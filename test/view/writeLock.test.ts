// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { useViewHarness, makeView, fixture } from '../helpers/view';
import { WriteLock } from '../../src/view/writeLock';

useViewHarness();

describe('the plugin-wide write lock', () => {
	it('serializes two views: the second batch is refused while the first is in flight', async () => {
		const vault = fixture();
		const lock = new WriteLock();
		let release: () => void = () => {};
		// Stall the first write inside processFrontMatter so the second arrives mid-batch.
		vault.beforeWrite = () => new Promise<void>((r) => (release = r));
		const a = makeView(vault, {}, { lock });
		const b = makeView(vault, {}, { lock });
		const fileOf = (path: string) => vault.entries().find((e) => e.file.path === path)!.file;
		const first = a.view.applySafely([{ file: fileOf('Epic A.md'), order: 99 }]);
		const second = await b.view.applySafely([{ file: fileOf('Epic B.md'), order: 42 }]);
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
		const fileOf = (path: string) => vault.entries().find((e) => e.file.path === path)!.file;
		await a.view.applySafely([{ file: fileOf('Epic A.md'), order: 99 }]);
		expect(b.view.canUndo()).toBe(true);
		await b.view.undoLast();
		expect(vault.fm('Epic A.md').order).toBe(10);
		// The undo itself installed a redo in the same shared slot (see
		// "undoing an undo redoes" in test/view/undo.test.ts) — view A sees it too.
		expect(a.view.canUndo()).toBe(true);
	});
});
