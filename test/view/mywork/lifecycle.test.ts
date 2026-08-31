// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MyWorkView } from '../../../src/view/mywork/myWorkView';
import { OpenController } from '../../../src/view/openTarget';
import { makeMyWorkView, myWorkVault } from '../../helpers/mywork';

describe('opener', () => {
	it('is the OpenController row clicks will open notes through, once Task 6 draws rows', () => {
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault());
		expect(view.opener).toBeInstanceOf(OpenController);
	});
});

describe('openContext', () => {
	it('reads the app, the pane and the configured open target off the view', () => {
		const { view, containerEl }: { view: MyWorkView; containerEl: HTMLElement } = makeMyWorkView(myWorkVault());
		const ctx = view.openContext();
		expect(ctx.app).toBe(view.app);
		expect(ctx.viewEl).toBe(view.viewEl);
		// `split` is this view's own default (`myWorkOptions.ts`'s own reason: a sidebar
		// tree must not evict the note the reader is on).
		expect(ctx.settings.openIn).toBe('split');
		expect(containerEl.contains(view.viewEl)).toBe(true);
	});
});

describe('onunload', () => {
	it('detaches the view element and stops following the write lock', () => {
		const { view, containerEl } = makeMyWorkView(myWorkVault());
		expect(containerEl.contains(view.viewEl)).toBe(true);

		view.onunload();

		expect(containerEl.contains(view.viewEl)).toBe(false);
	});
});

describe('a write landing through this view’s own gate', () => {
	it('applies an in-filter write and rebuilds the model over the fresh frontmatter', async () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault, { assigneeProperty: 'note.assignee' });
		view.pick('People/Ada.md');
		const target = view.model!.byPath.get('PBI Ada.md')!.file;

		await view.gate.applySafely([{ file: target, state: 'Doing' }]);

		expect(vault.fm(target.path).status).toBe('Doing');
	});

	it('undoes its own write through the shared lock', async () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault, { assigneeProperty: 'note.assignee' });
		view.pick('People/Ada.md');
		const target = view.model!.byPath.get('PBI Ada.md')!.file;

		await view.gate.applySafely([{ file: target, state: 'Doing' }]);
		expect(vault.fm(target.path).status).toBe('Doing');

		const undone = await view.gate.undoLast();

		expect(undone).toBe(true);
		expect(vault.fm(target.path).status).toBeUndefined();
	});

	it('defers a data update that arrives mid-batch, and flushes it once the batch ends', async () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault, { assigneeProperty: 'note.assignee' });
		view.pick('People/Ada.md');
		const target = view.model!.byPath.get('PBI Ada.md')!.file;

		let release: () => void = () => {};
		// Stall the write inside processFrontMatter so a Bases refresh arrives mid-batch —
		// `test/view/writeLock.test.ts`'s own technique for putting something in that window.
		vault.beforeWrite = () => new Promise<void>((r) => (release = r));
		const writing = view.gate.applySafely([{ file: target, state: 'Doing' }]);
		// Arrives while `lock.applying` is true: deferred rather than rebuilding mid-batch
		// off a half-applied write (`WriteGate.deferUpdate`).
		view.onDataUpdated();
		release();
		await writing;

		// The deferred update flushed once the batch ended (`WriteGate.followLock`'s own
		// flush, wired here to `this.refresh()`) — without a second call of ours, the model
		// already reflects the write, which it could not if the flush were dropped.
		expect(view.model?.byPath.get(target.path)?.stateValue).toBe('Doing');
	});
});
