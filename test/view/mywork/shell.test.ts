// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MyWorkView } from '../../../src/view/mywork/myWorkView';
import { makeMyWorkView, myWorkVault } from '../../helpers/mywork';

describe('the my-work view', () => {
	it('says the assignee property is unbound rather than drawing an empty pane', () => {
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault(), { assigneeProperty: '' });
		expect(view.viewEl.querySelector('.pbl-empty-title')).not.toBeNull();
		expect(view.viewEl.querySelector('.pbl-tree')).toBeNull();
	});

	it('says the base returns no people when the roster is empty', () => {
		const vault = myWorkVault({ resources: false });
		const { view }: { view: MyWorkView } = makeMyWorkView(vault);
		expect(view.viewEl.querySelector('.pbl-empty-title')).not.toBeNull();
	});

	it('asks for a person when nothing is picked', () => {
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault());
		expect(view.pickedPerson).toBeNull();
		expect(view.viewEl.querySelector('.pbl-empty')).not.toBeNull();
	});

	it('remembers the pick across a remount of the same base', () => {
		const vault = myWorkVault();
		makeMyWorkView(vault).view.pick('People/Ada.md');
		expect(makeMyWorkView(vault).view.pickedPerson).toBe('People/Ada.md');
	});

	it('keeps the pick when there is no view identity, instead of resetting it', () => {
		// An embedded base: `resolveViewIdentity` returns null on purpose, so the pick is
		// session-only. Assigning null in that branch would reset it on every data update.
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault(), {}, { embedded: true });
		view.pick('People/Ada.md');
		view.onDataUpdated();
		expect(view.pickedPerson).toBe('People/Ada.md');
	});
});

describe('focus across a redraw (PR #234 correction 1)', () => {
	it('restores focus to the tree control after a redraw, instead of dropping it on the body', () => {
		const { view }: { view: MyWorkView } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		const tree = view.viewEl.querySelector<HTMLElement>('.pbl-mw-tree');
		expect(tree).not.toBeNull();
		tree?.focus();
		expect(document.activeElement).toBe(tree);

		// An ordinary redraw of the SAME screen — a Bases metadata refresh, not a pick.
		view.onDataUpdated();

		expect(document.activeElement).toBe(view.viewEl.querySelector('.pbl-mw-tree'));
	});
});

describe('a stale model after the assignee property is unbound (PR #234 correction 2)', () => {
	it('refuses a write planned before the property was cleared', async () => {
		const vault = myWorkVault();
		const { view, config } = makeMyWorkView(vault, { assigneeProperty: 'note.assignee' });
		// Captured while the property was still bound — the row a menu would have opened.
		const target = view.model!.byPath.get('PBI Ada.md')!.file;

		config.values.assigneeProperty = '';
		view.onDataUpdated();
		expect(view.model).toBeNull();

		const before = vault.writeLog.length;
		await view.gate.applySafely([{ file: target, state: 'Done' }]);

		expect(vault.writeLog.length).toBe(before);
		expect(vault.fm(target.path).state).toBeUndefined();
	});
});
