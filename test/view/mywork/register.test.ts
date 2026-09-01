// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BasesViewRegistration } from 'obsidian';
import { registerMyWorkView } from '../../../src/view/mywork/register';
import { getMyWorkViewOptions } from '../../../src/domain/myWorkOptions';
import { MY_WORK_VIEW_TYPE, MyWorkView } from '../../../src/view/mywork/myWorkView';
import { WriteLock } from '../../../src/view/writeLock';
import { useViewHarness, captureRegistrations } from '../../helpers/view';
import { FakeVault, FakeViewConfig } from '../../helpers/vault';

useViewHarness();

/** `test/view/release/register.test.ts`'s own shape, for the fourth registration. */
describe('registerMyWorkView', () => {
	it('registers the my-work view with the correct config', () => {
		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();

		registerMyWorkView(fakePlugin, new WriteLock());

		expect(specs.has(MY_WORK_VIEW_TYPE)).toBe(true);
		const spec = specs.get(MY_WORK_VIEW_TYPE)!;
		expect(spec.name).toBe('My work');
		expect(spec.icon).toBe('lucide-user-round-check');
		// The identity, not merely "something is set": the options screen is this view's
		// own option set, and handing Bases another view's set would draw a menu that
		// binds properties nothing here reads.
		expect(spec.options).toBe(getMyWorkViewOptions);
	});

	it('factory-built view is a MyWorkView, mounted in the container it was given', () => {
		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();
		registerMyWorkView(fakePlugin, new WriteLock());
		const spec = specs.get(MY_WORK_VIEW_TYPE)!;

		const containerEl = document.body.createDiv();
		const view = spec.factory({} as never, containerEl);

		expect(view).toBeInstanceOf(MyWorkView);
		expect(containerEl.querySelector('.pbl-mw-view')).toBe((view as MyWorkView).viewEl);
	});

	it('factory-built view shares the lock observably: a second view undoes the first one’s write', async () => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 1, assignee: 'Ada' } });
		const lock = new WriteLock();

		const { plugin: fakePlugin, specs } = captureRegistrations<BasesViewRegistration>();
		registerMyWorkView(fakePlugin, lock);
		const spec = specs.get(MY_WORK_VIEW_TYPE)!;

		const containerA = document.body.createDiv();
		const viewA = spec.factory({} as never, containerA) as unknown as Record<string, unknown>;
		viewA.app = vault.app;
		viewA.config = new FakeViewConfig({ assigneeProperty: 'note.assignee' });
		viewA.data = { data: vault.entries() };
		(viewA as unknown as MyWorkView).onDataUpdated();

		const containerB = document.body.createDiv();
		const viewB = spec.factory({} as never, containerB) as unknown as Record<string, unknown>;
		viewB.app = vault.app;
		viewB.config = new FakeViewConfig({ assigneeProperty: 'note.assignee' });
		viewB.data = { data: vault.entries() };
		(viewB as unknown as MyWorkView).onDataUpdated();

		const target = vault.entries().find((e) => e.file.path === 'PBI.md')!.file;
		await (viewA as unknown as MyWorkView).gate.applySafely([{ file: target, state: 'Doing' }]);

		// Observable proof: view B (never the one writing) can undo the batch view A made
		// through the factory — `registerEstimationView.test.ts`'s own shape, and evidence
		// this view's own gate is built from the shared lock rather than a private one.
		expect((viewB as unknown as MyWorkView).gate.canUndo()).toBe(true);
	});
});
